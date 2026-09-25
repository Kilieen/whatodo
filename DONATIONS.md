# Soutien volontaire via TWINT

Le bouton « Faire un don » se trouve au bas de la sidebar (menu latéral sur mobile). Il ouvre une modal utilisant les composants, couleurs et boutons existants.

## Fonctionnement

1. Prénom et nom obligatoires, limités à 80 caractères.
2. Montants rapides CHF 1, 2, 5 et 10 ; montant personnalisé de CHF 0.01 à CHF 200.00 avec deux décimales au maximum. Le point et la virgule sont acceptés.
3. « Continuer avec TWINT » affiche le récapitulatif, le numéro destinataire et les instructions d'envoi manuel dans l'app TWINT.
4. « Copier le numéro » copie le numéro au format international. En cas de refus du presse-papiers, le numéro reste visible et est sélectionné pour une copie manuelle.
5. « J’ai fait le don » enregistre une déclaration utilisateur et notifie les owner/admin actifs de l’espace. La modal affiche ensuite « Ta déclaration de don a bien été enregistrée ».
6. « Abandonner » ferme la modal sans requête ni enregistrement. Après une déclaration déjà envoyée, fermer la fenêtre n’annule pas l’enregistrement.

Le numéro est défini à un seul endroit : `DONATION_CONFIG.phone` dans `lib/donations.js`. Aucune variable Render supplémentaire n'est nécessaire.

## TWINT : méthode vérifiée

Documentation officielle consultée le 24 septembre 2026 :

- [Envoi d'argent à un numéro depuis l'app](https://www.twint.ch/fr/faq/comment-envoyer-ou-demander-de-largent-a-un-autre-utilisateur-twint/).
- [Accès à l'API TWINT](https://www.twint.ch/en/faq/how-do-i-as-a-software-developer-receive-the-twint-api/) : l'API n'est pas publiquement accessible.
- [Documentation des liens de paiement](https://www.twint.ch/content/uploads/2024/11/Paylink-Dokumentation_EN.pdf) : les liens officiels sont obtenus via le portail commerçant.

Aucun mécanisme public officiellement documenté n'a été identifié pour fabriquer un lien P2P à partir d'un numéro et d'un montant. Aucun lien marchand n'a été fourni. **Le fallback manuel est donc utilisé sur desktop, mobile et PWA.** Aucun schéma d'URL TWINT, lien de paiement ou QR code n'est inventé. Le guide officiel s'ouvre dans un nouvel onglet ; ce n'est pas un bouton qui lance un paiement.

La modal ne promet pas « TWINT va s'ouvrir » : elle demande explicitement d'ouvrir l'application manuellement. Elle n'affiche jamais de paiement réussi et n'en déduit aucun statut de paiement vérifié.

## Déclarations, notifications et confidentialité

`POST /api/donations` réutilise le JWT et `X-Workspace-Id` existants. Le serveur exige un utilisateur connecté, membre actif d’un workspace accessible et non archivé. Les viewers peuvent déclarer leur propre don ; leurs permissions sur les tâches et autres données ne changent pas.

Le serveur valide les noms (non vides, 80 caractères maximum), le montant (CHF 0.01 à 200.00, deux décimales maximum), la devise CHF et un identifiant UUID de soumission. Il déduit `userId` et `workspaceId` de la session et crée lui-même `status: "declared_paid"`, sans accepter de statut arbitraire du client.

La collection `donations` contient `_id`, `id`, `workspaceId`, `userId`, `firstName`, `lastName`, `amount` (nombre en CHF), `currency`, `status` et `createdAt`. Aucun numéro TWINT ni donnée bancaire n’y est stocké. Aucune écriture n’a lieu à l’ouverture des instructions.

Le navigateur bloque les doubles clics et conserve le même UUID lors d’une nouvelle tentative. L’index MongoDB unique natif `_id`, composé du workspace, de l’utilisateur et de cet UUID, empêche les doublons concurrents, y compris entre plusieurs instances Render. Un UUID réutilisé avec d’autres noms ou montant donne une erreur 409. Cette protection concerne une même soumission ; elle n’interdit pas plusieurs déclarations volontaires distinctes.

Après l’écriture, le serveur recherche les memberships actifs `owner`/`admin` du même workspace et crée une notification par destinataire dans la collection `notifications` existante : titre « Nouveau don déclaré ❤️ », prénom, nom et montant dans le message, type `donation_declared`, lien `notifs`, état non lu. Le numéro TWINT n’est pas inclus. La lecture des notifications filtre aussi ce type selon le rôle actuel, pour qu’un administrateur rétrogradé n’y ait plus accès. Le rafraîchissement existant des notifications les affiche.

Chaque notification a un identifiant unique dérivé de la déclaration et du destinataire. Les écritures sont idempotentes : une nouvelle tentative complète les notifications manquantes après une erreur partielle. Sans transaction, si le serveur s’arrête entre ces écritures et que l’utilisateur ne réessaie pas, une déclaration peut rester enregistrée sans toutes ses notifications.

La suppression d’un workspace supprime aussi ses déclarations ; la suppression d’un compte supprime les déclarations de cet utilisateur. Les notifications déjà remises aux autres destinataires suivent leur cycle de vie existant.

**Aucun paiement n’est vérifié par Whatodo.** `declared_paid` signifie uniquement « l’utilisateur indique avoir effectué le don ». Il n’y a ni API bancaire/TWINT, ni secret, ni statut de paiement confirmé. Aucun accès à une fonctionnalité ne dépend d’un don. Aucune variable Render ou dépendance supplémentaire n’est nécessaire.

## Tests

```sh
yarn test
yarn build
```

Les tests locaux existants restent disponibles : `yarn test:integration` et `tests/browser-smoke.cjs` (voir `RENDER.md` pour la base jetable).

`tests/donations-browser.cjs` utilise la même fixture locale et Playwright installé séparément, avec `WHATODO_PLAYWRIGHT_PATH` et `WHATODO_TEST_FIXTURE`. Il vérifie la validation, les montants, la copie/refus du presse-papiers, le clavier, le focus, Escape, le responsive et l'absence de transmission avant déclaration, l’abandon sans requête, le double clic, une réponse perdue après enregistrement puis une nouvelle tentative avec le même UUID. Le mode PWA est simulé avec un service worker actif ; il ne remplace pas un essai sur téléphone physique. Aucun paiement réel n'est exécuté.

Validation locale du 24 septembre 2026 : 9 tests unitaires, 14 tests API (parent inclus), parcours de don desktop/mobile et suite navigateur existante réussis ; build production réussi. Le scénario existant de timeout réseau a nécessité une relance après un délai intermittent. Tests exécutés avec MongoDB jetable, sans accès à Atlas ni paiement réel.

## Git

Branche : `feature/donation-tracking`, basée sur la fonctionnalité `feature/donations-twint`. Aucun push, merge ou déploiement effectué.

```sh
git diff --check
git add 'app/api/[[...path]]/route.js' components/donation-support.jsx tests/stability.test.cjs tests/donations-browser.cjs tests/browser-smoke.cjs DONATIONS.md
git commit -m "Track user-declared TWINT donations and notify workspace admins"
git push -u origin feature/donation-tracking
```

## Correction du clic sur notification (25 septembre 2026)

La notification utilisait déjà `type: donation_declared`. Son `id` de la forme `donation:<UUID>:<UUID>` était envoyé au clic à `POST /api/notifications/mark-read`. La validation générique `id()` n’acceptait pas les deux-points : l’erreur provenait du marquage comme lu, sans appel à une tâche ni conversion ObjectId.

Un validateur dédié accepte les IDs de notification ordinaires et ce format composite strict, uniquement pour le marquage comme lu. Les validations des autres ressources restent inchangées. Les anciens documents restent compatibles, sans migration. Les nouvelles notifications portent aussi `donationId`, `firstName`, `lastName`, `amount` et `currency`.

Le clic est traité explicitement par type : les dons ouvrent une modal de déclaration et sont marqués comme lus ; les tâches, validations et mentions conservent leurs destinations ; les types inconnus sont seulement marqués comme lus. La modal utilise les champs structurés ou, pour les anciens documents, le message existant. Aucun paiement TWINT n’est vérifié.

Le test `tests/notifications-browser.cjs` utilise les mêmes variables Playwright et fixture que les autres tests navigateur. Le lancer après les tests API, avant `tests/browser-smoke.cjs` qui modifie le mot de passe de la fixture. Il couvre le vrai marquage comme lu, l’absence d’appel tâche au clic sur un don, les données anciennes, les types inconnus et la navigation d’une notification de tâche.
