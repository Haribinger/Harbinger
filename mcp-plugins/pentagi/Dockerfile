FROM node:20-alpine

LABEL maintainer="Harbinger Team"
LABEL description="PentAGI autonomous agent MCP server"

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --chown=app:app package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=app:app server.js ./

USER app

EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -qO- http://localhost:3002/health || exit 1

CMD ["node", "server.js"]
