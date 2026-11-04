FROM node:22-alpine
WORKDIR /app
# Dependencies first, so this layer is cached until the MCP package files change.
COPY mcp/package.json mcp/package-lock.json mcp/
RUN npm --prefix mcp ci --omit=dev
COPY . .
RUN node scripts/build.mjs
ENV NODE_ENV=production
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/health" || exit 1
CMD ["node", "mcp/server.mjs"]
