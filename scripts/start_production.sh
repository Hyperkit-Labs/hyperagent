#!/bin/bash
# Production startup script for HyperAgent
# This script starts HyperAgent directly without Docker

set -e

echo "Starting HyperAgent in production mode..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

# Start the application
echo "Starting HyperAgent API server..."
exec uvicorn hyperagent.api.main:app \
    --host 0.0.0.0 \
    --port ${PORT:-8000} \
    --workers ${API_WORKERS:-4}

