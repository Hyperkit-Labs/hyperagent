# Primary backend image for CI/CD. Builds orchestrator (main API).
# For full stack, use docker-compose.yml which builds all services.
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

COPY packages/execution-backend ./packages/execution-backend
COPY services/orchestrator/requirements.txt ./services/orchestrator/
WORKDIR /app/services/orchestrator
RUN pip install --no-cache-dir -e ../../packages/execution-backend -r requirements.txt

RUN mkdir -p /app/services/orchestrator/data \
    && git clone --depth 1 --branch V6.0 https://github.com/sujeetc/SCRUBD /app/services/orchestrator/data/SCRUBD || true

COPY services/orchestrator .
WORKDIR /app/services/orchestrator
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
