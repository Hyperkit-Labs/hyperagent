# Multi-stage build for x402 Verification Service
# Note: this repo is a monorepo; @hyperagent/env is a local package under packages/env.
# For Docker builds we use the repo root as the build context (see docker-compose.yml).
FROM node:22-alpine AS builder

WORKDIR /app

# Ensure tsc is available in the build stage
# Also force npm to include devDependencies in this build stage.
ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false
ENV NPM_CONFIG_OMIT=
RUN npm install -g typescript

# Copy local workspace package needed by this service
COPY packages/env packages/env
RUN cd packages/env && npm install

# Copy x402 verifier package files (do NOT copy package-lock to avoid npm trying to fetch @hyperagent/env from registry)
COPY services/x402-verifier/package.json services/x402-verifier/tsconfig.json ./services/x402-verifier/
COPY services/x402-verifier/src ./services/x402-verifier/src

WORKDIR /app/services/x402-verifier

# Install deps + build
RUN npm install --production=false
RUN npm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Copy local package again for file: dependency resolution
COPY packages/env packages/env
RUN cd packages/env && npm install --omit=dev

# Copy package files + built output
COPY services/x402-verifier/package.json ./services/x402-verifier/package.json
COPY --from=builder /app/services/x402-verifier/dist ./services/x402-verifier/dist

WORKDIR /app/services/x402-verifier

# Install production deps
RUN npm install --omit=dev

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start service
CMD ["node", "dist/index.js"]

