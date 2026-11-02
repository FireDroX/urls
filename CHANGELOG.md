# Changelog

## Non publié

- Page « Redirections » du dashboard : liste des liens `/r/` (slug, destination, état actif / désactivé / expiré, expiration), copie de l'URL complète, création (slug choisi ou généré), modification de la destination, du slug, de l'expiration et de l'état, désactivation rapide et suppression après confirmation. Mêmes limites que l'API vérifiées dans le formulaire, erreurs traduites (slug pris, valeur invalide, trop de requêtes).
- Redirections publiques `/r/<id>` en 302, avec pages « lien introuvable » (404) et « lien expiré » (410) en français ou en anglais, et limite de débit par visiteur.
- Chaque redirection réussie enregistre un clic (date, provenance, navigateur, pays Cloudflare, IP hachée en HMAC-SHA-256 : jamais stockée ni journalisée en clair), sans retarder ni bloquer la redirection. Nouveau secret obligatoire `IP_HASH_SECRET` dans `backend/.env`.

## 0.0.1 — 2026-11-01

- Socle du projet : API NestJS, dashboard React, base MySQL et stockage S3 (RustFS).
- Connexion au compte admin unique : mot de passe argon2, Cloudflare Turnstile, verrouillage après 5 échecs, cookies `httpOnly`/`SameSite`, redirection après login limitée au site.
- Changement de mot de passe, qui déconnecte les autres sessions.
- Dashboard vide avec la barre d'utilisation du stockage S3.
- Interface en français ou en anglais, au choix dans les réglages (s'applique à tout le site).
- Limites de débit (globale et sur l'auth, 429 avec `Retry-After`), format d'erreur unique sans détail interne, journal d'audit des connexions.
- Démarrage refusé si un secret est absent, faible ou par défaut.
- Déploiement Docker Compose (stack complète ou base/S3 existants), CI avec `pnpm audit` et Dependabot.
