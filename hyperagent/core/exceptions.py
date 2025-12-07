"""Custom exception classes for HyperAgent"""

from typing import Any, Dict, Optional


class HyperAgentError(Exception):
    """Base exception for all HyperAgent errors"""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for API responses"""
        return {"error": self.__class__.__name__, "message": self.message, "details": self.details}


class DeploymentError(HyperAgentError):
    """Deployment-related errors"""

    pass


class NetworkError(HyperAgentError):
    """Network-related errors (RPC, connectivity, etc.)"""

    pass


class CompilationError(HyperAgentError):
    """Contract compilation errors"""

    pass


class ValidationError(HyperAgentError):
    """Input validation errors"""

    pass


class WalletError(HyperAgentError):
    """Wallet-related errors (address validation, balance, etc.)"""

    pass


class GenerationError(HyperAgentError):
    """Contract generation errors"""

    pass


class AuditError(HyperAgentError):
    """Security audit errors"""

    pass


class TestingError(HyperAgentError):
    """Contract testing errors"""

    pass


class ConfigurationError(HyperAgentError):
    """Configuration errors"""

    pass


class AuthenticationError(HyperAgentError):
    """Authentication errors"""

    pass


class AuthorizationError(HyperAgentError):
    """Authorization errors (permissions, roles)"""

    pass


class RateLimitError(HyperAgentError):
    """Rate limiting errors"""

    pass


class PaymentError(HyperAgentError):
    """x402 payment errors"""

    pass
