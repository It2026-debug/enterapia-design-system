FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm --prefix mcp ci --omit=dev && node scripts/build.mjs
ENV NODE_ENV=production
USER node
CMD ["node", "mcp/server.mjs"]
