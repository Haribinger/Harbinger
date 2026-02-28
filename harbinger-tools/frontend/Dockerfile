# Harbinger Frontend - Multi-stage build
# Build context MUST be repo root (set in docker-compose.yml: context: .)
# because pnpm-lock.yaml lives at repo root, not in harbinger-tools/frontend.

# Stage 1: Build the React/Vite app
FROM node:20-alpine AS builder

ARG VITE_API_URL=
ARG VITE_WS_URL=
ARG VITE_MCP_URL=

WORKDIR /build

RUN npm install -g pnpm@10.4.1

# Copy root lockfile and frontend package.json for dependency caching
COPY pnpm-lock.yaml ./
COPY harbinger-tools/frontend/package.json ./harbinger-tools/frontend/

# Install frontend dependencies using the root lockfile
WORKDIR /build/harbinger-tools/frontend
RUN pnpm install --frozen-lockfile --ignore-workspace

# Copy frontend source
COPY harbinger-tools/frontend/ ./

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_MCP_URL=$VITE_MCP_URL

RUN pnpm run build

# Stage 2: Static file server only — all proxying done by outer nginx
FROM nginx:alpine

LABEL maintainer="Harbinger Security Platform"
LABEL description="Harbinger Frontend - React SPA static server"

# Create non-root user and fix nginx dirs for non-root operation
RUN addgroup -S harbinger && adduser -S harbinger -G harbinger \
    && mkdir -p /var/cache/nginx /var/run /tmp \
    && chown -R harbinger:harbinger /var/cache/nginx /var/run /tmp \
    && sed -i 's|/var/run/nginx.pid|/tmp/nginx.pid|' /etc/nginx/nginx.conf

COPY --from=builder --chown=harbinger:harbinger /build/harbinger-tools/frontend/dist /usr/share/nginx/html

# Static-only nginx — no proxy rules (outer nginx handles all routing)
RUN printf 'server {\n\
    listen 8080;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

USER harbinger

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
