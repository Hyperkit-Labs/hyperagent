"""
Runtime feature flag management

Provides centralized feature flag checking with environment variable support
and runtime toggling capabilities.
"""

import logging
import os
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class FeatureFlags:
    """
    Runtime feature flag manager
    
    Checks environment variables and provides a consistent API for feature flags.
    Supports both boolean flags and string-based configuration.
    """
    
    # Feature flag definitions with defaults
    _flags: Dict[str, bool] = {
        "ENABLE_TEE": False,
        "ENABLE_TELEMETRY": False,
        "ENABLE_CAPABILITIES": False,
        "ENABLE_X402": True,  # x402 is enabled by default
        "ENABLE_METRICS": True,  # Metrics enabled by default
        "ENABLE_MLFLOW": False,
        "ENABLE_PROMETHEUS": True,  # Prometheus enabled by default
    }
    
    @classmethod
    def is_enabled(cls, flag_name: str, default: Optional[bool] = None) -> bool:
        """
        Check if a feature flag is enabled
        
        Args:
            flag_name: Name of the feature flag (e.g., "ENABLE_TEE")
            default: Optional default value if flag is not set
            
        Returns:
            True if feature is enabled, False otherwise
        """
        # Check environment variable first
        env_value = os.getenv(flag_name)
        
        if env_value is not None:
            # Parse environment variable (supports true/false, 1/0, yes/no)
            env_value_lower = env_value.lower().strip()
            if env_value_lower in ("true", "1", "yes", "on", "enabled"):
                return True
            elif env_value_lower in ("false", "0", "no", "off", "disabled"):
                return False
            else:
                logger.warning(f"Invalid feature flag value for {flag_name}: {env_value}. Using default.")
        
        # Check default parameter
        if default is not None:
            return default
        
        # Check class defaults
        if flag_name in cls._flags:
            return cls._flags[flag_name]
        
        # Unknown flag defaults to False for safety
        logger.warning(f"Unknown feature flag: {flag_name}. Defaulting to False.")
        return False
    
    @classmethod
    def get_flag_value(cls, flag_name: str, default: Optional[str] = None) -> Optional[str]:
        """
        Get the raw string value of a feature flag
        
        Args:
            flag_name: Name of the feature flag
            default: Optional default value
            
        Returns:
            String value of the flag, or default if not set
        """
        return os.getenv(flag_name, default)
    
    @classmethod
    def set_flag(cls, flag_name: str, value: bool) -> None:
        """
        Set a feature flag value (runtime override)
        
        Note: This only affects the in-memory flag cache, not environment variables.
        Environment variables take precedence.
        
        Args:
            flag_name: Name of the feature flag
            value: Boolean value to set
        """
        cls._flags[flag_name] = value
        logger.info(f"Feature flag {flag_name} set to {value}")
    
    @classmethod
    def get_all_flags(cls) -> Dict[str, bool]:
        """
        Get all feature flags and their current values
        
        Returns:
            Dictionary mapping flag names to their enabled status
        """
        return {
            flag_name: cls.is_enabled(flag_name)
            for flag_name in cls._flags.keys()
        }
    
    @classmethod
    def register_flag(cls, flag_name: str, default: bool = False) -> None:
        """
        Register a new feature flag
        
        Args:
            flag_name: Name of the feature flag
            default: Default value if not set in environment
        """
        cls._flags[flag_name] = default
        logger.debug(f"Registered feature flag: {flag_name} (default: {default})")


# Convenience functions for common feature flags
def is_tee_enabled() -> bool:
    """Check if TEE integration is enabled"""
    return FeatureFlags.is_enabled("ENABLE_TEE")


def is_telemetry_enabled() -> bool:
    """Check if telemetry is enabled"""
    return FeatureFlags.is_enabled("ENABLE_TELEMETRY")


def is_capabilities_enabled() -> bool:
    """Check if capabilities registry is enabled"""
    return FeatureFlags.is_enabled("ENABLE_CAPABILITIES")


def is_x402_enabled() -> bool:
    """Check if x402 payments are enabled"""
    return FeatureFlags.is_enabled("ENABLE_X402")


def is_metrics_enabled() -> bool:
    """Check if metrics collection is enabled"""
    return FeatureFlags.is_enabled("ENABLE_METRICS")


def is_prometheus_enabled() -> bool:
    """Check if Prometheus metrics are enabled"""
    return FeatureFlags.is_enabled("ENABLE_PROMETHEUS")

