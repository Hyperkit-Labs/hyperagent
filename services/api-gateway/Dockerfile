FROM node:20-alpine AS builder

WORKDIR /app

# Ensure tsc is available even if npm devDependency install is impacted by global npm config.
# Also force npm to include devDependencies in this build stage.
ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false
ENV NPM_CONFIG_OMIT=
RUN npm install -g typescript

# Copy local workspace package needed by ts/api
COPY packages/env packages/env

# Copy orchestrator package (workspace dependency)
COPY ts/orchestrator/package.json ts/orchestrator/tsconfig.json ts/orchestrator/
COPY ts/orchestrator/src ts/orchestrator/src

# Copy API package
COPY ts/api/package.json ts/api/tsconfig.json ts/api/
COPY ts/api/src ts/api/src

# Install dependencies and build
WORKDIR /app/ts/orchestrator
# Force devDependencies to be installed even if NODE_ENV/npm config defaults to production.
RUN npm install --production=false && npm run build
# Prune to production deps; avoids lifecycle scripts in the runtime stage.
RUN npm prune --omit=dev --ignore-scripts

WORKDIR /app/ts/api
RUN npm install --production=false && npm run build
RUN npm prune --omit=dev --ignore-scripts

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy local workspace package with its node_modules
COPY --from=builder /app/packages/env ./packages/env

# Copy built artifacts and node_modules from builder
COPY --from=builder /app/ts/api/dist ./api/dist
COPY --from=builder /app/ts/api/package.json ./api/
COPY --from=builder /app/ts/api/node_modules ./api/node_modules
COPY --from=builder /app/ts/orchestrator/dist ./orchestrator/dist
COPY --from=builder /app/ts/orchestrator/package.json ./orchestrator/
COPY --from=builder /app/ts/orchestrator/node_modules ./orchestrator/node_modules

WORKDIR /app/api

EXPOSE 4000

CMD ["node", "dist/server.js"]

