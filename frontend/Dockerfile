# check=skip=SecretsUsedInArgOrEnv
# Built from the repo root (pnpm workspace): docker build -f frontend/Dockerfile .

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
RUN pnpm install --frozen-lockfile --filter frontend...

FROM deps AS build
COPY frontend frontend
# Vite bakes these into the bundle. VITE_TURNSTILE_SITE_KEY is Turnstile's
# public site key (the secret lives only in backend/.env), hence the
# SecretsUsedInArgOrEnv skip at the top of this file.
ARG VITE_API_URL=/api
ARG VITE_TURNSTILE_SITE_KEY=
RUN pnpm --filter frontend run build

FROM nginx:alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
