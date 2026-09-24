# Stabilisation ciblée Whatodo

## Résultat

Architecture conservée : Next.js + Render + MongoDB Atlas, JWT dans localStorage, polling du chat, fichiers joints dans MongoDB. Aucun changement majeur de dépendances, aucune migration, aucun fichier supprimé, aucun push ou déploiement effectué.

### Produit

- Retrait du bloc événement et du compte à rebours de démonstration : aucune donnée de workspace ne les alimentait. Exemples d'onboarding rendus génériques. Les anciens noms et identifiants de démonstration des rapports ont été neutralisés, sans supprimer les rapports.
- Gestion des groupes depuis « Tous groupes » : création, nom, description, leader, membres, modification et suppression confirmée. Les couleurs/emojis n'existaient pas dans le modèle de groupe ; ils n'ont pas été inventés.
- Un groupe avec des tâches ne peut pas être supprimé. Les admins/owners peuvent désormais changer le groupe d'une tâche depuis sa fiche. Les tâches supprimées doivent d'abord être restaurées. Supprimer un groupe vide détache ses membres et archive ses salons sans effacer leurs messages.
- Gestion des salons : création workspace/groupe/privé, nom, membres des salons privés, renommage, archivage/réactivation. Les canaux automatiques continuent à fonctionner et les nouveaux groupes reçoivent leur canal.
- Chat : les 200 messages les plus récents sont chargés, avec accès aux messages précédents et curseur stable même si plusieurs messages ont la même date. Les requêtes de polling ne se superposent pas pour un même canal.

### Fiabilité et permissions

- Connexion MongoDB initialisée via une promesse partagée, délais bornés et nouvelle tentative possible après échec. L'appel est dans le traitement d'erreur de l'API.
- Session persistante conservée sur panne réseau, timeout ou erreur serveur. Seules les erreurs d'authentification avérées déclenchent la déconnexion ; un 403 de workspace ne détruit pas le JWT.
- JWT renouvelé stocké automatiquement après changement ou reset de mot de passe.
- Client API : timeout de 15 secondes, erreurs distinctes, déduplication des GET identiques en cours. États d'erreur et reprise sur les vues principales ; changement de workspace réinitialisant leur état.
- Membres inactifs bloqués, réactivation via code d'invitation interdite, owner protégé des modifications/suppressions par admin, viewer en lecture seule. Marquer ses notifications comme lues ou quitter un espace reste possible.
- Accès aux groupes et tâches contrôlé côté serveur. Tâches sans groupe limitées au créateur/personnes assignées et aux rôles de lecture globale. Tâches supprimées inaccessibles hors restauration par owner/admin.
- Assignés ordinaires ne pouvant pas passer directement une tâche à `done`. Validation réservée au responsable, avec preuve requise si configurée.
- Workspaces archivés non modifiables ; désarchivage et départ restent permis selon le rôle.
- IDs, appartenance au workspace, tableaux, statuts, priorités, dates, textes et tailles de requêtes contrôlés. Le frontend tolère les anciens statuts inconnus sans planter.
- Synchronisation des adhésions et des membres des groupes après les changements ; retrait du leader s'il devient inactif, quitte son groupe/espace ou supprime son compte.
- Jetons de reset retirés des logs ; message de récupération honnête sur l'absence d'envoi d'email. CORS appliqué avec l'origine de la requête sur toutes les réponses.

### Déploiement et cache

- Retrait de `output: standalone`, conservation de `next start` et du support du `PORT` fourni par Render.
- Version Node fixée à la version testée localement ; modèle d'environnement fourni.
- Suppression du nom de base implicite hérité dans l'application et les scripts : **définir DB_NAME avec le nom exact de la base Atlas existante avant déploiement**. Ne pas renommer la base. Conserver JWT_SECRET pour ne pas déconnecter les utilisateurs.
- Le service worker purge uniquement les anciens caches Whatodo, ne stocke ni HTML ni API et affiche un fallback hors ligne. La session persistante n'est pas effacée.

## Fichiers modifiés ou ajoutés

| Fichier | Changement |
|---|---|
| `app/page.js` | Groupes/salons, retrait de démonstration, loaders/reprise, état de session, contrôles de lecture seule, déplacement des tâches. |
| `app/api/[[...path]]/route.js` | Endpoints groupes/canaux, permissions, validations, pagination chat, interception Mongo, reset et CORS. |
| `lib/api-client.js` — nouveau | Client API commun : délais, erreurs, persistance JWT et déduplication GET. |
| `lib/validation.js` — nouveau | Validations ciblées et synchronisation des groupes. |
| `lib/authz.js` | Membres actifs, visibilité des groupes/tâches et canaux privés. |
| `lib/mongo.js` | Promesse de connexion partagée, retry et délais ; DB_NAME explicite. |
| `lib/seed.js` | Commentaire rendu générique ; helpers conservés. |
| `public/sw.js` | Suppression des caches HTML obsolètes et fallback réseau. |
| `next.config.js` | Retrait du mode standalone. |
| `package.json` | Ajout des commandes de tests ; dépendances inchangées. |
| `.node-version` — nouveau | Version Node testée : 24.21.0. |
| `.env.example` — nouveau | Variables de la stack actuelle, sans secret. |
| `.gitignore` | Autorise le suivi du modèle `.env.example`. |
| `scripts/backup.js` | Nom de base explicite obligatoire, retrait du fallback hérité. |
| `scripts/wipe-demo.js` | Même contrôle ; script destructif conservé et non exécuté. |
| `backend_test.py` | URL de test configurable, localhost par défaut au lieu de l'ancienne plateforme. Non exécuté pendant cette intervention. |
| `tests/core.test.cjs` — nouveau | Régressions Mongo, session, client API et service worker. |
| `tests/stability.test.cjs` — nouveau | Tests API avec MongoDB locale jetable. |
| `tests/browser-smoke.cjs` — nouveau | Parcours Chromium avec vraie persistance de profil et pannes simulées. |
| `README.md` | Stack réelle, déploiement actuel, limites de reset et cache. |
| `RENDER.md` — nouveau | Configuration Render/Atlas, prérequis, procédures de test et limites. |
| `MIGRATION.md` | Marqué comme historique ; aucune migration exécutée. |
| `FINAL_REPORT.md` | Marqué comme historique et anciennes références neutralisées. |
| `test_result.md` | Anciennes références et identifiants de démonstration neutralisés. |
| `STABILIZATION_REPORT.md` — nouveau | Présent compte rendu. |

`yarn.lock` était déjà présent et non suivi au début de l'intervention ; il n'a pas été modifié. Il devra accompagner le futur commit pour rendre les installations reproductibles.

## Vérifications

- Build de production avec Next.js 15.5.18 / Node 24.21.0 : réussi.
- Démarrage `next start` avec `NODE_ENV=production` et port local 3100 : réussi, sans avertissement standalone.
- Tests unitaires (`node --test tests/core.test.cjs`) : 5 réussis.
- Tests API (`tests/stability.test.cjs`) : 12 scénarios imbriqués réussis, 13 tests comptabilisés par le runner, avec un vrai MongoDB 7.0.14 jetable local.
- Tests Chromium : reload, fermeture/réouverture du navigateur, 503 sans déconnexion, timeout avec reprise, groupes/leader/membres, salon privé, envoi/archivage, lecture au-delà de 200 messages, suppression confirmée, loaders, changement de mot de passe, viewer lecture seule et 401 réel. Aucun appel à Atlas.
- `git diff --check` : réussi.

## À vérifier ou traiter séparément

- Paramètres, branche/commit, logs, variables et état effectif du service Render : non accessibles depuis le dépôt. La branche locale est `main`, sans push effectué.
- Index, doublons, sauvegardes, droits et règles réseau réels d'Atlas : non vérifiés sur la production.
- L'envoi d'email de récupération et l'écran de saisie du token de reset restent à implémenter. L'API reset et le stockage de son JWT sont testés.
- Pas de migration de données existantes ni de nettoyage de base effectué. Les données historiques présentes dans Atlas ne sont pas effacées par cette mise à jour.
- Les écritures multi-documents ne sont pas toutes transactionnelles ; une passe dédiée reste nécessaire pour les fortes concurrences et les défaillances partielles.
- Les alertes de sécurité des dépendances relevées pendant l'audit précédent restent à corriger dans un lot ciblé : aucune mise à jour majeure n'a été effectuée dans ce lot produit.
- `scripts/wipe-demo.js` efface les collections configurées : ne pas l'exécuter en production. Aucun script de purge n'a été lancé.
