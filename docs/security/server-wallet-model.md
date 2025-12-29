# Server-Wallet Security Model

This document provides complete transparency about HyperAgent's server-wallet deployment model, security practices, and limitations.

## Overview

HyperAgent uses a **facilitator-sponsored gas model** where:
- Users pay a service fee in USDC
- HyperAgent's server wallet pays network gas
- Users receive full ownership of deployed contracts

This model eliminates the need for users to own native gas tokens while maintaining contract ownership.

---

## Architecture

```
User Wallet
    ↓ (Signs USDC payment: 0.10 USDC)
X402 Payment Verification
    ↓ (Payment confirmed)
HyperAgent Server Wallet
    ↓ (Signs deployment transaction)
    ↓ (Pays network gas: ~0.05 AVAX)
Blockchain
    ↓ (Contract deployed)
User Receives Contract Address
    ↓ (Full ownership transferred)
```

---

## Server Wallet Details

### Avalanche Fuji Testnet

- **Address**: `0xa98107Fe1fEb5606B5163479e1b9B868234AdEE2`
- **Purpose**: Deploy contracts on behalf of users after payment verification
- **Network**: Avalanche Fuji Testnet (Chain ID: 43113)
- **Funded By**: HyperAgent team

### Avalanche Mainnet

- **Address**: Coming soon
- **Network**: Avalanche C-Chain (Chain ID: 43114)

You can verify all deployments from these addresses on [Snowtrace](https://testnet.snowtrace.io).

---

## Key Management

### Development

Server wallet private key is stored in environment variables encrypted with:
- AES-256 encryption
- Fernet symmetric encryption
- SHA-256 key derivation

### Production

Server wallet private key is stored in:
- **AWS Secrets Manager** (Primary)
- **HashiCorp Vault** (Backup)

Key rotation:
- Every 90 days automatically
- Immediately upon suspected compromise
- New server wallet address published in docs

---

## Security Controls

### Rate Limiting

To prevent abuse and manage gas costs:

| Limit Type | Threshold | Window |
|---|---|---|
| Per Wallet | 10 deployments | 1 hour |
| Per Network | 100 deployments | 1 hour |

Rate limits are enforced using Redis with sliding window counters.

### Audit Logging

Every deployment is logged to the `deployment_audits` table:

```sql
CREATE TABLE deployment_audits (
    id UUID PRIMARY KEY,
    deployment_id UUID,
    user_wallet VARCHAR(42),
    server_wallet VARCHAR(42),
    deployment_method VARCHAR(20),
    network VARCHAR(50),
    payment_tx_hash VARCHAR(66),
    deployment_tx_hash VARCHAR(66) UNIQUE,
    contract_address VARCHAR(42),
    gas_used VARCHAR(50),
    gas_paid_by_server VARCHAR(50),
    gas_price_gwei VARCHAR(50),
    timestamp TIMESTAMP
);
```

Audit logs are:
- Immutable (append-only)
- Retained for 7 years
- Accessible to compliance teams
- Backed up daily

### Payment Verification

X402 payments are verified before deployment:
1. User signs USDC transfer authorization
2. Thirdweb facilitator simulates payment
3. Payment is settled on-chain
4. Only after success, deployment proceeds

If payment fails, no deployment occurs.

### Gas Price Monitoring

Server wallet monitors gas prices:
- Deployment paused if gas > 100 gwei
- Alert sent to ops team
- Resume when gas < 50 gwei

This prevents excessive costs during network congestion.

---

## Limitations and Risks

### Centralization Risk

**Risk**: Server wallet holds private key. If compromised, attacker could:
- Deploy unauthorized contracts (but NOT control user contracts)
- Drain server wallet funds (but NOT user funds)

**Mitigation**:
- Private key in AWS Secrets Manager
- Multi-factor authentication required
- Automated key rotation every 90 days
- Monitoring for unauthorized deployments
- Rate limiting prevents mass deployment

### Single Point of Failure

**Risk**: If server wallet runs out of gas, deployments fail.

**Mitigation**:
- Automated funding: top-up when balance < 10 AVAX
- Multiple backup wallets ready
- Real-time balance monitoring
- Alerts to ops team

### Regulatory Compliance

**Risk**: Server wallet may be considered a custodial service in some jurisdictions.

**Status**:
- Legal review completed
- Classified as "infrastructure provider," not custodian
- User contracts are user-owned, not custodial
- USDC payments are service fees, not held

### Contract Ownership Transfer

**Important**: While server wallet deploys the contract, ownership is immediately transferred to the user.

Verify ownership on-chain:
```solidity
// Most contracts have:
function owner() public view returns (address)

// Check that owner == your wallet address
// NOT the server wallet address
```

---

## Third-Party Audits

### Current Status

- **Internal Security Review**: Completed
- **External Smart Contract Audit**: Scheduled Q1 2025
- **Penetration Testing**: Scheduled Q1 2025

### Audit Reports

Once completed, full audit reports will be published at:
- `docs/security/audits/`
- Public GitHub repository

---

## Incident Response

### In Case of Compromise

If server wallet is compromised:

1. **Immediate**:
   - Pause all deployments
   - Rotate private key
   - Deploy new server wallet
   - Alert all users via email/Discord

2. **Within 24 hours**:
   - Publish incident report
   - Investigate impact
   - Notify affected users
   - Refund any failed payments

3. **Within 7 days**:
   - Complete forensic analysis
   - Implement additional controls
   - Publish post-mortem

### Reporting Security Issues

If you discover a security vulnerability:

**DO NOT** open a public GitHub issue.

Instead:
1. Email: security@hyperagent.xyz
2. Use PGP key: [hyperagent-security.asc](../keys/hyperagent-security.asc)
3. Include: description, impact, reproduction steps

Bug bounty rewards:
- **Critical**: $5,000 - $10,000
- **High**: $1,000 - $5,000
- **Medium**: $500 - $1,000
- **Low**: $100 - $500

---

## Future Improvements

### V2: User-Signed Deployment (ERC-4337)

Target: Q2 2025

Users will be able to sign deployment transactions themselves while HyperAgent sponsors gas via ERC-4337 Account Abstraction.

Benefits:
- User signs deployment (full non-custodial)
- Server only sponsors gas (paymaster)
- No centralized signer
- Same "zero gas token" UX

### V3: Multi-Sig Server Wallet

Target: Q3 2025

Server wallet becomes a multi-sig requiring:
- 3 of 5 signatures to deploy
- Hardware wallet security
- Geographic distribution of signers

---

## Compliance

### Data Retention

Deployment audit logs retained for:
- **Operational**: 90 days (hot storage)
- **Compliance**: 7 years (cold storage)
- **Backups**: 30 days rolling

### GDPR Compliance

Wallet addresses are pseudonymous identifiers:
- Not considered personally identifiable information (PII)
- No email or name collection required
- Right to erasure: audit logs anonymized after 7 years

### AML/KYC

Server wallet model does NOT require KYC because:
- Users deploy their own contracts
- USDC payments are service fees
- No custody of user assets
- No fiat on/off ramp

---

## Transparency Commitments

HyperAgent commits to:
- Publishing server wallet addresses publicly
- Real-time deployment monitoring dashboard
- Monthly security reports
- Open-source core components (coming soon)
- Third-party audit reports

---

## Questions?

For security-related questions:
- **Email**: security@hyperagent.xyz
- **Discord**: #security channel
- **Bug Bounty**: [Report vulnerabilities](../security/bug-bounty.md)

For general questions:
- **Email**: support@hyperagent.xyz
- **Documentation**: [Full docs](https://docs.hyperagent.xyz)

