# Harbinger Red Team Operations Service
# Inspired by Mandiant Harbinger red team platform
FROM python:3.11-slim

LABEL maintainer="Harbinger Security Platform"
LABEL description="Harbinger Red Team Ops — C2 management, SOCKS tasks, playbooks, Neo4j graph"

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV REDTEAM_PORT=3004

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

RUN mkdir -p /app/plugins /app/reports /app/wordlists

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:${REDTEAM_PORT}/health || exit 1

CMD ["python3", "server.py"]
