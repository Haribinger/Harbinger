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
COPY package.json ./
RUN rm -f package-lock.json && pnpm install --shamefully-hoist

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

# nginx config for SPA routing (handle client-side routes)
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
