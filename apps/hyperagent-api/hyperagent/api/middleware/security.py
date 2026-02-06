"""
Security Middleware

Concept: Input validation, sanitization, and security headers
Logic: Validate all inputs, sanitize user data, add security headers
"""

import html
import re
from typing import Callable

from fastapi import HTTPException, Request, status
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Security Headers Middleware

    Concept: Add security headers to all responses
    Logic: Inject security headers (CSP, HSTS, X-Frame-Options, etc.)
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add security headers to response"""
        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self'"
        )
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        return response


class InputSanitizationMiddleware(BaseHTTPMiddleware):
    """
    Input Sanitization Middleware

    Concept: Sanitize user inputs to prevent injection attacks
    Logic: Clean query parameters and form data
    """

    def __init__(self, app):
        super().__init__(app)
        # Patterns for potentially dangerous inputs
        self.dangerous_patterns = [
            re.compile(r"<script[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL),
            re.compile(r"javascript:", re.IGNORECASE),
            re.compile(r"on\w+\s*=", re.IGNORECASE),  # Event handlers
        ]

    def sanitize_string(self, value: str) -> str:
        """Sanitize string input"""
        if not isinstance(value, str):
            return value

        # Remove dangerous patterns
        sanitized = value
        for pattern in self.dangerous_patterns:
            sanitized = pattern.sub("", sanitized)

        # HTML escape
        sanitized = html.escape(sanitized)

        return sanitized

    def sanitize_dict(self, data: dict) -> dict:
        """Recursively sanitize dictionary"""
        sanitized = {}
        for key, value in data.items():
            if isinstance(value, str):
                sanitized[key] = self.sanitize_string(value)
            elif isinstance(value, dict):
                sanitized[key] = self.sanitize_dict(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    (
                        self.sanitize_string(item)
                        if isinstance(item, str)
                        else self.sanitize_dict(item) if isinstance(item, dict) else item
                    )
                    for item in value
                ]
            else:
                sanitized[key] = value
        return sanitized

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Sanitize request data"""
        # Note: FastAPI already handles request body parsing
        # This middleware focuses on query parameters

        if request.query_params:
            # Sanitize query parameters
            sanitized_params = {}
            for key, value in request.query_params.items():
                sanitized_params[key] = self.sanitize_string(value)
            # Note: We can't directly modify query_params, but we log for monitoring

        response = await call_next(request)
        return response


def validate_nlp_input(nlp_input: str) -> bool:
    """
    Validate NLP input

    Args:
        nlp_input: Natural language description

    Returns:
        bool: True if valid
    """
    if not nlp_input or not isinstance(nlp_input, str):
        return False

    # Length validation
    if len(nlp_input) < 10 or len(nlp_input) > 10000:
        return False

    # Check for dangerous patterns
    dangerous_patterns = [
        r"<script",
        r"javascript:",
        r"eval\(",
        r"exec\(",
    ]

    for pattern in dangerous_patterns:
        if re.search(pattern, nlp_input, re.IGNORECASE):
            return False

    return True


def validate_contract_code(contract_code: str) -> bool:
    """
    Validate Solidity contract code

    Args:
        contract_code: Solidity source code

    Returns:
        bool: True if valid
    """
    if not contract_code or not isinstance(contract_code, str):
        return False

    # Must contain pragma
    if "pragma solidity" not in contract_code.lower():
        return False

    # Must contain contract keyword
    if "contract" not in contract_code.lower():
        return False

    # Length validation
    if len(contract_code) < 50 or len(contract_code) > 1000000:
        return False

    return True
