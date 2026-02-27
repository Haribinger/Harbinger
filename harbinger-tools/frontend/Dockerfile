# Harbinger Frontend - Multi-stage build
# Stage 1: Build the React/Vite app
FROM node:20-alpine AS builder

# Empty string = relative URLs, so nginx proxies /api/ to backend correctly
ARG VITE_API_URL=
ARG VITE_WS_URL=
ARG VITE_MCP_URL=

WORKDIR /app

# pnpm is required — project uses pnpm-lock.yaml
RUN npm install -g pnpm@10

# Install dependencies first (better layer caching)
COPY package.json pnpm-lock.yaml ./
RUN rm -f package-lock.json && pnpm install --frozen-lockfile

# Copy source and build
COPY . .

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_MCP_URL=$VITE_MCP_URL

RUN pnpm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

LABEL maintainer="Harbinger Security Platform"
LABEL description="Harbinger Frontend - React SPA"

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config for SPA routing + API proxy to backend
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Compression\n\
    gzip on;\n\
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;\n\
\n\
    # Proxy /api requests to Go backend\n\
    location /api/ {\n\
        proxy_pass http://backend:8080;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
        proxy_connect_timeout 30s;\n\
        proxy_read_timeout 300s;\n\
    }\n\
\n\
    # Proxy /health to backend\n\
    location = /health {\n\
        proxy_pass http://backend:8080;\n\
        proxy_set_header Host $host;\n\
    }\n\
\n\
    # WebSocket proxy\n\
    location /ws {\n\
        proxy_pass http://backend:8080;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Upgrade $http_upgrade;\n\
        proxy_set_header Connection "upgrade";\n\
        proxy_set_header Host $host;\n\
        proxy_read_timeout 3600s;\n\
    }\n\
\n\
    # MCP plugin proxies\n\
    location /mcp/hexstrike/ {\n\
        rewrite ^/mcp/hexstrike/(.*) /$1 break;\n\
        proxy_pass http://hexstrike:3001;\n\
        proxy_read_timeout 600s;\n\
    }\n\
    location /mcp/pentagi/ {\n\
        rewrite ^/mcp/pentagi/(.*) /$1 break;\n\
        proxy_pass http://pentagi:3002;\n\
        proxy_read_timeout 600s;\n\
    }\n\
    location /mcp/ui/ {\n\
        rewrite ^/mcp/ui/(.*) /$1 break;\n\
        proxy_pass http://mcp-ui:3003;\n\
        proxy_buffering off;\n\
    }\n\
    location /api/redteam/ {\n\
        rewrite ^/api/redteam/(.*) /api/$1 break;\n\
        proxy_pass http://redteam:3004;\n\
        proxy_read_timeout 600s;\n\
        proxy_buffering off;\n\
    }\n\
\n\
    # SPA routing - serve index.html for all routes\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    # Cache static assets\n\
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
\n\
    # Security headers\n\
    add_header X-Frame-Options "SAMEORIGIN";\n\
    add_header X-Content-Type-Options "nosniff";\n\
    add_header X-XSS-Protection "1; mode=block";\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
