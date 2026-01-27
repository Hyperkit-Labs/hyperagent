"""Application configuration management"""

from typing import Optional, Union

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with validation"""

    # Application Settings
    app_name: str = "HyperAgent"
    app_version: str = "1.0.0"
    log_level: str = "INFO"
    node_env: str = "development"
    debug: Union[bool, str] = False

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, v):
        """Parse debug from string to boolean"""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes", "on")
        return False

    # Database
    database_url: Optional[str] = None
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_password: Optional[str] = None  # Supabase database password

    @field_validator("database_url", mode="before")
    @classmethod
    def set_database_url_default(cls, v, info):
        """Set default DATABASE_URL if not provided

        Priority:
        1. Use provided DATABASE_URL
        2. Try Supabase if SUPABASE_URL is set (production)
        3. Fallback to Docker Compose default (development)
        """
        if v is None or v == "":
            # Try Supabase first (production) - check environment variables directly
            import os

            supabase_url = os.getenv("SUPABASE_URL") or os.getenv("supabase_url")
            supabase_password = os.getenv("SUPABASE_PASSWORD") or os.getenv("supabase_password")

            if supabase_url and supabase_password:
                # Construct Supabase connection string
                # Format: postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
                supabase_host = supabase_url.replace("https://", "").replace("http://", "")
                return f"postgresql://postgres:{supabase_password}@{supabase_host}:5432/postgres"
            # Fallback to Docker Compose default (development)
            return "postgresql://hyperagent_user:secure_password@postgres:5432/hyperagent_db"
        return v

    # Redis - Optional (uses in-memory fallback if not available)
    redis_url: Optional[str] = None  # None = use in-memory fallback
    redis_password: Optional[str] = None

    # LLM
    gemini_api_key: Optional[str] = ""  # Optional - at least one LLM API key required
    gemini_model: str = (
        "gemini-2.5-flash"  # Options: gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.0-flash, gemini-2.0-flash-lite
    )
    gemini_thinking_budget: Optional[int] = (
        None  # Optional thinking budget (1-1000) for Gemini 2.5 Flash models
    )
    openai_api_key: Optional[str] = ""
    openai_model: str = "gpt-4o"  # Updated to GPT-4o
    anthropic_api_key: Optional[str] = ""
    claude_api_key: Optional[str] = ""
    firecrawl_api_key: Optional[str] = ""
    pinecone_api_key: Optional[str] = ""
    pinecone_index_name: str = "hyperkit-docs"
    guardian_model_url: Optional[str] = ""
    guardian_model_api_key: Optional[str] = ""
    attestation_contract_address: Optional[str] = ""
    mlflow_tracking_uri: str = "http://localhost:5000"
    dune_api_key: Optional[str] = ""
    dune_mantle_query_id: Optional[int] = 6388392
    dune_tvl_query_ethereum: Optional[int] = None
    dune_tvl_query_polygon: Optional[int] = None
    dune_tvl_query_avalanche: Optional[int] = None
    dune_tvl_query_mantle: Optional[int] = None
    dune_gas_savings_query: Optional[int] = None
    dune_revenue_query: Optional[int] = None
    moralis_api_key: Optional[str] = ""
    moralis_webhook_url: Optional[str] = ""
    
    # Secrets Management
    secrets_mode: str = Field(default="env")  # env, aws, vault
    aws_secrets_region: Optional[str] = None
    vault_url: Optional[str] = None
    
    # Rate Limiting
    deployment_rate_limit_per_wallet: int = Field(default=10)
    deployment_rate_limit_per_network: int = Field(default=100)
    
    # ERC-4337 Paymaster
    x402_paymaster_service_url: str = "http://x402-verifier:3001"
    entrypoint_address: str = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"  # EntryPoint v0.6
    factory_address: str = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"  # Smart Account Factory

    # Acontext AI Memory API
    acontext_url: Optional[str] = ""  # Acontext API base URL
    acontext_api_key: Optional[str] = ""  # Acontext API key
    enable_acontext: Union[bool, str] = False  # Enable Acontext memory integration

    # LLM Timeout Settings
    llm_timeout_seconds: int = (
        120  # Timeout for general LLM API calls (increased for contract generation)
    )
    llm_constructor_timeout_seconds: int = (
        20  # Timeout for constructor value generation (shorter for simpler task)
    )
    llm_embed_timeout_seconds: int = 10  # Timeout for embedding generation

    # IPFS/Pinata
    pinata_jwt: Optional[str] = ""
    pinata_gateway: Optional[str] = "https://gateway.pinata.cloud"
    enable_ipfs_upload: Union[bool, str] = True
    ipfs_verify_integrity: Union[bool, str] = True

    @field_validator("enable_ipfs_upload", "ipfs_verify_integrity", mode="before")
    @classmethod
    def parse_ipfs_bool(cls, v):
        """Parse IPFS boolean settings"""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes", "on")
        return False

    # Blockchain Networks
    mantle_testnet_rpc: str = "https://rpc.sepolia.mantle.xyz"
    mantle_testnet_chain_id: int = 5003

    # Avalanche Networks
    avalanche_fuji_rpc: str = "https://api.avax-test.network/ext/bc/C/rpc"
    avalanche_fuji_chain_id: int = 43113
    avalanche_mainnet_rpc: str = "https://api.avax.network/ext/bc/C/rpc"
    avalanche_mainnet_chain_id: int = 43114

    # Thirdweb Configuration
    thirdweb_client_id: Optional[str] = ""
    thirdweb_secret_key: Optional[str] = ""
    thirdweb_server_wallet_address: Optional[str] = ""  # ERC-4337 facilitator wallet address
    thirdweb_server_wallet_private_key: Optional[str] = (
        ""  # Facilitator wallet private key (if EOA)
    )
    merchant_wallet_address: Optional[str] = ""  # HyperKit treasury

    # x402 Configuration
    x402_enabled: Union[bool, str] = False
    x402_service_url: str = "http://localhost:3002"  # TypeScript x402 verification service
    x402_enabled_networks: str = (
        "avalanche_fuji,avalanche_mainnet"  # Comma-separated list of networks supporting x402
    )

    # Mantle Bridge Service
    mantle_bridge_service_url: Optional[str] = (
        "http://localhost:3002"  # TypeScript Mantle SDK bridge service
    )

    # Network-specific USDC addresses are now loaded from config/tokens.yaml
    # Use: from hyperagent.core.config_loader import get_token_address
    #      usdc_address = get_token_address("usdc", "avalanche_mainnet")

    # x402 Price Tiers are now loaded from config/pricing.yaml
    # Use: from hyperagent.core.config_loader import get_contract_price, get_workflow_price
    #      price = get_contract_price("ERC20") or get_workflow_price("advanced")

    # EigenDA Configuration
    eigenda_disperser_url: str = "https://disperser.eigenda.xyz"  # Mainnet
    eigenda_use_authenticated: Union[bool, str] = True  # Use authenticated endpoint

    # Security & Wallet
    # Note: PRIVATE_KEY is optional - only needed for:
    # 1. Non-x402 deployments (legacy networks like Mantle)
    # 2. Server-side operations (EigenDA, etc.)
    # For x402 networks, users sign transactions in their wallets (no PRIVATE_KEY needed)
    private_key: Optional[str] = ""
    public_address: Optional[str] = ""

    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_workers: int = 4
    
    @property
    def api_url(self) -> str:
        """Get the full API URL"""
        host = "localhost" if self.api_host == "0.0.0.0" else self.api_host
        return f"http://{host}:{self.api_port}"
    cors_origins: str = (
        "*"  # Can be overridden with comma-separated list: "http://localhost:3000,http://localhost:3001"
    )

    # Monitoring & Observability
    enable_metrics: Union[bool, str] = True
    metrics_port: int = 9090
    log_format: str = "json"
    log_file: str = "logs/hyperagent.log"

    # Feature Flags
    enable_websocket: Union[bool, str] = True
    enable_rate_limiting: Union[bool, str] = False
    enable_authentication: Union[bool, str] = False

    # Development Settings
    skip_audit: Union[bool, str] = False
    skip_testing: Union[bool, str] = False
    skip_deployment: Union[bool, str] = False

    # Workflow Settings
    max_retries: int = 3
    retry_backoff_base: int = 2  # Exponential backoff base (2^attempt seconds)

    # Template Settings
    template_cache_ttl: int = 3600  # Cache TTL in seconds
    template_batch_size: int = 10  # Batch size for bulk operations

    # Test Framework Configuration
    enable_foundry: Union[bool, str] = False  # Set to true to install Foundry in Docker
    test_framework_auto_detect: Union[bool, str] = True  # Auto-detect Hardhat vs Foundry

    # Deployment Validation
    enable_deployment_validation: Union[bool, str] = (
        True  # Validate RPC and wallet before deployment
    )
    min_wallet_balance_eth: float = 0.001  # Minimum balance required (in ETH)

    @field_validator(
        "enable_metrics",
        "enable_websocket",
        "enable_rate_limiting",
        "enable_authentication",
        "skip_audit",
        "skip_testing",
        "skip_deployment",
        "eigenda_use_authenticated",
        "enable_foundry",
        "test_framework_auto_detect",
        "enable_deployment_validation",
        "x402_enabled",
        mode="before",
    )
    @classmethod
    def parse_bool(cls, v):
        """Parse boolean from string"""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes", "on")
        return False

    # JWT Configuration
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    # API Keys (comma-separated for multiple keys)
    api_keys: Optional[str] = None

    # Mantle SDK Configuration
    use_mantle_sdk: Union[bool, str] = False  # Use Mantle SDK if available

    @field_validator("use_mantle_sdk", mode="before")
    @classmethod
    def parse_use_mantle_sdk(cls, v):
        """Parse use_mantle_sdk from string to boolean"""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes", "on")
        return False

    @field_validator("gemini_model", mode="before")
    @classmethod
    def validate_gemini_model(cls, v):
        """Validate Gemini model name"""
        valid_models = [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ]
        if v not in valid_models:
            raise ValueError(f"Invalid gemini_model: {v}. Must be one of {valid_models}")
        return v

    @field_validator("gemini_thinking_budget", mode="before")
    @classmethod
    def validate_thinking_budget(cls, v):
        """Validate thinking budget range"""
        if v is None or v == "":
            return None
        try:
            v = int(v)
            if not (1 <= v <= 1000):
                raise ValueError("gemini_thinking_budget must be between 1 and 1000")
            return v
        except (ValueError, TypeError):
            return None

    @field_validator(
        "dune_tvl_query_ethereum",
        "dune_tvl_query_polygon",
        "dune_tvl_query_avalanche",
        "dune_tvl_query_mantle",
        "dune_gas_savings_query",
        "dune_revenue_query",
        mode="before",
    )
    @classmethod
    def parse_dune_query_id(cls, v):
        """Parse Dune query ID from string to int, handling empty strings"""
        if v is None or v == "":
            return None
        try:
            return int(v)
        except (ValueError, TypeError):
            return None

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",  # Ignore extra fields in .env that aren't defined here
    )


settings = Settings()
