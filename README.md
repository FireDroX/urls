# url.addrien.fr

Outil perso : raccourcir des URL (`/r/<id>`), partager des fichiers (`/d/<id>`) et en recevoir (`/u/<id>`), derrière un seul compte admin.

Stack : pnpm workspace, `backend/` NestJS + TypeORM + MySQL 8, `frontend/` React + Vite + Tailwind + shadcn/ui, stockage S3 (RustFS).

## Démarrer en local

```bash
pnpm install
cp backend/.env.example backend/.env     # puis remplir les secrets (openssl rand -hex 32)
cp frontend/.env.example frontend/.env
cd backend && pnpm run migration:run && pnpm run start:dev
cd frontend && pnpm run dev              # http://localhost:5174
```

Base et S3 : ceux de la VM de dev, ou la stack complète `docker compose up -d mysql rustfs` (voir `.env.example`).

## Déployer

`docker-compose.external.yml` (base et RustFS existants, images GHCR) ou `docker-compose.yml` (stack complète). Détails dans `CLAUDE.md`.
