FROM node:20-alpine AS builder

WORKDIR /app

# Copy orchestrator package (workspace dependency)
COPY ts/orchestrator/package.json ts/orchestrator/tsconfig.json ts/orchestrator/
COPY ts/orchestrator/src ts/orchestrator/src

# Copy API package
COPY ts/api/package.json ts/api/tsconfig.json ts/api/
COPY ts/api/src ts/api/src

# Install dependencies and build
WORKDIR /app/ts/orchestrator
RUN npm install && npm run build

WORKDIR /app/ts/api
RUN npm install && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/ts/orchestrator/dist ./orchestrator/dist
COPY --from=builder /app/ts/orchestrator/package.json ./orchestrator/
COPY --from=builder /app/ts/api/dist ./api/dist
COPY --from=builder /app/ts/api/package.json ./api/

# Install production dependencies
WORKDIR /app/orchestrator
RUN npm install --production

WORKDIR /app/api
RUN npm install --production

WORKDIR /app/api

EXPOSE 4000

CMD ["node", "dist/server.js"]

