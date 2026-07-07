# syntax=docker/dockerfile:1
# SENATRAN mock — production image. Compiles the TypeScript sources to ESM and
# runs the NestJS server from dist/. Schema + seed are applied separately (see
# the `migrate` service in docker-compose.yml), so this image stays slim.

# ---- builder: install all deps, compile TS -> dist, drop dev deps -----------
FROM node:24-slim AS builder
WORKDIR /app
RUN corepack enable
# Install deps first for layer caching.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
# Build the server.
COPY tsconfig.json tsconfig.build.json ./
COPY apps ./apps
COPY domain ./domain
RUN pnpm build
# Keep only runtime dependencies in node_modules.
RUN pnpm prune --prod

# ---- runtime: slim image that runs the compiled server ----------------------
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
# Liveness/readiness: /health reports db connectivity. Uses Node's global fetch.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>r.json()).then(j=>process.exit(j.db==='up'?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/apps/api/src/main.js"]
