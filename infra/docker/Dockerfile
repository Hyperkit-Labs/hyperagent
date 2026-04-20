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

COPY services/orchestrator .
WORKDIR /app/services/orchestrator
ARG SCRUBD_GIT_SHA=9dba1928d4aea9a5d27014e5f31a8ed0b703f711
RUN mkdir -p data/SCRUBD \
    && git init data/SCRUBD \
    && git -C data/SCRUBD remote add origin https://github.com/sujeetc/SCRUBD.git \
    && git -C data/SCRUBD fetch --depth 1 origin ${SCRUBD_GIT_SHA} \
    && git -C data/SCRUBD checkout FETCH_HEAD
RUN useradd --system --uid 10001 --no-create-home appuser \
    && chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
