FROM node:20-alpine

LABEL maintainer="Harbinger Team"
LABEL description="MCP-UI visualization server"

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --chown=app:app package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=app:app server.js ./

USER app

EXPOSE 3003

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -qO- http://localhost:3003/health || exit 1

CMD ["node", "server.js"]
