"""Authentication middleware for API"""

import logging
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import Header, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


# JWT Configuration
JWT_SECRET_KEY = getattr(settings, "jwt_secret_key", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()


class AuthManager:
    """
    Authentication Manager

    Concept: JWT-based authentication for API endpoints
    Logic: Validate tokens, extract user info, enforce permissions
    Security: Token expiration, signature verification
    """

    @staticmethod
    def create_token(user_id: str, email: str, roles: list = None) -> str:
        """
        Create JWT token

        Logic:
        1. Build payload with user info and expiration
        2. Sign with secret key
        3. Return encoded token
        """
        payload = {
            "user_id": user_id,
            "email": email,
            "roles": roles or ["user"],
            "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
            "iat": datetime.utcnow(),
        }

        token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        return token

    @staticmethod
    def verify_token(token: str) -> dict:
        """
        Verify and decode JWT token

        Logic:
        1. Decode token with secret key
        2. Verify expiration
        3. Return payload or raise exception
        """
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    @staticmethod
    async def get_current_user(
        credentials: HTTPAuthorizationCredentials = Security(security),
    ) -> dict:
        """
        Dependency for FastAPI routes

        Usage:
            @router.get("/protected")
            async def protected_route(user: dict = Depends(AuthManager.get_current_user)):
                return {"user_id": user["user_id"]}
        """
        token = credentials.credentials
        payload = AuthManager.verify_token(token)
        return payload

    @staticmethod
    async def require_role(required_role: str):
        """
        Role-based access control

        Usage:
            @router.get("/admin")
            async def admin_route(
                user: dict = Depends(AuthManager.require_role("admin"))
            ):
                return {"message": "Admin access"}
        """

        async def role_checker(
            credentials: HTTPAuthorizationCredentials = Security(security),
        ) -> dict:
            token = credentials.credentials
            payload = AuthManager.verify_token(token)

            user_roles = payload.get("roles", [])
            if required_role not in user_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail=f"Required role: {required_role}"
                )

            return payload

        return role_checker

    @staticmethod
    async def verify_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> dict:
        """
        API key authentication for programmatic access

        Concept: Allow API key-based authentication for bots/scripts
        Logic:
            1. Check X-API-Key header
            2. Validate against stored API keys (in database or config)
            3. Return user info or raise exception

        Usage:
            @router.get("/api/data")
            async def get_data(api_key: dict = Depends(AuthManager.verify_api_key)):
                return {"data": "..."}

        Args:
            x_api_key: API key from X-API-Key header

        Returns:
            User information dictionary
        """
        if not x_api_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key required. Provide X-API-Key header.",
            )

        # Validate API key against database or config
        # First check config (for backward compatibility)
        valid_api_keys = getattr(settings, "api_keys", [])

        if isinstance(valid_api_keys, str):
            # If it's a comma-separated string, split it
            valid_api_keys = [k.strip() for k in valid_api_keys.split(",") if k.strip()]

        # Check against config first (quick check)
        if valid_api_keys and x_api_key in valid_api_keys:
            logger.info(f"API key validated from config: {x_api_key[:10]}...")
        else:
            # Check against database API key table if available
            # For now, if no API keys in config, reject
            # Future: Query database for API key validation
            if not valid_api_keys:
                logger.warning("No API keys configured. API key authentication disabled.")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="API key authentication not configured",
                )

            logger.warning(f"Invalid API key attempted: {x_api_key[:10]}...")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

        # Return API key user info
        return {
            "user_id": f"api_key_{x_api_key[:8]}",
            "email": "api@hyperagent.dev",
            "roles": ["api_user"],
            "auth_method": "api_key",
        }

    @staticmethod
    async def get_current_user_optional(
        credentials: Optional[HTTPAuthorizationCredentials] = Security(
            HTTPBearer(auto_error=False)
        ),
    ) -> Optional[dict]:
        """
        Optional authentication - returns user if authenticated, None otherwise

        Concept: Allow endpoints that work with or without authentication
        Logic:
            1. Try to extract and verify token
            2. Return user if valid, None if missing/invalid

        Usage:
            @router.get("/public")
            async def public_endpoint(user: Optional[dict] = Depends(AuthManager.get_current_user_optional)):
                if user:
                    return {"message": f"Hello {user['email']}"}
                return {"message": "Hello anonymous"}
        """
        if not credentials:
            return None

        try:
            return AuthManager.verify_token(credentials.credentials)
        except HTTPException:
            return None
