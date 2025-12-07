# Under the Hood: How HyperAgent Manages Settings

## Overview

HyperAgent uses Pydantic Settings to load configuration from environment variables and `.env` files, with validation and type conversion.

## Diagram

```mermaid
flowchart TD
    START[HyperAgent Startup]
    
    subgraph "Configuration Sources"
        ENV[Environment Variables<br/>System/Shell Environment]
        ENV_FILE[.env File<br/>Project Root Directory]
        DEFAULTS[Default Values<br/>Hardcoded in Settings Class]
    end

    subgraph "Pydantic Settings Loading"
        BASE[BaseSettings Class<br/>Pydantic Settings]
        VALIDATOR[Field Validators<br/>Type Conversion<br/>Value Validation]
        MERGE[Merge Strategy<br/>Priority: ENV > .env > Defaults]
    end

    subgraph "Settings Class"
        SETTINGS[Settings Instance<br/>All configuration values<br/>Validated and typed]
    end

    subgraph "Configuration Categories"
        APP[Application Settings<br/>app_name, version, log_level]
        DB[Database Settings<br/>database_url, supabase_url]
        REDIS[Redis Settings<br/>redis_url, password]
        LLM[LLM Settings<br/>gemini_api_key, model, timeout]
        BC[Blockchain Settings<br/>RPC URLs, chain IDs]
        API[API Settings<br/>host, port, cors_origins]
        FEATURES[Feature Flags<br/>enable_websocket, skip_audit]
    end

    START --> BASE
    ENV --> BASE
    ENV_FILE --> BASE
    DEFAULTS --> BASE
    
    BASE --> VALIDATOR
    VALIDATOR --> MERGE
    MERGE --> SETTINGS
    
    SETTINGS --> APP
    SETTINGS --> DB
    SETTINGS --> REDIS
    SETTINGS --> LLM
    SETTINGS --> BC
    SETTINGS --> API
    SETTINGS --> FEATURES

    subgraph "Validation Examples"
        V1[Boolean Parsing<br/>'true', '1', 'yes' → True<br/>'false', '0', 'no' → False]
        V2[URL Validation<br/>database_url format check]
        V3[Model Validation<br/>gemini_model in allowed list]
        V4[Range Validation<br/>thinking_budget: 1-1000]
    end

    VALIDATOR --> V1
    VALIDATOR --> V2
    VALIDATOR --> V3
    VALIDATOR --> V4
```

## Configuration Loading Flow

### 1. Startup Sequence
```python
# When HyperAgent starts
from hyperagent.core.config import settings

# Pydantic automatically loads:
# 1. Environment variables (highest priority)
# 2. .env file (if exists)
# 3. Default values (lowest priority)
```

### 2. Settings Class Definition
```python
class Settings(BaseSettings):
    # Application Settings
    app_name: str = "HyperAgent"  # Default value
    app_version: str = "1.0.0"
    
    # Database (with validator)
    database_url: Optional[str] = None
    
    @field_validator('database_url', mode='before')
    @classmethod
    def set_database_url_default(cls, v):
        if v is None or v == "":
            return "postgresql://user:pass@postgres:5432/db"
        return v
    
    # LLM (required, no default)
    gemini_api_key: str  # Must be provided
    
    # Boolean parsing
    enable_websocket: Union[bool, str] = True
    
    @field_validator('enable_websocket', mode='before')
    @classmethod
    def parse_bool(cls, v):
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ('true', '1', 'yes', 'on')
        return False
```

### 3. Environment Variable Loading
```bash
# .env file example
GEMINI_API_KEY=your_api_key_here
DATABASE_URL=postgresql://user:pass@localhost:5432/hyperagent_db
REDIS_URL=redis://localhost:6379/0
ENABLE_WEBSOCKET=true
GEMINI_MODEL=gemini-2.5-flash
```

### 4. Priority Order
1. **Environment Variables** (highest priority)
   - System environment variables
   - Shell environment variables
   - Override everything

2. **`.env` File** (medium priority)
   - Project root `.env` file
   - Loaded automatically by Pydantic

3. **Default Values** (lowest priority)
   - Hardcoded in Settings class
   - Used if not provided elsewhere

## Field Validators

### Boolean Parsing
```python
# Handles string to boolean conversion
'enable_websocket=true' → True
'ENABLE_WEBSOCKET=1' → True
'ENABLE_WEBSOCKET=yes' → True
'enable_websocket=false' → False
```

### URL Defaults
```python
# Sets default database URL if not provided
# Useful for Docker Compose setups
database_url = None → "postgresql://user:pass@postgres:5432/db"
```

### Model Validation
```python
# Validates Gemini model name
@field_validator('gemini_model')
def validate_gemini_model(cls, v):
    valid_models = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite"
    ]
    if v not in valid_models:
        raise ValueError(f"Invalid model: {v}")
    return v
```

### Range Validation
```python
# Validates thinking budget range
@field_validator('gemini_thinking_budget')
def validate_thinking_budget(cls, v):
    if v is not None:
        v = int(v)
        if not (1 <= v <= 1000):
            raise ValueError("thinking_budget must be 1-1000")
    return v
```

## Configuration Access

### Global Settings Instance
```python
from hyperagent.core.config import settings

# Access any setting
api_url = f"http://{settings.api_host}:{settings.api_port}"
llm_provider = GeminiProvider(settings.gemini_api_key)
redis_client = redis.from_url(settings.redis_url)
```

### Type Safety
- All settings are typed
- Pydantic validates types at load time
- IDE autocomplete works
- Runtime type errors prevented

## Configuration Categories

### Application Settings
- `app_name`, `app_version`
- `log_level`, `node_env`, `debug`

### Database Settings
- `database_url` (PostgreSQL)
- `supabase_url`, `supabase_anon_key` (optional)

### Redis Settings
- `redis_url`, `redis_password`

### LLM Settings
- `gemini_api_key` (required)
- `gemini_model`, `gemini_thinking_budget`
- `openai_api_key` (optional)
- `llm_timeout_seconds`

### Blockchain Settings
- `hyperion_testnet_rpc`, `hyperion_testnet_chain_id`
- `mantle_testnet_rpc`, `mantle_testnet_chain_id`

### API Settings
- `api_host`, `api_port`, `api_workers`
- `cors_origins`

### Feature Flags
- `enable_websocket`, `enable_rate_limiting`
- `skip_audit`, `skip_testing`, `skip_deployment`

## Benefits

- **Type Safety**: Pydantic validates all values
- **Flexibility**: Multiple configuration sources
- **Priority System**: Clear override hierarchy
- **Validation**: Automatic type conversion and validation
- **Default Values**: Sensible defaults for development
- **Environment-Specific**: Easy to configure per environment

