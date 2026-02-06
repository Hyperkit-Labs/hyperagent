"""
Comprehensive error handling with retry logic

Provides:
- Retry decorators for transient failures
- User-friendly error messages
- Error classification and handling
"""

import asyncio
import logging
from functools import wraps
from typing import Callable, TypeVar, Any, Optional, List
from datetime import datetime, timedelta

from hyperagent.core.exceptions import (
    HyperAgentError,
    NetworkError,
    DeploymentError,
    RateLimitError,
)

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Retryable error types
RETRYABLE_ERRORS = (
    NetworkError,
    TimeoutError,
    ConnectionError,
    asyncio.TimeoutError,
)

# User-friendly error messages
ERROR_MESSAGES = {
    "NetworkError": "Network connection failed. Please check your internet connection and try again.",
    "DeploymentError": "Deployment failed. Please verify your contract and network settings.",
    "RateLimitError": "Rate limit exceeded. Please wait a moment and try again.",
    "TimeoutError": "Request timed out. The operation may still be processing. Please check status later.",
    "ConnectionError": "Could not connect to the service. Please check if the service is running.",
    "ValidationError": "Invalid input provided. Please check your request and try again.",
    "WalletError": "Wallet operation failed. Please ensure your wallet is connected and has sufficient balance.",
}


def get_user_friendly_message(error: Exception) -> str:
    """
    Get user-friendly error message
    
    Args:
        error: Exception instance
    
    Returns:
        User-friendly message string
    """
    error_type = type(error).__name__
    
    # Check if it's a HyperAgentError with custom message
    if isinstance(error, HyperAgentError):
        return error.message
    
    # Check predefined messages
    if error_type in ERROR_MESSAGES:
        return ERROR_MESSAGES[error_type]
    
    # Check error message for common patterns
    error_str = str(error).lower()
    
    if "timeout" in error_str:
        return ERROR_MESSAGES["TimeoutError"]
    elif "connection" in error_str or "network" in error_str:
        return ERROR_MESSAGES["NetworkError"]
    elif "rate limit" in error_str:
        return ERROR_MESSAGES["RateLimitError"]
    elif "validation" in error_str or "invalid" in error_str:
        return ERROR_MESSAGES["ValidationError"]
    elif "wallet" in error_str or "balance" in error_str:
        return ERROR_MESSAGES["WalletError"]
    
    # Default message
    return f"An error occurred: {str(error)}"


def retry_with_backoff(
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    retryable_errors: tuple = RETRYABLE_ERRORS,
):
    """
    Retry decorator with exponential backoff
    
    Args:
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
        max_delay: Maximum delay in seconds
        exponential_base: Base for exponential backoff
        retryable_errors: Tuple of error types that should be retried
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> T:
            last_error = None
            delay = initial_delay
            
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except retryable_errors as e:
                    last_error = e
                    if attempt < max_retries:
                        logger.warning(
                            f"Retryable error on attempt {attempt + 1}/{max_retries + 1}: {e}. "
                            f"Retrying in {delay:.2f}s..."
                        )
                        await asyncio.sleep(delay)
                        delay = min(delay * exponential_base, max_delay)
                    else:
                        logger.error(f"Max retries exceeded for {func.__name__}: {e}")
                except Exception as e:
                    # Non-retryable error, re-raise immediately
                    logger.error(f"Non-retryable error in {func.__name__}: {e}")
                    raise
            
            # All retries exhausted
            raise last_error
        
        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> T:
            last_error = None
            delay = initial_delay
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_errors as e:
                    last_error = e
                    if attempt < max_retries:
                        logger.warning(
                            f"Retryable error on attempt {attempt + 1}/{max_retries + 1}: {e}. "
                            f"Retrying in {delay:.2f}s..."
                        )
                        import time
                        time.sleep(delay)
                        delay = min(delay * exponential_base, max_delay)
                    else:
                        logger.error(f"Max retries exceeded for {func.__name__}: {e}")
                except Exception as e:
                    # Non-retryable error, re-raise immediately
                    logger.error(f"Non-retryable error in {func.__name__}: {e}")
                    raise
            
            # All retries exhausted
            raise last_error
        
        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


class ErrorHandler:
    """
    Centralized error handler
    
    Provides:
    - Error classification
    - User-friendly messages
    - Retry logic
    - Error logging
    """
    
    @staticmethod
    def handle_error(
        error: Exception,
        context: Optional[str] = None,
        user_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Handle error and return structured response
        
        Args:
            error: Exception instance
            context: Context where error occurred
            user_message: Custom user-friendly message
        
        Returns:
            {
                "error": str,
                "message": str (user-friendly),
                "details": dict,
                "retryable": bool,
                "suggestions": list
            }
        """
        error_type = type(error).__name__
        is_retryable = isinstance(error, RETRYABLE_ERRORS)
        
        message = user_message or get_user_friendly_message(error)
        
        # Generate suggestions based on error type
        suggestions = ErrorHandler._get_suggestions(error)
        
        response = {
            "error": error_type,
            "message": message,
            "details": {
                "context": context,
                "error_type": error_type,
            },
            "retryable": is_retryable,
            "suggestions": suggestions,
        }
        
        # Add details from HyperAgentError
        if isinstance(error, HyperAgentError):
            response["details"].update(error.details)
        
        # Log error
        log_level = logging.WARNING if is_retryable else logging.ERROR
        logger.log(
            log_level,
            f"Error in {context or 'unknown context'}: {error}",
            exc_info=not is_retryable
        )
        
        return response
    
    @staticmethod
    def _get_suggestions(error: Exception) -> List[str]:
        """Get helpful suggestions based on error type"""
        error_type = type(error).__name__
        error_str = str(error).lower()
        
        suggestions = []
        
        if isinstance(error, NetworkError) or "network" in error_str:
            suggestions.extend([
                "Check your internet connection",
                "Verify the service is running",
                "Try again in a few moments",
            ])
        elif isinstance(error, RateLimitError) or "rate limit" in error_str:
            suggestions.extend([
                "Wait a few seconds before retrying",
                "Reduce the frequency of requests",
            ])
        elif isinstance(error, DeploymentError) or "deployment" in error_str:
            suggestions.extend([
                "Verify your contract bytecode is valid",
                "Check that you have sufficient balance for gas",
                "Ensure the network is accessible",
            ])
        elif "timeout" in error_str:
            suggestions.extend([
                "The operation may still be processing",
                "Check the status endpoint for updates",
                "Try again with a longer timeout",
            ])
        elif "wallet" in error_str or "balance" in error_str:
            suggestions.extend([
                "Ensure your wallet is connected",
                "Check that you have sufficient balance",
                "Verify the network matches your wallet",
            ])
        else:
            suggestions.append("Please try again or contact support if the issue persists")
        
        return suggestions

