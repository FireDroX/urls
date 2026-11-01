# Changelog

## 0.0.1 — 2026-11-01

- Socle du projet : API NestJS, dashboard React, base MySQL et stockage S3 (RustFS).
- Connexion au compte admin unique : mot de passe argon2, Cloudflare Turnstile, verrouillage après 5 échecs, cookies `httpOnly`/`SameSite`, redirection après login limitée au site.
- Changement de mot de passe, qui déconnecte les autres sessions.
- Dashboard vide avec la barre d'utilisation du stockage S3.
- Interface en français ou en anglais, au choix dans les réglages (s'applique à tout le site).
- Limites de débit (globale et sur l'auth, 429 avec `Retry-After`), format d'erreur unique sans détail interne, journal d'audit des connexions.
- Démarrage refusé si un secret est absent, faible ou par défaut.
- Déploiement Docker Compose (stack complète ou base/S3 existants), CI avec `pnpm audit` et Dependabot.
