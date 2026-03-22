# harbinger/base — Lightweight base image for SCRIBE, SAGE, BRIEF, CIPHER
#
# Minimal footprint: curl, jq, git, python3
# No heavy tools — these agents primarily work with text and APIs

FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    jq \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    requests \
    markdown \
    pyyaml

WORKDIR /work

CMD ["sleep", "infinity"]
