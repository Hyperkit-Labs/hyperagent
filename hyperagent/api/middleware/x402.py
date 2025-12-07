import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.core.config import settings
from hyperagent.models.payment_history import PaymentHistory
from hyperagent.models.spending_control import SpendingControl

logger = logging.getLogger(__name__)

_thirdweb_client: Optional[Any] = None

# Default price tiers (fallback if config is invalid)
_DEFAULT_PRICE_TIERS = {
    "ERC20": 0.01,
    "ERC721": 0.02,
    "Custom": 0.15,
    "basic": 0.01,
    "advanced": 0.02,
    "deployment": 0.10,
}


def get_thirdweb_client() -> Any:
    """Get or create Thirdweb client singleton"""
    global _thirdweb_client
    if _thirdweb_client is None:
        from hyperagent.blockchain.thirdweb_client import ThirdwebClient

        _thirdweb_client = ThirdwebClient()
    return _thirdweb_client


def load_price_tiers() -> Dict[str, float]:
    """
    Load price tiers from configuration
    
    Returns:
        Dict mapping price tier names to USDC amounts
    """
    try:
        price_tiers_str = getattr(settings, "x402_price_tiers", None)
        if not price_tiers_str:
            logger.debug("x402_price_tiers not configured, using defaults")
            return _DEFAULT_PRICE_TIERS.copy()
        
        # Parse JSON string
        price_tiers = json.loads(price_tiers_str)
        
        # Validate structure
        if not isinstance(price_tiers, dict):
            logger.error(f"Invalid price tiers format: expected dict, got {type(price_tiers)}")
            return _DEFAULT_PRICE_TIERS.copy()
        
        # Validate values are numbers
        validated_tiers = {}
        for key, value in price_tiers.items():
            try:
                validated_tiers[key] = float(value)
            except (ValueError, TypeError):
                logger.warning(f"Invalid price tier value for {key}: {value}, skipping")
        
        if not validated_tiers:
            logger.error("No valid price tiers found, using defaults")
            return _DEFAULT_PRICE_TIERS.copy()
        
        logger.info(f"Loaded {len(validated_tiers)} price tiers from configuration")
        return validated_tiers
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse x402_price_tiers JSON: {e}, using defaults")
        return _DEFAULT_PRICE_TIERS.copy()
    except Exception as e:
        logger.error(f"Error loading price tiers: {e}, using defaults")
        return _DEFAULT_PRICE_TIERS.copy()


# Load price tiers at module level (cached)
_PRICE_TIERS = load_price_tiers()


class X402Middleware:
    def __init__(self):
        self.enabled = settings.x402_enabled
        self.price_tiers = load_price_tiers()

    async def check_spending_controls(
        self,
        db: Optional[AsyncSession],
        wallet_address: str,
        amount: float,
        merchant: Optional[str] = None,
    ) -> tuple[bool, Optional[str]]:
        """Check if payment is allowed based on spending controls"""
        if not db:
            return True, None

        try:
            stmt = select(SpendingControl).where(SpendingControl.wallet_address == wallet_address)
            result = await db.execute(stmt)
            control = result.scalar_one_or_none()

            if not control:
                return True, None

            now = datetime.utcnow()

            if control.whitelist_merchants and merchant:
                if merchant not in control.whitelist_merchants:
                    return False, "Merchant not in whitelist"

            if control.time_restrictions:
                hour = now.hour
                allowed_hours = control.time_restrictions.get("allowed_hours", [])
                if allowed_hours and hour not in allowed_hours:
                    return False, "Payment not allowed at this time"

            if control.daily_limit:
                today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                stmt = select(func.sum(PaymentHistory.amount)).where(
                    PaymentHistory.wallet_address == wallet_address,
                    PaymentHistory.timestamp >= today_start,
                    PaymentHistory.status == "completed",
                )
                result = await db.execute(stmt)
                daily_spent = result.scalar() or 0
                if float(daily_spent) + amount > float(control.daily_limit):
                    return (
                        False,
                        f"Daily limit exceeded. Limit: ${control.daily_limit}, Spent: ${daily_spent}, Requested: ${amount}",
                    )

            if control.monthly_limit:
                month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                stmt = select(func.sum(PaymentHistory.amount)).where(
                    PaymentHistory.wallet_address == wallet_address,
                    PaymentHistory.timestamp >= month_start,
                    PaymentHistory.status == "completed",
                )
                result = await db.execute(stmt)
                monthly_spent = result.scalar() or 0
                if float(monthly_spent) + amount > float(control.monthly_limit):
                    return (
                        False,
                        f"Monthly limit exceeded. Limit: ${control.monthly_limit}, Spent: ${monthly_spent}, Requested: ${amount}",
                    )

            return True, None
        except Exception as e:
            logger.error(f"Error checking spending controls: {e}")
            return True, None

    async def log_payment(
        self,
        db: Optional[AsyncSession],
        wallet_address: str,
        amount: float,
        network: str,
        endpoint: str,
        transaction_hash: Optional[str] = None,
        merchant: Optional[str] = None,
        currency: str = "USDC",
        status: str = "completed",
    ):
        """Log payment transaction to database"""
        if not db:
            logger.warning(f"Payment not logged: db session not provided. wallet={wallet_address}, amount={amount}, endpoint={endpoint}")
            return

        if not wallet_address:
            logger.warning(f"Payment not logged: wallet_address not provided. amount={amount}, endpoint={endpoint}")
            return

        try:
            payment = PaymentHistory(
                wallet_address=wallet_address,
                amount=amount,
                currency=currency,
                merchant=merchant,
                network=network,
                endpoint=endpoint,
                transaction_hash=transaction_hash,
                status=status,
            )
            db.add(payment)
            await db.flush()  # Flush to get ID but don't commit - let get_db() dependency handle commit
            logger.info(f"Payment logged successfully: wallet={wallet_address}, amount={amount}, merchant={merchant}, tx_hash={transaction_hash}")
        except Exception as e:
            logger.error(f"Error logging payment: {e}", exc_info=True)
            await db.rollback()
            raise  # Re-raise to let get_db() dependency handle the error

    async def verify_and_handle_payment(
        self,
        request: Request,
        endpoint: str,
        price_tier: str = "basic",
        price_usdc: Optional[float] = None,
        network: Optional[str] = None,
        db: Optional[AsyncSession] = None,
        wallet_address: Optional[str] = None,
        merchant: Optional[str] = None,
    ) -> Optional[JSONResponse]:
        if not self.enabled:
            return None

        if price_usdc is None:
            price_usdc = self.price_tiers.get(price_tier, 0.05)

        network = network or "avalanche_fuji"

        if wallet_address and db:
            allowed, error_msg = await self.check_spending_controls(
                db, wallet_address, price_usdc, merchant
            )
            if not allowed:
                return JSONResponse(
                    status_code=403,
                    content={"error": "Spending control violation", "message": error_msg},
                )

        base_url = str(request.base_url).rstrip("/")
        resource_url = f"{base_url}{endpoint}"
        payment_data = request.headers.get("x-payment")

        thirdweb_client = get_thirdweb_client()
        if not thirdweb_client:
            return JSONResponse(
                status_code=500, content={"error": "Payment service not configured"}
            )

        result = await thirdweb_client.settle_payment(
            resource_url=resource_url,
            method=request.method,
            payment_data=payment_data,
            network=network,
            price=str(price_usdc),
        )

        if result.get("status") == 200 and result.get("verified"):
            transaction_hash = result.get("transactionHash")
            # Always try to log payment if we have wallet_address and db
            if wallet_address:
                await self.log_payment(
                    db=db,
                    wallet_address=wallet_address,
                    amount=price_usdc,
                    network=network,
                    endpoint=endpoint,
                    transaction_hash=transaction_hash,
                    merchant=merchant,
                )
            else:
                logger.warning(f"Payment verified but not logged: wallet_address missing. endpoint={endpoint}, amount={price_usdc}")
            return None

        if result.get("status") == 402:
            # responseBody might be a JWT token string (not JSON) or a dict
            response_body = result.get("responseBody")
            response_headers = result.get("responseHeaders", {})

            # If responseBody is a string (JWT token), we need to return it properly
            # According to x402 protocol, 402 responses should include the JWT token
            # in the response body or headers
            if isinstance(response_body, str):
                # JWT token string - return as JSON with the token
                response = JSONResponse(
                    status_code=402,
                    content={"x402_token": response_body, "error": "Payment Required"},
                )
            elif isinstance(response_body, dict):
                # Already a dict - return as-is
                response = JSONResponse(status_code=402, content=response_body)
            else:
                # Fallback
                response = JSONResponse(status_code=402, content={"error": "Payment Required"})

            # Set response headers from settlePayment result
            for key, value in response_headers.items():
                response.headers[key] = str(value)

            return response

        # Handle settlement errors (502, 504, etc.)
        status_code = result.get("status", 500)
        error_message = (
            result.get("errorMessage") or result.get("error") or "Payment verification failed"
        )

        # Don't log JWT tokens in error messages
        if (
            isinstance(error_message, str)
            and error_message.startswith("eyJ")
            and len(error_message) > 100
        ):
            logger.error("Payment verification failed: Invalid response format")
            error_message = "Payment verification failed: Invalid response format"
        else:
            logger.error(f"Payment verification failed (status {status_code}): {error_message}")

        # For 502/504 errors, return appropriate status code
        if status_code in [502, 503, 504]:
            return JSONResponse(
                status_code=status_code,
                content={
                    "x402Version": 1,
                    "error": "Settlement error",
                    "errorMessage": error_message,
                },
            )

        return JSONResponse(
            status_code=status_code,
            content={
                "x402Version": 1,
                "error": "Payment verification failed",
                "errorMessage": error_message,
            },
        )
