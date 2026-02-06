"""Spending controls manager for enforcing user limits"""

import json
import logging
from typing import Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.core.config import settings
from hyperagent.models.spending_control import SpendingControl

logger = logging.getLogger(__name__)


class SpendingControlsManager:
    """Enforce user spending limits"""
    
    def __init__(self):
        self.default_daily_limit = getattr(settings, 'default_daily_limit_usdc', 10.0)
        self.default_monthly_limit = getattr(settings, 'default_monthly_limit_usdc', 100.0)
    
    async def check_spending_limit(
        self,
        user_wallet: str,
        amount_usdc: float,
        merchant: str,
        db: AsyncSession
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if user can spend amount within limits
        
        Args:
            user_wallet: User's wallet address
            amount_usdc: Amount to spend in USDC
            merchant: Merchant identifier
            db: Database session
        
        Returns:
            (allowed: bool, error_message: Optional[str])
        """
        controls = await self._get_or_create_controls(user_wallet, db)
        
        if not controls.is_active:
            return True, None
        
        controls.reset_if_needed()
        
        if controls.whitelist_merchants:
            if merchant not in controls.whitelist_merchants:
                return False, f"Merchant '{merchant}' not in whitelist"
        
        allowed, error = controls.can_spend(amount_usdc)
        if not allowed:
            logger.warning(f"Spending limit check failed for {user_wallet}: {error}")
        
        return allowed, error
    
    async def record_spending(
        self,
        user_wallet: str,
        amount_usdc: float,
        db: AsyncSession
    ):
        """
        Record spending after successful payment
        
        Args:
            user_wallet: User's wallet address
            amount_usdc: Amount spent in USDC
            db: Database session
        """
        controls = await self._get_or_create_controls(user_wallet, db)
        controls.record_spending(amount_usdc)
        await db.commit()
        
        logger.info(
            f"Recorded spending for {user_wallet}: ${amount_usdc:.2f} "
            f"(daily: ${controls.daily_spent:.2f}/{controls.daily_limit:.2f}, "
            f"monthly: ${controls.monthly_spent:.2f}/{controls.monthly_limit:.2f})"
        )
    
    async def get_controls(
        self,
        user_wallet: str,
        db: AsyncSession
    ) -> Optional[SpendingControl]:
        """
        Get spending controls for a user
        
        Args:
            user_wallet: User's wallet address
            db: Database session
        
        Returns:
            SpendingControl or None
        """
        result = await db.execute(
            select(SpendingControl).where(
                SpendingControl.wallet_address == user_wallet
            )
        )
        return result.scalar_one_or_none()
    
    async def update_limits(
        self,
        user_wallet: str,
        db: AsyncSession,
        daily_limit: Optional[float] = None,
        monthly_limit: Optional[float] = None,
    ) -> SpendingControl:
        """
        Update spending limits for a user
        
        Args:
            user_wallet: User's wallet address
            daily_limit: New daily limit in USDC
            monthly_limit: New monthly limit in USDC
            db: Database session
        
        Returns:
            Updated SpendingControl
        """
        controls = await self._get_or_create_controls(user_wallet, db)
        
        if daily_limit is not None:
            controls.daily_limit = daily_limit
        
        if monthly_limit is not None:
            controls.monthly_limit = monthly_limit
        
        await db.commit()
        await db.refresh(controls)
        
        logger.info(f"Updated spending limits for {user_wallet}")
        return controls
    
    async def update_whitelist(
        self,
        user_wallet: str,
        merchants: list[str],
        db: AsyncSession
    ) -> SpendingControl:
        """
        Update merchant whitelist for a user
        
        Args:
            user_wallet: User's wallet address
            merchants: List of allowed merchant identifiers
            db: Database session
        
        Returns:
            Updated SpendingControl
        """
        controls = await self._get_or_create_controls(user_wallet, db)
        controls.whitelist_merchants = merchants
        
        await db.commit()
        await db.refresh(controls)
        
        logger.info(f"Updated merchant whitelist for {user_wallet}: {len(merchants)} merchants")
        return controls
    
    async def toggle_active(
        self,
        user_wallet: str,
        is_active: bool,
        db: AsyncSession
    ) -> SpendingControl:
        """
        Enable or disable spending controls
        
        Args:
            user_wallet: User's wallet address
            is_active: Whether to enable controls
            db: Database session
        
        Returns:
            Updated SpendingControl
        """
        controls = await self._get_or_create_controls(user_wallet, db)
        controls.is_active = is_active
        
        await db.commit()
        await db.refresh(controls)
        
        status = "enabled" if is_active else "disabled"
        logger.info(f"Spending controls {status} for {user_wallet}")
        return controls
    
    async def _get_or_create_controls(
        self,
        user_wallet: str,
        db: AsyncSession
    ) -> SpendingControl:
        """
        Get or create spending controls for a user
        
        Args:
            user_wallet: User's wallet address
            db: Database session
        
        Returns:
            SpendingControl instance
        """
        controls = await self.get_controls(user_wallet, db)
        
        if not controls:
            controls = SpendingControl(
                wallet_address=user_wallet,
                daily_limit=self.default_daily_limit,
                monthly_limit=self.default_monthly_limit,
                daily_spent=0.0,
                monthly_spent=0.0,
                is_active=True,
            )
            db.add(controls)
            await db.commit()
            await db.refresh(controls)
            
            logger.info(f"Created spending controls for {user_wallet}")
        
        return controls

