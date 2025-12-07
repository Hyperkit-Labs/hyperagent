# Dockerfile - Multi-stage build for HyperAgent
# Security: Updated to Python 3.12-slim for latest security patches
# Best Practice: Use specific tags (e.g., python:3.12-slim) instead of 'latest' for reproducibility
# Stage 1: Builder
FROM python:3.12-slim as builder

WORKDIR /build

# Install build dependencies including Node.js for solc
# Run apt-get upgrade to apply security patches
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x LTS and npm for solc (Solidity compiler)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    node --version && \
    npm --version

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --user --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --user -r requirements.txt

# Install solc-select and multiple Solidity compiler versions
# solc-select manages multiple Solidity compiler versions
# Note: In builder stage, packages are installed to /root/.local
# Create solc-select directory first (it will be created by solc-select, but ensure it exists)
RUN mkdir -p /root/.solc-select && \
    /root/.local/bin/solc-select install 0.8.20 && \
    /root/.local/bin/solc-select install 0.8.27 && \
    /root/.local/bin/solc-select install 0.8.30 && \
    /root/.local/bin/solc-select use 0.8.30 && \
    /root/.local/bin/solc --version || echo "solc-select installation completed"

# Also install solc versions via solcx (for py-solc-x compatibility)
RUN python3 -c "from solcx import install_solc; install_solc('0.8.20'); install_solc('0.8.27'); install_solc('0.8.30')" || echo "solcx install completed"

# Install global npm solc as fallback
RUN npm install -g solc@latest && \
    npx solcjs --version || echo "npm solc installation completed"

    # Install Hardhat and OpenZeppelin contracts
    # Create package.json for npm install
    RUN mkdir -p /build/node_modules && \
        cd /build && \
        npm init -y && \
        npm install --save-dev --legacy-peer-deps hardhat \
          @openzeppelin/contracts \
          @openzeppelin/contracts-upgradeable \
          @nomicfoundation/hardhat-chai-matchers \
          chai \
          ethereum-waffle \
          ethers \
          typechain \
          @typechain/hardhat \
          solidity-coverage \
          prettier prettier-plugin-solidity solhint \
          hardhat-contract-sizer \
          dotenv

# Stage 2: Runtime
# Updated to Python 3.12-slim for latest security patches
FROM python:3.12-slim

# Create non-root user for security
RUN groupadd -r hyperagent && useradd -r -g hyperagent hyperagent

WORKDIR /app

# Install runtime dependencies including Node.js
# Run apt-get upgrade to apply security patches
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    curl \
    postgresql-client \
    redis-tools \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /root/.local /home/hyperagent/.local

# Copy node_modules from builder (Hardhat and OpenZeppelin)
COPY --from=builder /build/node_modules /app/node_modules

# Copy solc-select directory from builder
# solc-select stores compiler versions in ~/.solc-select
COPY --from=builder /root/.solc-select /home/hyperagent/.solc-select

# Create .solcx directory for py-solc-x (if needed)
RUN mkdir -p /home/hyperagent/.solcx && \
    chown -R hyperagent:hyperagent /home/hyperagent/.solcx && \
    chmod -R 755 /home/hyperagent/.solcx

# Fix npm cache permissions (if directory exists)
RUN mkdir -p /home/hyperagent/.npm && \
    chown -R hyperagent:hyperagent /home/hyperagent/.npm && \
    chmod -R 755 /home/hyperagent/.npm || true

# Set proper permissions for solc-select directory
RUN chown -R hyperagent:hyperagent /home/hyperagent/.solc-select && \
    chmod -R 755 /home/hyperagent/.solc-select

# Set proper permissions for node_modules
RUN chown -R hyperagent:hyperagent /app/node_modules && \
    chmod -R 755 /app/node_modules

# Fix permissions and ensure PATH is correct
RUN chown -R hyperagent:hyperagent /home/hyperagent/.local && \
    chmod -R 755 /home/hyperagent/.local/bin || true

# Copy application code
COPY --chown=hyperagent:hyperagent hyperagent/ ./hyperagent/
COPY --chown=hyperagent:hyperagent alembic/ ./alembic/
COPY --chown=hyperagent:hyperagent alembic.ini .
COPY --chown=hyperagent:hyperagent pyproject.toml .
COPY --chown=hyperagent:hyperagent scripts/ ./scripts/
COPY --chown=hyperagent:hyperagent templates/ ./templates/

# Create logs directory
RUN mkdir -p /app/logs && chown -R hyperagent:hyperagent /app/logs

# Set environment variables
ENV PATH=/home/hyperagent/.local/bin:/usr/local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/home/hyperagent/.local/lib/python3.12/site-packages:/app \
    PYTHONHASHSEED=random \
    SOLC_VERSION=0.8.30 \
    NODE_PATH=/app/node_modules

# Switch to non-root user
USER hyperagent

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Expose ports
EXPOSE 8000

# Run application
CMD ["uvicorn", "hyperagent.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

