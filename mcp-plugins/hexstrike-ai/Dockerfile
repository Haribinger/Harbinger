FROM node:20-alpine

LABEL maintainer="Harbinger Team"
LABEL description="HexStrike AI security tools MCP server"

WORKDIR /app

COPY package.json ./
RUN npm install --production 2>/dev/null || true

COPY server.js ./

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "server.js"]
