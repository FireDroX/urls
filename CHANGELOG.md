# Changelog

## 0.2.8 — 2026-11-17

- Les données de suivi des visites (clics, vues, téléchargements et envois : empreinte de l'IP, navigateur, provenance, pays) sont supprimées automatiquement après 90 jours, chaque nuit.
- Les statistiques d'une redirection proposent au plus 90 jours (la période d'un an disparaît) et le nombre de vues d'un partage ou d'un dépôt compte les 90 derniers jours. Le nombre de téléchargements d'un partage reste un total.

## 0.2.7 — 2026-11-17

- Côté API, les listes des redirections, des partages et des dépôts se recherchent (slug, destination, titre), se filtrent par tag, par dossier (ou sans dossier) et par état, se trient et se paginent ; un tag ou un dossier inconnu donne une liste vide.

## 0.2.6 — 2026-11-15

- Les formulaires des redirections, des partages et des dépôts permettent désormais de choisir leurs tags (20 au plus) et leur dossier ; les listes et les fiches affichent les tags en pastilles de couleur et le dossier.
- Si un tag ou un dossier choisi a été supprimé entre-temps, un message clair l'indique et les listes de choix sont relues.

## 0.2.5 — 2026-11-15

- Les redirections, les partages et les dépôts se rangent désormais dans des tags (20 au plus) et dans un dossier, à la création comme en modification : une modification remplace la liste de tags, et le dossier se retire en le mettant à vide. Un tag ou un dossier inconnu est refusé sans rien modifier. Les listes et les fiches affichent les tags et le dossier de chaque lien.

## 0.2.4 — 2026-11-15

- Nouvelle page Organisation : créer, renommer, recolorer et supprimer les tags et les dossiers, avec le nombre de liens de chacun. Supprimer un tag ou un dossier ne supprime jamais ses liens.

## 0.2.3 — 2026-11-15

- Les redirections sont désormais revérifiées automatiquement chaque jour : les plus anciennement contrôlées (ou jamais contrôlées) passent en premier, une à une, sans jamais enregistrer ni afficher leur destination dans les journaux. Chaque passe en traite au plus 50 : avec beaucoup de redirections, chacune est revérifiée tous les quelques jours plutôt que chaque jour.
- Modifier la destination d'une redirection oublie le résultat de son précédent contrôle, qui ne concernait plus la bonne adresse.

## 0.2.2 — 2026-11-14

- Les dossiers existent désormais côté API : l'administrateur peut les créer, les renommer et les supprimer. Le nom est unique sans distinction de casse (accents et emoji distincts), supprimer un dossier ne supprime jamais ses liens (ils en sortent simplement), et la liste indique combien de liens contient chaque dossier.

## 0.2.1 — 2026-11-14

- Les tags existent désormais côté API : l'administrateur peut les créer (nom unique sans distinction de casse (mais accents et emoji distincts), et couleur au format `#rrggbb`), les renommer, les recolorer et les supprimer, et la liste indique combien de liens utilisent chaque tag.

## 0.2.0 — 2026-11-14

- Côté API, on peut désormais contrôler si la destination d'une redirection répond encore (fonctionne, cassée ou non vérifiée) ; le résultat, avec le code HTTP obtenu et la date du contrôle, est enregistré.
- Sécurité : la vérification ne contacte jamais une adresse interne ou privée. Une telle destination reste utilisable comme redirection mais est signalée comme non vérifiée.

## 0.1.8 — 2026-11-12

- Page d'envoi d'un dépôt : reprendre un envoi interrompu ne réduit plus une seconde fois la place restante, un nouveau fichier est accepté tant qu'il reste de la place.
- « Abandonner » un envoi dont le fichier n'existe plus sur le serveur le retire définitivement de la liste.
- Un fichier envoyé puis supprimé ou déplacé par l'administrateur s'affiche « Indisponible » au lieu de rester en « Vérification… ».

## 0.1.7 — 2026-11-12

- Depuis la fiche d'un dépôt, le bouton « Créer un partage » permet de choisir parmi les fichiers prêts ceux à partager, avec un slug, une expiration et un nombre de téléchargements maximum facultatifs ; la fiche du nouveau partage s'ouvre ensuite.
- Les fichiers sont déplacés vers le partage et non copiés : ils ne comptent donc pas deux fois dans la place utilisée, et ils disparaissent de la liste du dépôt.
- L'option « Fermer le dépôt », cochée par défaut, désactive le dépôt en même temps que le partage est créé.
- Le lien d'envoi d'un dépôt ne donne plus aucun accès aux fichiers déplacés dans un partage.

## 0.1.6 — 2026-11-12

- Nouvelle fiche de dépôt (`/drops/<slug>`) : réglages, état, nombre de vues, place utilisée, et liste des fichiers reçus avec leur état, leur expéditeur (ou « Anonyme ») et leur date de réception. L'état d'un fichier en cours de vérification se met à jour tout seul.
- Depuis la fiche d'un dépôt, un fichier reçu se télécharge directement, et se supprime après confirmation, y compris un envoi abandonné en cours. Si le stockage est injoignable, le fichier est conservé et un message l'indique.
- Le titre d'un dépôt dans la liste ouvre sa fiche, et l'origine d'un fichier dans la page « Fichiers » renvoie vers le dépôt (ou indique qu'il a été supprimé).

## 0.1.5 — 2026-11-11

- Nouvelle page publique `/u/<slug>` : un visiteur y voit le titre du dépôt, le nombre de fichiers et la place restants, la date de fermeture éventuelle, et peut envoyer des fichiers par glisser-déposer ou sélection, avec un nom facultatif. Un captcha est demandé pour chaque fichier, juste avant son envoi. Chaque fichier affiche sa progression, peut être annulé, et indique s'il est refusé (trop gros, plus de place, dépôt fermé) puis s'il est reçu ou rejeté.
- Un envoi interrompu (onglet fermé, coupure) se reprend depuis la même page en sélectionnant de nouveau le même fichier : seules les parties manquantes sont renvoyées, un autre fichier est refusé. Les envois non repris sont oubliés au bout de 7 jours.
- Un dépôt introuvable affiche « lien introuvable », un dépôt expiré ou plein « ce dépôt est fermé », et une limitation de débit indique le délai d'attente.
- Un fichier reçu dans un dépôt compte désormais comme utilisé : il n'apparaît plus parmi les fichiers orphelins, n'est plus compté dans leur taille et ne peut plus être supprimé depuis la page « Fichiers » tant que le dépôt existe.
- Les tailles s'affichent partout en unités binaires (Kio, Mio, Gio), comme celles saisies dans les formulaires : « 1014 Mio restants sur 1 Gio » au lieu d'un « 1014 Mo sur 1 Go » trompeur.
- Sécurité : le jeton secret d'un envoi n'est plus jamais conservé dans les erreurs affichées, et les entrées de reprise expirent après 7 jours.

## 0.1.4 — 2026-11-10

- Un visiteur peut maintenant envoyer des fichiers dans un dépôt ouvert, sans compte : un captcha est demandé pour chaque fichier, l’envoi peut être repris après une coupure et annulé par son expéditeur. Les limites du dépôt (nombre de fichiers et taille totale) sont respectées même quand plusieurs envois arrivent en même temps. Un envoi déjà commencé va jusqu’au bout si le dépôt expire ou se remplit entre-temps ; désactiver ou supprimer le dépôt l’arrête aussitôt.
- Sécurité : l’expéditeur d’un fichier reçoit un jeton secret qui lui seul permet de suivre, reprendre ou annuler son envoi ; il n’est conservé que sous forme hachée.

## 0.1.3 — 2026-11-10

- Page « Dépôts » du dashboard (`/drops`) : liste des liens `/u/` (titre, URL complète à copier, fichiers et taille reçus sur le maximum, état, expiration), création (titre, slug choisi ou généré, nombre de fichiers et taille totale maximum, expiration proposée à 7 jours et facultative), modification, désactivation et suppression après confirmation. Mêmes limites que l’API vérifiées dans le formulaire, erreurs traduites.

## 0.1.2 — 2026-11-10

- Un dépôt s’ouvre au public : sa page lit son titre et la place restante (fichiers et octets), sans rien montrer des envois reçus. Un dépôt expiré ou plein répond « expiré », et un lien désactivé, supprimé ou d’un autre type reste introuvable.

## 0.1.1 — 2026-11-07

- Nouveau : les dépôts. On les gère via `/api/drops` (liste, création, détail, modification, suppression), avec un titre et une expiration facultatifs et deux limites obligatoires : le nombre de fichiers (de 1 à 50) et la taille totale reçue.
- Chaque dépôt indique le nombre et la taille des fichiers reçus (hors fichiers refusés ou supprimés) et son état : ouvert, plein, expiré ou désactivé. Abaisser une limite sous ce qui a déjà été reçu ne supprime rien, le dépôt devient simplement plein.
- Les adresses d’un dépôt suivent les mêmes règles que celles des partages et des redirections, et un dépôt n’est jamais accessible par les adresses des redirections ou des partages.

## 0.1.0 — 2026-11-07

- Aucun changement visible : l'envoi de fichiers depuis les partages fonctionne comme avant, reprise, annulation et relance comprises.

## 0.0.15 — 2026-11-06

- Correction : la mise à jour de la base échouait sur un serveur MariaDB, ce qui empêchait le backend de démarrer.
- ⚠️ La stack complète de `docker-compose.yml` passe de MySQL à MariaDB 11, comme la prod : elle démarre sur un volume neuf (`mariadb-data`), et l'ancien `mysql-data` n'est pas repris. Si elle contient des données à garder, exportez-les avant de mettre à jour.

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
