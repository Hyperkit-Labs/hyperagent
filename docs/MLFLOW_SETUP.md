# MLflow Setup Guide

## What is MLflow?

MLflow is an **open-source platform** for managing the machine learning lifecycle. In HyperAgent, it's used to:

- **Track build metrics**: latency, credits used, success rates, gas usage
- **Log parameters**: prompts, chains, models used
- **Store experiment history**: compare different builds and models
- **Export to Prometheus**: for monitoring dashboards

## Is MLflow Required?

**No, MLflow is optional.** The code gracefully degrades if MLflow is unavailable:
- Builds will still work normally
- Metrics will still be exported to Prometheus
- Only MLflow-specific tracking will be skipped

## Deployment Options

### Option 1: Local Docker Service (Recommended for Development)

Already configured in `docker-compose.yml`. Start with:

```bash
docker-compose --profile monitoring up mlflow
```

Access UI at: `http://localhost:5000`

**Pros:**
- Free and open-source
- Full control over data
- No external dependencies

**Cons:**
- Requires local resources
- Data stored locally (backup needed)

### Option 2: Cloud MLflow Services

Use managed cloud services instead of local server:

#### Databricks MLflow (Free tier available)
```bash
# Set in .env
MLFLOW_TRACKING_URI=https://your-workspace.cloud.databricks.com
```

#### AWS SageMaker
```bash
MLFLOW_TRACKING_URI=https://mlflow.sagemaker.amazonaws.com
```

#### Azure Machine Learning
```bash
MLFLOW_TRACKING_URI=https://ml.azure.com
```

**Pros:**
- Managed infrastructure
- Built-in backups
- Scalable

**Cons:**
- May have costs
- Requires cloud account

### Option 3: Skip MLflow Entirely

If you don't need experiment tracking:

1. **Don't start the MLflow service** in docker-compose
2. **Don't set MLFLOW_TRACKING_URI** in .env
3. Code will automatically skip MLflow logging

All metrics will still be available via:
- Prometheus (port 9090)
- Application logs
- Database (workflow records)

## Configuration

### Local Setup

```bash
# In .env file
MLFLOW_TRACKING_URI=http://localhost:5000
```

### Cloud Setup

```bash
# In .env file
MLFLOW_TRACKING_URI=https://your-cloud-mlflow-url.com
# Add authentication if required
MLFLOW_USERNAME=your_username
MLFLOW_PASSWORD=your_password
```

## What Gets Tracked?

Each build logs:
- **Parameters**: prompt, chain, model used
- **Metrics**: latency, credits, audit findings count, success rate
- **Tags**: build_id, chain, model
- **Artifacts**: (optional) contract code, audit reports

## Accessing MLflow UI

### Local Docker
```bash
# Start MLflow service
docker-compose --profile monitoring up mlflow

# Access UI
open http://localhost:5000
```

### Cloud Services
Access via your cloud provider's dashboard or the MLflow tracking URI.

## Troubleshooting

### MLflow not connecting?
- Check `MLFLOW_TRACKING_URI` is set correctly
- Verify MLflow service is running (if local)
- Check network connectivity (if cloud)
- Code will continue working even if MLflow fails

### Want to disable MLflow?
Simply don't set `MLFLOW_TRACKING_URI` or set it to empty string. The code handles this gracefully.

