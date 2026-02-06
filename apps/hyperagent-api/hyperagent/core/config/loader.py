"""
Centralized Configuration Loader
Loads and merges YAML configs with environment variable substitution
"""
import os
import re
from pathlib import Path
from typing import Any, Dict, Optional
import yaml
from pydantic import BaseModel, Field, ValidationError
import logging

logger = logging.getLogger(__name__)


class ServiceConfig(BaseModel):
    """Service configuration model"""
    name: str
    protocol: str
    host: str
    port: int
    base_path: Optional[str] = ""
    health_endpoint: Optional[str] = None
    timeout_ms: int = 30000


class RetryConfig(BaseModel):
    """Retry configuration"""
    max_attempts: int = 3
    backoff_ms: int = 1000


class ConfigLoader:
    """
    Centralized configuration loader with validation
    
    Features:
    - Environment-aware loading (base + environment-specific)
    - Environment variable substitution
    - Config validation via Pydantic
    - Caching for performance
    - Deep merge of configs
    """
    
    _instance: Optional['ConfigLoader'] = None
    
    def __init__(self, env: Optional[str] = None):
        self.env = env or os.getenv('ENV', 'development')
        self.config_dir = Path(__file__).parent.parent.parent.parent / 'config'
        self._cache: Dict[str, Any] = {}
        self._config: Optional[Dict[str, Any]] = None
        
    @classmethod
    def get_instance(cls, env: Optional[str] = None) -> 'ConfigLoader':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls(env)
        return cls._instance
    
    def load(self, force_reload: bool = False) -> Dict[str, Any]:
        """
        Load and merge configs: base + environment-specific
        
        Args:
            force_reload: Force reload even if cached
            
        Returns:
            Merged configuration dictionary
        """
        if self._config is not None and not force_reload:
            return self._config
            
        try:
            # Load base config
            base = self._load_yaml('base.yaml')
            
            # Load environment-specific config
            env_file = f'{self.env}.yaml'
            env_config = self._load_yaml(env_file, required=False)
            
            # Load local overrides (git-ignored)
            local = self._load_yaml('local.yaml', required=False)
            
            # Deep merge: base <- env <- local
            config = self._deep_merge(base, env_config or {})
            if local:
                config = self._deep_merge(config, local)
            
            # Substitute environment variables
            config = self._substitute_env_vars(config)
            
            # Cache result
            self._config = config
            
            logger.info(f"Loaded configuration for environment: {self.env}")
            return config
            
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
            raise RuntimeError(f"Configuration loading failed: {e}")
    
    def _load_yaml(self, filename: str, required: bool = True) -> Optional[Dict[str, Any]]:
        """Load YAML file"""
        filepath = self.config_dir / filename
        
        if not filepath.exists():
            if required:
                raise FileNotFoundError(f"Required config file not found: {filepath}")
            return None
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            logger.error(f"Failed to parse YAML file {filepath}: {e}")
            raise
    
    def _deep_merge(self, base: Dict, override: Dict) -> Dict:
        """Deep merge two dictionaries"""
        result = base.copy()
        
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
                
        return result
    
    def _substitute_env_vars(self, obj: Any) -> Any:
        """
        Recursively substitute environment variables
        Supports: ${VAR_NAME:default_value}
        """
        if isinstance(obj, dict):
            return {k: self._substitute_env_vars(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._substitute_env_vars(item) for item in obj]
        elif isinstance(obj, str):
            return self._substitute_env_var(obj)
        else:
            return obj
    
    def _substitute_env_var(self, value: str) -> str:
        """Substitute single environment variable"""
        # Pattern: ${VAR_NAME:default}
        pattern = r'\$\{([A-Z_][A-Z0-9_]*):?([^}]*)\}'
        
        def replacer(match):
            var_name = match.group(1)
            default_value = match.group(2)
            return os.getenv(var_name, default_value)
        
        return re.sub(pattern, replacer, value)
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get config value by key"""
        config = self.load()
        keys = key.split('.')
        
        value = config
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return default
                
        return value if value is not None else default
    
    def get_service_config(self, service_name: str) -> ServiceConfig:
        """Get service configuration"""
        config = self.load()
        services = config.get('services', {})
        
        if service_name not in services:
            raise ValueError(f"Service '{service_name}' not found in configuration")
        
        service_data = services[service_name]
        
        try:
            return ServiceConfig(**service_data)
        except ValidationError as e:
            logger.error(f"Invalid service config for '{service_name}': {e}")
            raise
    
    def get_service_url(self, service_name: str) -> str:
        """Get full service URL"""
        service = self.get_service_config(service_name)
        base_path = service.base_path or ''
        return f"{service.protocol}://{service.host}:{service.port}{base_path}"
    
    def get_feature_flag(self, feature_name: str) -> bool:
        """Check if feature is enabled"""
        config = self.load()
        features = config.get('features', {})
        
        if feature_name not in features:
            return False
        
        feature = features[feature_name]
        if isinstance(feature, dict):
            return feature.get('enabled', False)
        return bool(feature)
    
    def get_all_services(self) -> Dict[str, ServiceConfig]:
        """Get all service configurations"""
        config = self.load()
        services = config.get('services', {})
        
        return {
            name: ServiceConfig(**data)
            for name, data in services.items()
        }


# Singleton instance
_config_loader: Optional[ConfigLoader] = None


def get_config_loader() -> ConfigLoader:
    """Get or create singleton ConfigLoader"""
    global _config_loader
    if _config_loader is None:
        _config_loader = ConfigLoader.get_instance()
    return _config_loader


# Convenience functions
def get_service_url(service_name: str) -> str:
    """Get service URL"""
    return get_config_loader().get_service_url(service_name)


def get_feature_flag(feature_name: str) -> bool:
    """Check if feature is enabled"""
    return get_config_loader().get_feature_flag(feature_name)


def get_config(key: str, default: Any = None) -> Any:
    """Get config value"""
    return get_config_loader().get(key, default)
