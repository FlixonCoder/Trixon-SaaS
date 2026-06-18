# --------------------------------------------------
# Trixon Backend — Production Dockerfile
# --------------------------------------------------
# Builds a lean production image with runtime deps only.
# Ruff and dev tools are NOT included.
# --------------------------------------------------

FROM python:3.11-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system deps required by cryptography
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libffi-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python runtime dependencies only
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Expose the API port
EXPOSE 8000

# Default command — run the FastAPI server
# Railway overrides this per service via railway.json
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
