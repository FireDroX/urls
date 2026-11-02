# CLAUDE.md

Ce fichier donne à Claude Code (claude.ai/code) le contexte nécessaire pour travailler sur ce dépôt.

## graphify

Ce dépôt a un graphe de connaissance à `graphify-out/` :

- Pour toute question sur le code, lancer d'abord `graphify query "<question>"` (`graphify path "<A>" "<B>"` pour une relation, `graphify explain "<concept>"` pour un concept ciblé) : sous-graphe scopé, bien plus petit que `GRAPH_REPORT.md` ou du grep brut.
- `GRAPH_REPORT.md` seulement pour une revue d'architecture globale.
- Après une modif de code, `graphify update .` (AST-only, pas de coût API).

## Projet

**url.addrien.fr** — outil perso qui regroupe trois usages derrière un seul compte admin : raccourcir des URL (`/r/<id>`), partager des fichiers (`/d/<id>`) et en recevoir (`/u/<id>`). Même architecture que NestWiki (`../wiki`, à consulter pour tout pattern déjà résolu là-bas) : pnpm workspace avec `backend/` (NestJS + TypeORM + MySQL 8) et `frontend/` (React + TypeScript + Vite, TailwindCSS + shadcn/ui).

Le plan de référence est `Plan url.addrien.fr.md` (phases 0 à 4, exigences de sécurité transverses) et la maquette `Maquette url.addrien.fr.html` (thème sombre, Montserrat / Noto Sans, accent orange) ; les deux restent hors dépôt (`.gitignore`). Une fonctionnalité n'est terminée qu'avec ses limites, ses codes d'erreur et ses contrôles d'intégrité.

État : **phase 1** en cours (redirections `/r/`) : table `links`, API admin et enregistrement des clics (table `events`) en place. La table `files` arrive avec les phases 2 et 3.

## Commandes

Toujours lancer l'app via les scripts `pnpm run <script>` du package concerné. Ports de dev : backend `:3001`, frontend `:5174` (NestWiki occupe déjà `:3000`/`:5173`) ; vérifier les ports avant de lancer un serveur, et arrêter ceux qu'on a lancés (`netstat -ano | grep ":3001"`, puis `taskkill //F //PID <pid>`).

```bash
cd backend && pnpm run start:dev    # API en watch (http://localhost:3001/api)
cd frontend && pnpm run dev         # Vite, proxifie /api et /r/ vers VITE_API_PROXY_TARGET
```

Backend (`backend/`) :

```bash
pnpm run lint                # eslint --fix
pnpm run test                # vitest
pnpm run build
pnpm run migration:run       # applique les migrations TypeORM en attente
pnpm run migration:revert    # annule la dernière migration
pnpm run migration:generate  # diff entities vs DB — à relire, jamais pris tel quel
pnpm run seed:admin          # crée le compte admin depuis ADMIN_* si la base n'a aucun compte (idempotent, lancé par entrypoint.sh ; Nest refait la même vérification au démarrage)
```

Frontend (`frontend/`) : `pnpm run lint` (oxlint), `pnpm run test` (vitest + jsdom), `pnpm run build`.

## Environnement

Dev : la base et le S3 tournent sur la VM docker de dev `192.168.2.64` (stack `/opt/nestwiki-dev` : MySQL 8.4 sur `:3306`, RustFS sur `:9000`), partagés avec NestWiki : base `urls`, utilisateur MySQL `urls` limité à `urls.*`, bucket `urls` et utilisateur S3 `urls` limité à ce bucket. `infra/rustfs/setup.sh` (local, **hors dépôt** : `infra/` est dans `.gitignore`) crée bucket, utilisateur, politique, quota et CORS (idempotent, avec le compte admin RustFS — jamais celui de l'app).

Config : trois `.env`, chacun avec un `.env.example` à copier.

- racine — lu par `docker compose` uniquement (mots de passe MySQL/RustFS du compose complet, réseaux externes de prod, `VITE_TURNSTILE_SITE_KEY` pour le build de l'image frontend).
- `backend/.env` — `PUBLIC_URL` (origine publique : CORS, cookies `Secure` si `https://`), `DB_*`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, `IP_HASH_SECRET` (clé HMAC des IP des visiteurs, 32 caractères min.), `ADMIN_EMAIL`/`ADMIN_PASSWORD`, `S3_ENDPOINT` (accès interne), `S3_PUBLIC_ENDPOINT` (hôte public qui **signe** les URLs présignées — `https://cdn.addrien.fr` en prod, la signature couvre l'hôte), `S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET`/`S3_REGION`, `TURNSTILE_SECRET_KEY`, `CLIENT_IP_HEADER` (`cf-connecting-ip` derrière le tunnel) et `TRUST_PROXY_HOPS`. **`validateEnvironment` (`src/config/env.validation.ts`) bloque le démarrage** si un secret est absent, trop court ou une valeur par défaut connue (`KNOWN_DEFAULT_SECRETS`), si les deux secrets JWT sont identiques, ou si `TURNSTILE_SECRET_KEY` manque alors que `PUBLIC_URL` est en `https://` — sauf `DEV=true` (dev local uniquement, jamais en prod).
- `frontend/.env` — `VITE_API_URL` (`/api` : même origine, nginx en prod et le proxy Vite en dev), `VITE_API_PROXY_TARGET`, `VITE_TURNSTILE_SITE_KEY`.

Ne jamais afficher ni copier les valeurs des `.env` : générer de nouveaux secrets (`openssl rand -hex 32`).

## Déploiement

- `docker-compose.yml` : stack complète (mysql + rustfs + backend + frontend, plus `storage-init` en profil `setup`, qui monte `infra/rustfs`), pour un serveur vierge ou un essai local. Réseaux `database` et `storage` en `internal`, partagés seulement avec le backend ; seul le frontend publie un port (`127.0.0.1:8081`), servi par le Cloudflare Tunnel.
- `docker-compose.external.yml` : prod, la base et le RustFS existent déjà (ceux de NestWiki, S3 exposé sur `cdn.addrien.fr`). Images `ghcr.io/firedrox/urls-{backend,frontend}` poussées par la CI sur `main`, réseaux externes `DATABASE_NETWORK`/`STORAGE_NETWORK` (réseaux `--internal` dédiés).
- Backend : utilisateur `node` (non root), `mem_limit`, `read_only`, `no-new-privileges`. `entrypoint.sh` lance migrations, seed admin puis l'API. Le frontend nginx proxifie `/api/` et `/r/` vers `backend:3000` et envoie la CSP (scripts du site + Turnstile seulement), `nosniff`, `X-Frame-Options`.

## Architecture backend (`backend/src`)

NestJS, un module par domaine directement sous `src/` (pas de dossier `modules/`) : `audit`, `auth`, `events`, `health`, `links`, `security`, `settings`, `storage`, `users`, plus `common/` (filtres, DTOs, exceptions, guards, décorateurs, stratégie JWT, constantes), `config/` (TypeORM, validation de l'environnement) et `database/` (migrations, seed admin). Pour créer un module : skill `new-backend-module`.

Même découpage en couches que NestWiki :

- `<module>.controller.ts` — HTTP uniquement : un appel au service, puis le mapper construit la réponse. Routes protégées par `@UseGuards(JwtAuthGuard)` (un seul compte : pas de rôles) ; toujours `@UseFilters(<Module>ExceptionFilter)`.
- `services/*.service.ts` — logique métier **et validation**. Pas de `class-validator` ni de `ValidationPipe` : le controller reçoit `@Body() body: unknown`, le service le passe à `parseDto(<schema>, body)` (`common/parse-dto.ts`), qui lève `ValidationException` (400). Lève des exceptions de domaine depuis `common/exceptions/<domaine>/*.exception.ts` (`extends Error`, `this.name = '<NomDeClasse>'`).
- `dto/in/*.dto.ts` — un schéma `zod` (`z.strictObject`, longueurs max, normalisation) et le type inféré. `dto/out/*.dto.ts` — une `interface`, enveloppée dans `ResponseDto<T>`.
- `entities/*.entity.ts` — entités TypeORM ; le schéma appartient aux migrations SQL brutes (`src/database/migrations/`, `queryRunner.query`), **jamais** `synchronize: true`. Noms explicites pour index et clés étrangères.
- `persistence/` — port (interface) + adapter `typeorm.*.repository.ts`, injecté via un **token string littéral** au pluriel (`'UsersRepository'`, `'AuditLogsRepository'`) : il doit différer de `` `${EntityName}Repository` ``, déjà enregistré par `@nestjs/typeorm`.
- `mapper/*.mapper.ts` — classe statique entity → DTO qui construit le `ResponseDto`.
- `filter/*.exception.filter.ts` — `@Catch()` par module, table `exception.name` → statut ; un nom inconnu part dans `HttpExceptionFilter.respond`.

**Erreurs** : format unique `{ error: '<message>' }` (messages en anglais). `common/filters/http-exception.filter.ts` (aussi filtre global) garde le vrai statut des `HttpException` et des erreurs body-parser exposées (400, 413…), et répond `500 Internal server error` sans jamais exposer le message interne (SQL, stack), qu'il logge. Jamais de 500 pour une erreur client : chaque exception de domaine doit être mappée dans le filtre de son module (et ceux des modules qui l'appellent).

**`common/variables.global.ts`** centralise les constantes (longueurs, durées, limites de débit, alphabet des IDs publics…) : y ajouter les nouvelles.

**IDs publics** : `generatePublicId()` (`common/public-id.ts`, nanoid base62, 8 caractères). Ne jamais exposer un ID SQL (uuid interne) dans une réponse ou une URL.

**Auth** : un seul compte, créé depuis `ADMIN_*` (`database/default-admin.ts`). Mot de passe hashé en argon2id (`common/password.ts`, `@node-rs/argon2`). JWT access 15 min + refresh 7 j en cookies `httpOnly`, `SameSite=Strict`, `Secure` si `PUBLIC_URL` est en `https://`. `JwtStrategy` → `SessionUserResolver` recharge l'utilisateur à chaque requête et refuse un jeton antérieur au dernier changement de mot de passe (qui déconnecte donc les autres sessions). Verrouillage après `MAX_FAILED_LOGIN_ATTEMPTS` échecs (423 + `Retry-After`), compteur remis à zéro à l'expiration. Turnstile vérifié côté serveur (`security/services/turnstile.service.ts`) avec l'IP cliente réelle.

**IP cliente et rate limits** : `resolveClientIp` (`common/client-ip.ts`) lit `CLIENT_IP_HEADER` (`cf-connecting-ip` en prod) sinon `req.ip`, calculé par Express avec `trust proxy = TRUST_PROXY_HOPS`. `ThrottlerBehindProxyGuard` (global, 100 req/min) l'utilise ; `@Throttle` plus strict sur l'auth. Le throttler répond 429 avec `Retry-After`, affiché par le front (`lib/api-errors.ts`).

**Audit** : `AuditLogService.record` (`audit/`) journalise connexions (réussies, échouées, verrouillées), changements de mot de passe et de réglages, et créations, modifications et suppressions de liens (`AuditAction`).

**Liens** (`links/`) : une seule table `links` pour les trois types (`redirect`, puis `share` et `drop`), contrainte `CHECK` sur le type et sur la destination obligatoire d'une redirection. `public_id` = slug choisi ou `generatePublicId()`, unique et en `utf8mb4_bin` (sensible à la casse, comme l'alphabet base62). API admin `GET/POST /api/links`, `GET/PATCH/DELETE /api/links/:id` (`:id` = `public_id`) ; tout est modifiable (destination, slug, expiration, désactivation). Suppression en soft delete (`deleted_at`) : le slug d'un lien supprimé reste pris (409), pour qu'une ancienne URL partagée ne pointe jamais vers une autre destination. Limites (longueurs, alphabet du slug, noms réservés, throttle de création) dans `variables.global.ts`.

**Redirection publique `/r/:id`** (`links/redirects.controller.ts`) : seule route hors du préfixe `/api` (`exclude` de `setGlobalPrefix` dans `main.ts`), servie par le backend pour répondre côté serveur. Lien actif → `302` vers la destination, `Cache-Control: no-store` (jamais de 301 ni de cache). Lien inexistant, désactivé, supprimé ou id mal formé (vérifié avant toute requête SQL) → même `LinkNotFoundException` (404, corps et en-têtes identiques) ; `expires_at` passé → `LinkExpiredException` (410). `@Throttle` dédié (`LINK_REDIRECT_THROTTLE_*`, par IP via `resolveClientIp`). Les pages 404/410 sont celles de la SPA, statut conservé : nginx (`proxy_intercept_errors` + `error_page 404 410 /index.html`) et le proxy Vite (plugin `public-link-proxy` de `vite.config.ts`) remplacent le corps JSON par `index.html` ; la route `/r/:id` du front (`RedirectUnavailable`) relit le statut par un `fetch` sans suivre la redirection (`redirect: 'manual'`) et affiche « lien introuvable » ou « lien expiré » dans la langue du site. Les 429 passent tels quels (`Retry-After` conservé).

**Événements** (`events/`, port `'EventsRepository'`, entité `LinkEvent`) : table `events` (`link_id` → `links.id` en `ON DELETE CASCADE`, `type` contraint par `CHECK`, index `(link_id, created_at)` pour les stats). Un `302` de `/r/:id` appelle `EventsService.recordClick` sans l'attendre (les 404/410/429 n'enregistrent rien) ; le décorateur `@CurrentVisitor()` (`common/visitor.ts`) fournit l'IP (`resolveClientIp`), `Referer`, `User-Agent` et `CF-IPCountry`. Referer et user-agent tronqués (`EVENT_*_MAX_LENGTH`), pays gardé seulement s'il fait 2 lettres (`XX`, `T1` → `null`), IP stockée uniquement en HMAC-SHA-256 hex avec `IP_HASH_SECRET` : jamais en clair, ni en base ni dans les logs. Un échec d'insertion est loggé, la redirection part quand même.

**Stockage** : client AWS SDK v3 (`storage/`), `forcePathStyle`, deux clients : interne (`S3_ENDPOINT`) et de signature (`S3_PUBLIC_ENDPOINT`). Bucket privé, accès uniquement par URLs présignées en `Content-Disposition: attachment`. `GET /api/storage/usage` lit `GET /rustfs/admin/v3/quota-stats/<bucket>` signé SigV4 (l'utilisateur de l'app n'a besoin que de `s3:GetBucketQuota`). Le quota RustFS ne suffit pas : avant toute URL présignée d'upload, vérifier aussi la place restante côté SQL, et traduire « Bucket quota exceeded » en 413.

## Architecture frontend (`frontend/src`)

Structure plate sous `src/` (pas de `features/`), comme NestWiki : `api/` (un wrapper par domaine, enveloppe `ResponseDto`), `components/` (`ui/` = shadcn généré, **ne pas éditer à la main** ; `layout/` = Topbar/Sidebar/AppLayout), `hooks/`, `lib/` (`api-client.ts` : axios `withCredentials`, 401 → refresh puis rejeu, déconnexion si le refresh échoue), `pages/` (une par route, câblées dans `App.tsx`), `schemas/` (zod), `utils/` (fonctions pures). Imports via `#<dossier>/…`. Après login, `sameOriginPath` (`utils/safe-redirect.ts`) n'autorise qu'une redirection vers le site lui-même. Logos et mascotte repris de NestWiki (`public/logo-{light,dark}.svg`, `public/mascot-{light,dark}.png`).

## Langue (i18n)

Comme NestWiki : l'interface est en français ou en anglais, au choix de l'admin, pour tout le site (pages publiques `/d/` et `/u/` comprises). Le réglage `locale` vit en base (`system_settings`, module `settings/`) : `GET /api/settings` est public (lu par `main.tsx` avant le premier rendu, pour que la page de login soit déjà dans la bonne langue), `PATCH /api/settings/locale` exige la session et passe dans le journal d'audit. Front : `react-i18next`, `lib/i18n.ts` (`applyLocale`), un seul fichier par langue (`locales/fr.json`, `locales/en.json`, mêmes clés : `locales.test.ts` le vérifie). **Aucun texte affiché en dur** : toute chaîne nouvelle passe par `t()` et entre dans les deux fichiers ; les schémas zod du front prennent `t` (`createLoginSchema(t)`). Les messages d'erreur de l'API restent en anglais ; le front traduit ceux qu'il sait reconnaître (statut 401 au login, 429…). Page `/settings` : langue et mot de passe.

## Règles transverses du plan

- Redirections en **302** uniquement (destination modifiable), jamais 301.
- Même 404 pour un lien inexistant, désactivé ou supprimé ; 410 + page « lien expiré » pour un lien expiré.
- Destinations en `http`/`https` uniquement, longueur max ; slugs limités à un alphabet, hors noms réservés.
- Uploads multipart du navigateur vers S3, parts < 100 Mo (limite du Cloudflare Tunnel) ; taille et SHA-256 vérifiés en fin d'upload, MIME détecté côté serveur, refus pendant l'envoi (413).
- Opérations multi-étapes en transaction ; contraintes en base (FK, unicité des IDs publics, `NOT NULL`).
- Tout est modifiable après création (destination, limites, expiration).

## Commentaires de code

Pas de commentaires de code : nommage clair, petites fonctions. Les commentaires des fichiers d'infra (compose, Dockerfile, `.env.example`) expliquent le déploiement et restent.

## Tests

`*.spec.ts` (backend) et `*.test.ts(x)` (frontend) avec vitest. Backend : services et repositories mockés via `vi.fn()`, pas d'accès DB dans les tests unitaires (ex. `auth/services/auth.service.spec.ts`).

## Git

Branches `main` (déploiement) et `dev` (intégration) ; une branche par ticket, PR vers `dev`. CI (`.github/workflows/ci.yml`) : lint, tests, build, `pnpm audit`, images Docker (poussées sur GHCR depuis `main`), actions épinglées par commit ; Dependabot mensuel sur `dev`.
