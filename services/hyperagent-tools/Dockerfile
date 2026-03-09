FROM python:3.11-slim

WORKDIR /app

# Use venv to avoid "Running pip as root" warning
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 9000

# Use PORT from env (platform sets this); fallback to 9000 for local
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-9000}"]
