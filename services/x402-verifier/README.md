# x402 Payment Verification Service

TypeScript service that wraps Thirdweb's x402 facilitator for payment verification. This service is called by the Python FastAPI backend to verify x402 payments.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment (single root .env)

This repo uses a single root `.env` shared across services.

```bash
# From repo root
cp .env.example .env
```

Set at minimum:
- `THIRDWEB_SECRET_KEY`
- `THIRDWEB_SERVER_WALLET_ADDRESS`
- `MERCHANT_WALLET_ADDRESS`

The verifier service loads the repo-root `.env` automatically via `@hyperagent/env`.

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
npm start
```

## API Endpoints

### POST /settle-payment

Verifies and settles x402 payment.

**Request:**
```json
{
  "resourceUrl": "https://api.example.com/endpoint",
  "method": "POST",
  "paymentData": "{...}",
  "payTo": "0x...",
  "network": "avalanche_fuji",
  "price": "$1.00",
  "routeConfig": {
    "description": "API endpoint",
    "mimeType": "application/json",
    "maxTimeoutSeconds": 300
  }
}
```

**Response (200):**
```json
{
  "status": 200,
  "verified": true,
  "message": "Payment verified and settled"
}
```

**Response (402):**
```json
{
  "status": 402,
  "verified": false,
  "responseBody": {...},
  "responseHeaders": {...}
}
```

### GET /health

Health check endpoint.

## Docker

```bash
docker build -t x402-verifier .
docker run -p 3001:3001 --env-file .env x402-verifier
```

