# HyperAgent Production Deployment Guide

Deployment guide for production environments with security, monitoring, and reliability best practices.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL 15+ with pgvector extension
- Redis 7+
- Python 3.10+
- Node.js 18+ (for x402 verification service)
- Required API keys (Gemini, OpenAI, Thirdweb, etc.)
- Blockchain RPC endpoints accessible
- Thirdweb account with ERC-4337 Smart Account (for x402 payments)

## Pre-Deployment Checklist

### 1. Environment Configuration

- [ ] Copy `env.example` to `.env.production`
- [ ] Fill in all required environment variables
- [ ] Verify all API keys are valid
- [ ] Set strong JWT secret key
- [ ] Configure CORS origins for production
- [ ] Enable rate limiting
- [ ] Set up secrets management (AWS Secrets Manager, Vault, etc.)

### 2. Security Hardening

- [ ] Review and update `.env.production` with production values
- [ ] Ensure private keys are stored securely (not in code)
- [ ] Enable authentication on all endpoints
- [ ] Configure rate limiting
- [ ] Set up SSL/TLS certificates
- [ ] Review firewall rules
- [ ] Enable security scanning in CI/CD

### 3. Database Setup

- [ ] Create production database
- [ ] Enable pgvector extension: `CREATE EXTENSION vector;`
- [ ] Run migrations: `alembic upgrade head`
- [ ] Set up database backups
- [ ] Configure connection pooling

### 4. x402 Service Setup (If Using x402 Payments)

- [ ] Create Thirdweb account at [portal.thirdweb.com](https://portal.thirdweb.com)
- [ ] Get Client ID and Secret Key from Thirdweb Dashboard
- [ ] Create ERC-4337 Smart Account in Server Wallets section
- [ ] Fund facilitator wallet with AVAX (for gas sponsorship)
- [ ] Set `THIRDWEB_SERVER_WALLET_ADDRESS` to ERC-4337 Smart Account address
- [ ] Set `MERCHANT_WALLET_ADDRESS` to receive payments
- [ ] Configure USDC addresses for target networks
- [ ] Verify x402 service: `python scripts/verify_x402_setup.py`

### 5. Infrastructure

- [ ] Set up PostgreSQL (managed service or self-hosted)
- [ ] Set up Redis (managed service or self-hosted)
- [ ] Set up x402 verification service (TypeScript service)
- [ ] Configure load balancer (if needed)
- [ ] Set up monitoring (Prometheus, Grafana)
- [ ] Configure logging aggregation

## x402 Service Deployment

### Setting Up x402 Payments

1. **Create Thirdweb Account**:
   - Go to [Thirdweb Dashboard](https://portal.thirdweb.com)
   - Log in with your wallet
   - Create a new project or use existing one
   - Get your Client ID and Secret Key

2. **Set Up Facilitator Wallet**:
   - Go to Server Wallets section
   - Enable "Show ERC-4337 Smart Account"
   - Switch to Avalanche Fuji Testnet (or Mainnet)
   - Copy the Smart Account address
   - This is your `THIRDWEB_SERVER_WALLET_ADDRESS`

3. **Fund Facilitator Wallet**:
   - Send AVAX to the Smart Account address
   - Minimum recommended: 0.1 AVAX for testnet, 1 AVAX for mainnet
   - Facilitator uses this to sponsor gas for users

4. **Configure Environment Variables**:
   ```bash
   X402_ENABLED=true
   THIRDWEB_CLIENT_ID=your_client_id
   THIRDWEB_SECRET_KEY=your_secret_key
   THIRDWEB_SERVER_WALLET_ADDRESS=0x... # ERC-4337 Smart Account
   MERCHANT_WALLET_ADDRESS=0x... # Receives x402 payments
   USDC_ADDRESS_FUJI=0x5425890298aed601595a70AB815c96711a31Bc65
   USDC_ADDRESS_AVALANCHE=0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E
   ```

5. **Start x402 Verification Service**:
   ```bash
   # Included in docker-compose.yml
   docker-compose up -d x402-verifier
   
   # Or manually
   cd services/x402-verifier
   npm install
   npm start
   ```

6. **Verify Setup**:
   ```bash
   python scripts/verify_x402_setup.py
   ```

### Important Notes

- **ERC-4337 Required**: Facilitator must be ERC-4337 Smart Account (not EOA)
- **Network Support**: x402 payments only work on Avalanche networks currently
- **Gas Sponsorship**: Facilitator wallet must be funded with AVAX
- **Payment Recipient**: Merchant wallet receives USDC payments from users

## Deployment Methods

### Method 1: Docker Compose (Recommended for Single Server)

```bash
# 1. Clone repository
git clone https://github.com/yourusername/hyperagent.git
cd hyperagent

# 2. Configure environment
cp env.example .env.production
# Edit .env.production with production values

# 3. Build and deploy
docker-compose -f docker-compose.production.yml up -d

# 4. Run migrations
docker-compose exec hyperagent alembic upgrade head

# 5. Verify x402 setup (if using x402 payments)
docker-compose exec hyperagent python scripts/verify_x402_setup.py

# 6. Verify deployment
curl http://localhost:8000/api/v1/health
```

### Method 2: Production Deployment Script

```bash
# Run automated deployment script
python scripts/deploy_production.py --environment production

# Script performs:
# - Pre-flight checks
# - Database migrations
# - Application deployment
# - Health verification
```

### Method 3: Kubernetes (For Scalability)

```yaml
# Example Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hyperagent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hyperagent
  template:
    metadata:
      labels:
        app: hyperagent
    spec:
      containers:
      - name: hyperagent
        image: ghcr.io/yourusername/hyperagent:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: hyperagent-secrets
              key: database-url
```

## Post-Deployment

### 1. Verify Deployment

```bash
# Health check
curl https://your-domain.com/api/v1/health

# Metrics endpoint
curl https://your-domain.com/api/v1/metrics/prometheus

# Test workflow creation
curl -X POST https://your-domain.com/api/v1/workflows/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"nlp_input": "Test contract", "network": "hyperion_testnet"}'
```

### 2. Monitoring Setup

- Configure Prometheus to scrape `/api/v1/metrics/prometheus`
- Set up Grafana dashboards
- Configure alerting rules
- Set up log aggregation

### 3. Backup Configuration

```bash
# Create initial backup
python scripts/backup_database.py backup

# Schedule automated backups (cron)
0 2 * * * /path/to/scripts/backup_database.py backup

# List backups
python scripts/backup_database.py list

# Cleanup old backups
python scripts/backup_database.py cleanup --keep-days 30
```

## Maintenance

### Database Migrations

```bash
# Check current migration version
alembic current

# Apply new migrations
alembic upgrade head

# Rollback if needed
alembic downgrade -1
```

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild Docker image
docker-compose build

# Restart services
docker-compose up -d

# Run migrations
docker-compose exec hyperagent alembic upgrade head
```

### Monitoring

- Monitor API response times
- Track error rates
- Monitor database connections
- Watch Redis memory usage
- Monitor blockchain RPC latency

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Verify network connectivity
   - Check firewall rules

2. **Redis Connection Failed**
   - Verify REDIS_URL
   - Check Redis service status
   - Verify network access

3. **LLM API Errors**
   - Verify API keys are valid
   - Check API rate limits
   - Monitor API quota usage

4. **Deployment Health Check Fails**
   - Check application logs
   - Verify all services are running
   - Check environment variables

## Security Best Practices

1. **Secrets Management**
   - Never commit secrets to version control
   - Use environment variables or secrets managers
   - Rotate secrets regularly

2. **Network Security**
   - Use HTTPS/TLS for all connections
   - Restrict database access to application servers
   - Use VPN or private networks when possible

3. **Access Control**
   - Implement role-based access control
   - Use strong authentication
   - Enable rate limiting
   - Monitor for suspicious activity

4. **Regular Updates**
   - Keep dependencies updated
   - Apply security patches promptly
   - Monitor security advisories

## Disaster Recovery

### Backup Strategy

- Daily database backups
- Weekly full system backups
- Off-site backup storage
- Test restore procedures regularly

### Recovery Procedures

```bash
# Restore from backup
python scripts/backup_database.py restore --file backups/hyperagent_backup_20250101_120000.sql.gz

# Verify restore
alembic current
# Check data integrity
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/hyperagent/issues
- Documentation: https://docs.hyperagent.dev
- Email: support@hyperagent.dev

