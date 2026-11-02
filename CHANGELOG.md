# Changelog

## Non publié

- Page « Redirections » du dashboard : liste des liens `/r/` (slug, destination, état actif / désactivé / expiré, expiration), copie de l'URL complète, création (slug choisi ou généré), modification de la destination, du slug, de l'expiration et de l'état, désactivation rapide et suppression après confirmation. Mêmes limites que l'API vérifiées dans le formulaire, erreurs traduites (slug pris, valeur invalide, trop de requêtes).
- Redirections publiques `/r/<id>` en 302, avec pages « lien introuvable » (404) et « lien expiré » (410) en français ou en anglais, et limite de débit par visiteur.
- Chaque redirection réussie enregistre un clic (date, provenance, navigateur, pays Cloudflare, IP hachée en HMAC-SHA-256 : jamais stockée ni journalisée en clair), sans retarder ni bloquer la redirection. Nouveau secret obligatoire `IP_HASH_SECRET` dans `backend/.env`.
- Fiche de chaque redirection (`/redirects/<slug>`, depuis le slug ou le menu « Statistiques » de la liste) : total et graphique des clics par jour (jours sans clic à 0, jours comptés en UTC), principales sources (« Direct » sans referer) et principaux pays, sur 7, 30, 90 ou 365 jours ; état vide sans clic. API `GET /api/links/:id/stats?days=N` (1 à 365, 30 par défaut).
- Principales sources regroupées par site : deux clics depuis deux pages de `news.example` comptent sur une seule ligne. Un referer absent ou qui n'est pas une adresse http(s) compte dans « Direct ». Les clics déjà enregistrés sont regroupés par la migration.
- Les dates écrites par MySQL sont en UTC même si le serveur de base est réglé sur un autre fuseau.
- Dans le menu latéral, « Réglages » n'est surligné que sur la page des réglages.
- Dépendances à jour (vitest 5, dotenv 18, @hookform/resolvers 6) et `pnpm audit` propre : `minimatch` forcé en 11 (GHSA-g3hv-75wg-m249), `deepmerge` ignoré avec sa justification (CLI shadcn, outil de dev sans correctif). Dependabot regroupe les mises à jour mineures et ignore TypeScript 7 tant que typescript-eslint ne le supporte pas.

## 0.0.1 — 2026-11-01

- Socle du projet : API NestJS, dashboard React, base MySQL et stockage S3 (RustFS).
- Connexion au compte admin unique : mot de passe argon2, Cloudflare Turnstile, verrouillage après 5 échecs, cookies `httpOnly`/`SameSite`, redirection après login limitée au site.
- Changement de mot de passe, qui déconnecte les autres sessions.
- Dashboard vide avec la barre d'utilisation du stockage S3.
- Interface en français ou en anglais, au choix dans les réglages (s'applique à tout le site).
- Limites de débit (globale et sur l'auth, 429 avec `Retry-After`), format d'erreur unique sans détail interne, journal d'audit des connexions.
- Démarrage refusé si un secret est absent, faible ou par défaut.
- Déploiement Docker Compose (stack complète ou base/S3 existants), CI avec `pnpm audit` et Dependabot.
