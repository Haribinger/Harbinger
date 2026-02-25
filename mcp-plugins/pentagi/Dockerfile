# PentAGI - Autonomous Penetration Testing Agent
FROM python:3.11-slim

LABEL maintainer="Harbinger Security Platform"
LABEL description="PentAGI - Autonomous Agent System"

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PENTAGI_PORT=3002

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

RUN mkdir -p /app/plugins

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:${PENTAGI_PORT}/health || exit 1

CMD ["python3", "server.py"]
