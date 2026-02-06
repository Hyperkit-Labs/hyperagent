"""Authentication routes"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.api.middleware.auth import AuthManager, security
from hyperagent.api.middleware.rate_limit import RateLimiter
from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.config import settings
from hyperagent.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


class LoginRequest(BaseModel):
    """Login request model"""

    email: EmailStr
    password: str  # In production, use OAuth2PasswordBearer


class TokenResponse(BaseModel):
    """Token response model"""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = 86400  # 24 hours


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    User login endpoint

    Logic:
    1. Query database for user by email
    2. Verify password hash (if password field exists)
    3. Check if user is active
    4. Generate JWT token
    5. Return token to client

    Note: Currently supports demo mode (no password verification).
    For production, add password_hash field to User model and enable verification.
    """
    from sqlalchemy import select

    from hyperagent.models.user import User

    # Query user from database
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    # Check if user exists
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive"
        )

    # Password verification
    if hasattr(user, "password_hash") and user.password_hash:
        from passlib.context import CryptContext

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        if not pwd_context.verify(request.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
            )
    elif not hasattr(user, "password_hash"):
        # Demo mode: accept any password if password_hash field doesn't exist
        logger.warning(
            f"User {user.email} has no password_hash field. Using demo mode (no password verification)."
        )

    # Generate token
    token = AuthManager.create_token(
        user_id=str(user.id),
        email=user.email,
        roles=["user"],  # Could add role field to User model later
    )

    logger.info(f"User {user.email} logged in successfully")

    return TokenResponse(access_token=token, token_type="bearer", expires_in=86400)


@router.get("/me")
async def get_current_user_info(user: dict = Depends(AuthManager.get_current_user)):
    """Get current user information"""
    return {
        "user_id": user.get("user_id"),
        "email": user.get("email"),
        "roles": user.get("roles", []),
    }


@router.post("/refresh")
async def refresh_token(user: dict = Depends(AuthManager.get_current_user)):
    """Refresh access token"""
    new_token = AuthManager.create_token(
        user_id=user["user_id"], email=user["email"], roles=user.get("roles", [])
    )

    return TokenResponse(access_token=new_token, token_type="bearer", expires_in=86400)
