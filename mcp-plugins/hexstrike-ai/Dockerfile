FROM node:20-alpine

LABEL maintainer="Harbinger Team"
LABEL description="HexStrike AI security tools MCP server"

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --chown=app:app package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=app:app server.js ./

USER app

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "server.js"]
