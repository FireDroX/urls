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

Base et S3 : ceux de la VM de dev, ou la stack complète `docker compose up -d mariadb rustfs` (voir `.env.example`).

## Déployer

`docker-compose.external.yml` (base et RustFS existants, images GHCR) ou `docker-compose.yml` (stack complète). Détails dans `CLAUDE.md`.

### Déploiement continu

`main` ne reçoit que des merges de `dev` et seule déploie. Un push sur `main` fait pousser par `ci.yml` les images `ghcr.io/firedrox/urls-{backend,frontend}` taguées `sha-<commit>` et `latest` ; une fois la CI verte, `.github/workflows/deploy.yml` (déclenché par `workflow_run`, seulement pour un push sur `main` de `FireDroX/urls`) :

1. installe `cloudflared` à une version fixe dont la somme SHA256 est vérifiée ;
2. se connecte en SSH au serveur par le tunnel Cloudflare, en vérifiant sa clé d'hôte ;
3. se connecte à GHCR sur le serveur (jeton du job passé sur l'entrée standard, jamais sur une ligne de commande) ;
4. avance le clone du serveur sur le commit testé (`git merge --ff-only <sha>`), puis `docker compose -f docker-compose.external.yml pull && up -d` avec `URLS_TAG=sha-<commit>` : les images testées par la CI, jamais reconstruites sur le serveur. Le backend applique les migrations au démarrage.

À préparer une fois :

1. **Tunnel** — une route publique (Public Hostname) du tunnel `cloudflared` du serveur vers `ssh://localhost:22`.
2. **Access** — une application Access (self-hosted) sur ce hostname, un service token (Access → Service Auth) et une règle **Service Auth** qui l'autorise.
3. **Clé SSH** — une paire dédiée (`ssh-keygen -t ed25519 -C "urls-deploy"`, sans passphrase), clé **publique** dans `~/.ssh/authorized_keys` de l'utilisateur de déploiement.
4. **Serveur** — un clone du dépôt sur `main` à `DEPLOY_PATH`, avec le `.env` racine et `backend/.env` remplis à la main (le premier déploiement échoue tant qu'ils manquent), et les réseaux `DATABASE_NETWORK` / `STORAGE_NETWORK` créés.

Secrets du dépôt GitHub (Settings → Secrets and variables → Actions) :

| Secret | Contenu |
| --- | --- |
| `CF_ACCESS_CLIENT_ID` | Client ID du service token Access (étape 2) |
| `CF_ACCESS_CLIENT_SECRET` | Client Secret du service token Access (étape 2) |
| `DEPLOY_SSH_PRIVATE_KEY` | Clé **privée** de l'étape 3 |
| `DEPLOY_SSH_HOSTNAME` | Hostname public du tunnel (étape 1) |
| `DEPLOY_SSH_HOST_KEY` | Clé d'hôte **publique** du serveur (`/etc/ssh/ssh_host_ed25519_key.pub`) ; le déploiement échoue si elle manque ou si le serveur en présente une autre |
| `DEPLOY_SSH_USER` | Utilisateur SSH sur le serveur |
| `DEPLOY_PATH` | Chemin absolu du clone sur le serveur (ex. `/opt/urls`) |

Variable du dépôt (onglet *Variables*) : `VITE_TURNSTILE_SITE_KEY`, la clé publique Turnstile intégrée à l'image frontend. Sans elle, la connexion échoue en prod (le backend exige Turnstile en `https://`).

Retour arrière : sur le serveur, `URLS_TAG=sha-<commit précédent> docker compose -f docker-compose.external.yml up -d`.
