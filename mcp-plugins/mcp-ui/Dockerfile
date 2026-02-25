FROM node:20-alpine

LABEL maintainer="Harbinger Team"
LABEL description="MCP-UI visualization server"

WORKDIR /app

COPY package.json ./
RUN npm install --production 2>/dev/null || true

COPY server.js ./

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3003/health || exit 1

CMD ["node", "server.js"]
