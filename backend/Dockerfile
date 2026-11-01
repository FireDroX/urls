# Built from the repo root (pnpm workspace): docker build -f backend/Dockerfile .

# The per-ticket "version" bump is stripped so the dependency layers stay
# cached until the lockfile or the dependency lists actually change.
FROM node:26-alpine AS manifests
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN node -e "for (const file of ['package.json', 'backend/package.json', 'frontend/package.json']) { const fs = require('fs'); const manifest = JSON.parse(fs.readFileSync(file, 'utf8')); delete manifest.version; fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n'); }"

FROM node:26-alpine AS base
WORKDIR /app
COPY --from=manifests /app/package.json ./
RUN npm install -g "$(node -p "require('./package.json').packageManager")" && pnpm --version

FROM base AS deps
COPY --from=manifests /app ./
RUN pnpm install --frozen-lockfile --filter backend...

FROM deps AS build
COPY backend backend
RUN pnpm --filter backend run build

FROM base AS prod-deps
COPY --from=manifests /app ./
RUN pnpm install --frozen-lockfile --prod --filter backend...

FROM node:26-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/backend/node_modules ./backend/node_modules
COPY --chmod=755 backend/entrypoint.sh ./backend/entrypoint.sh
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/package.json ./backend/package.json

WORKDIR /app/backend
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1
ENTRYPOINT ["./entrypoint.sh"]
