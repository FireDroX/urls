# Changelog

## 0.0.14 — 2026-11-06

- Page « Fichiers » du dashboard (`/files`) : tous les fichiers stockés, du plus récent au plus ancien, avec leur taille, leur type, leur état et leur origine (lien vers le partage, ou mention « partage supprimé »). Filtre « Tous / Orphelins » conservé dans l'adresse de la page.
- Barre de place occupée : quota utilisé, part des fichiers orphelins et usage réel du stockage (une mention s'affiche s'il est indisponible).
- Téléchargement d'un fichier prêt et suppression après confirmation depuis cette page, avec la liste et la barre de place mises à jour ensuite. Un fichier encore attaché à un partage ne peut pas être supprimé de là.

## 0.0.13 — 2026-11-06

- Supprimer un fichier au moment précis où son envoi se termine efface désormais son objet du stockage. Avant, cet objet pouvait rester invisible dans le dashboard, sans pouvoir être supprimé, tout en occupant de la place.

## 0.0.12 — 2026-11-06

- Liste des fichiers stockés (`GET /api/files`) : chaque fichier avec son lien, s'il est encore utilisé ou orphelin (partage supprimé), et un résumé de la place occupée (quota, fichiers orphelins, usage réel du stockage). `?orphans=true` ne garde que les orphelins.
- Téléchargement direct d'un fichier prêt par l'administrateur (`POST /api/files/<id>/download`), sans passer par la page publique ni compter dans les téléchargements du partage.
- Suppression d'un fichier orphelin (`DELETE /api/files/<id>`) : l'espace est libéré tout de suite. Un fichier encore attaché à un partage, même désactivé ou expiré, ne peut pas être supprimé ainsi.
- Retirer un fichier d'un partage l'efface désormais immédiatement du stockage. Si le stockage est injoignable, le retrait échoue (erreur 503) et peut être relancé, alors qu'avant le fichier restait dans le stockage.

## 0.0.11 — 2026-11-05

- Page « Partages » du dashboard (`/shares`) : liste des liens `/d/` (fichiers, téléchargements, état, expiration), copie de l'URL complète, création (slug choisi ou généré, expiration et nombre maximal de téléchargements facultatifs), modification, désactivation et suppression après confirmation. Mêmes limites que l'API vérifiées dans le formulaire, erreurs traduites.
- Fiche d'un partage (`/shares/<slug>`) : vues, téléchargements, taille totale et fichiers (nom, taille, état), ajout par glisser-déposer ou sélection, suppression d'un fichier après confirmation.
- Envoi de fichiers jusqu'à 20 Gio depuis le navigateur : l'empreinte SHA-256 est calculée par tranches en arrière-plan (la page reste utilisable, la mémoire reste bornée), puis les parts partent trois par trois, une part ratée est renvoyée seule, plusieurs fois au plus. Progression de l'empreinte et de l'envoi affichées séparément, annulation à tout moment (ce qui a été reçu est supprimé), puis suivi de l'état jusqu'à « prêt » ou « rejeté ». L'envoi continue quand on change de page dans le dashboard, et le navigateur prévient avant de fermer l'onglet.
- Reprise d'un envoi interrompu (onglet fermé, coupure réseau) : sur la fiche du partage, « Reprendre » demande de re-sélectionner le fichier, et seules les parts manquantes repartent. Un autre fichier est refusé sans rien envoyer. Depuis un autre navigateur, l'empreinte est recalculée et comparée à celle annoncée au départ. API `GET /api/shares/:id/files/:fileId/parts`.

## 0.0.10 — 2026-11-04

- Page publique de téléchargement `/d/<id>` : nom, taille et nombre de fichiers prêts, date d'expiration et un bouton « Télécharger » par fichier, en français ou en anglais. Après le défi Turnstile, le fichier se télécharge directement depuis le stockage par une URL signée valable une minute. Un partage inexistant, désactivé, supprimé ou sans fichier prêt affiche « lien introuvable » ; un partage expiré ou dont tous les téléchargements ont été pris, « lien expiré ». Limites de débit dédiées à l'aperçu et aux téléchargements.
- Le nombre maximal de téléchargements est garanti même quand deux visiteurs prennent le dernier en même temps. Chaque ouverture de la page et chaque téléchargement sont enregistrés (IP hachée, comme les clics) ; la fiche d'un partage (`GET /api/shares/:id`) donne le nombre de vues à côté du nombre de téléchargements.
- La migration (lancée automatiquement au démarrage du conteneur) autorise les événements « vue » et « téléchargement ».

## 0.0.9 — 2026-11-03

- Envoi de fichiers dans un partage, même au-delà de 100 Mo : le fichier est annoncé (nom, taille, empreinte SHA-256), envoyé en parts de 32 Mio qui passent par l'API (jamais directement dans le stockage), une part ratée se renvoie seule, puis il est finalisé. L'API vérifie ensuite en arrière-plan la taille, l'empreinte et le vrai type du fichier : il devient « prêt », ou « rejeté » et effacé s'il ne correspond pas à ce qui a été annoncé. Une vérification interrompue par un redémarrage reprend toute seule.
- Limites appliquées dès l'annonce : 20 Gio par fichier, 50 fichiers par partage et 75 Gio au total (calculé sur les fichiers enregistrés, en plus du quota du stockage) ; un dépassement répond « trop volumineux » (413). Annulation d'un envoi en cours et suppression d'un fichier, inscrites au journal d'audit comme les ajouts. L'interface du dashboard arrive avec un prochain ticket.
- ⚠️ Le nginx du frontend accepte des requêtes de 33 Mo sur la seule route des parts, sans les mettre en tampon : reconstruire l'image frontend en même temps que le backend.

## 0.0.8 — 2026-11-03

- API admin des partages de fichiers `/d/` (`/api/shares`) : création avec un slug choisi ou généré, expiration et nombre maximal de téléchargements facultatifs, modification de tous ces réglages, désactivation et suppression. Le slug d'un partage partage l'espace de noms des redirections. La fiche d'un partage liste ses fichiers (nom, taille, type, état) et donne leur taille totale. Créations, modifications et suppressions passent dans le journal d'audit. L'interface du dashboard arrive avec un prochain ticket.
- Nouvelle table `files` créée par la migration, lancée automatiquement au démarrage du conteneur.

## 0.0.7 — 2026-11-03

- Principales sources regroupées par site : deux clics depuis deux pages de `news.example` comptent sur une seule ligne. Un referer absent ou qui n'est pas une adresse http(s) compte dans « Direct ». Les clics déjà enregistrés sont regroupés par la migration, qui peut être relancée sans intervention si elle échoue en cours de route.
- Les dates écrites par MySQL sont en UTC même si le serveur de base est réglé sur un autre fuseau.
- Dans le menu latéral, « Réglages » n'est surligné que sur la page des réglages.
- Dépendances à jour (vitest 5, dotenv 18, @hookform/resolvers 6) et `pnpm audit` propre : `minimatch` forcé en 11 (GHSA-g3hv-75wg-m249), `deepmerge` ignoré avec sa justification (CLI shadcn, outil de dev sans correctif). Dependabot regroupe les mises à jour mineures et ignore TypeScript 7 tant que typescript-eslint ne le supporte pas.
- La version monte désormais à chaque ticket (0.0.2 à 0.0.6 : tickets de la phase 1 déjà livrés).

## 0.0.6 — 2026-11-02

- Fiche de chaque redirection (`/redirects/<slug>`, depuis le slug ou le menu « Statistiques » de la liste) : total et graphique des clics par jour (jours sans clic à 0, jours comptés en UTC), principales sources (« Direct » sans referer) et principaux pays, sur 7, 30, 90 ou 365 jours ; état vide sans clic. API `GET /api/links/:id/stats?days=N` (1 à 365, 30 par défaut).

## 0.0.5 — 2026-11-02

- ⚠️ Chaque redirection réussie enregistre un clic (date, provenance, navigateur, pays Cloudflare, IP hachée en HMAC-SHA-256 : jamais stockée ni journalisée en clair), sans retarder ni bloquer la redirection. Nouveau secret obligatoire `IP_HASH_SECRET` dans `backend/.env`.

## 0.0.4 — 2026-11-02

- Page « Redirections » du dashboard : liste des liens `/r/` (slug, destination, état actif / désactivé / expiré, expiration), copie de l'URL complète, création (slug choisi ou généré), modification de la destination, du slug, de l'expiration et de l'état, désactivation rapide et suppression après confirmation. Mêmes limites que l'API vérifiées dans le formulaire, erreurs traduites (slug pris, valeur invalide, trop de requêtes).

## 0.0.3 — 2026-11-02

- Redirections publiques `/r/<id>` en 302, avec pages « lien introuvable » (404) et « lien expiré » (410) en français ou en anglais, et limite de débit par visiteur.

## 0.0.2 — 2026-11-02

- API admin des redirections (`/api/links`) : création avec un slug choisi ou généré, liste, modification (destination, slug, expiration, désactivation) et suppression. Un slug supprimé reste réservé, pour qu'une ancienne URL ne pointe jamais vers une autre destination. Créations, modifications et suppressions passent dans le journal d'audit.

## 0.0.1 — 2026-11-01

- Socle du projet : API NestJS, dashboard React, base MySQL et stockage S3 (RustFS).
- Connexion au compte admin unique : mot de passe argon2, Cloudflare Turnstile, verrouillage après 5 échecs, cookies `httpOnly`/`SameSite`, redirection après login limitée au site.
- Changement de mot de passe, qui déconnecte les autres sessions.
- Dashboard vide avec la barre d'utilisation du stockage S3.
- Interface en français ou en anglais, au choix dans les réglages (s'applique à tout le site).
- Limites de débit (globale et sur l'auth, 429 avec `Retry-After`), format d'erreur unique sans détail interne, journal d'audit des connexions.
- Démarrage refusé si un secret est absent, faible ou par défaut.
- Déploiement Docker Compose (stack complète ou base/S3 existants), CI avec `pnpm audit` et Dependabot.
