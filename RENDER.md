# Déploiement Whatodo — Render + MongoDB Atlas

## Configuration à vérifier dans Render

Utiliser un **Web Service Node**, pas un site statique.

- Branche : conserver la branche actuellement choisie dans le tableau de bord Render. Le dépôt local ne permet pas de vérifier cette valeur. Aucun push ni déploiement automatique n'est effectué par les scripts de test.
- Node : `.node-version` fixe la version utilisée lors de la validation locale.
- Build : `yarn install --frozen-lockfile && yarn build` (le `yarn.lock` doit être inclus dans le commit déployé).
- Démarrage : `yarn start`. Next.js utilise le `PORT` fourni par Render et écoute par défaut sur toutes les interfaces.
- `NODE_ENV=production`.
- `MONGO_URL` : URI MongoDB Atlas, disponible au runtime, jamais préfixée `NEXT_PUBLIC_`.
- `DB_NAME` : **nom exact de la base de production existante**. Ne pas la renommer et ne pas sélectionner une nouvelle base lors de cette mise à jour. Le fallback historique a été supprimé : sans ce paramètre, l'API refuse la connexion plutôt que d'utiliser silencieusement une mauvaise base.
- `JWT_SECRET` : secret aléatoire d'au moins 32 caractères, disponible au build et au runtime. Conserver la valeur existante pour préserver les sessions. Une rotation déconnecte tous les utilisateurs.
- `CORS_ORIGINS` : origines autorisées séparées par des virgules si nécessaire. Le frontend appelle `/api` sur sa propre origine et ne dépend d'aucune `NEXT_PUBLIC_BASE_URL`.

`output: standalone` a été retiré : le build et `next start` utilisent désormais le même mode. Aucun changement de plateforme n'est requis.

## Avant et après le déploiement

1. Confirmer la base, les droits du compte MongoDB, les sauvegardes Atlas et la liste des IP autorisées pour les adresses de sortie Render.
2. Vérifier que les variables ci-dessus sont présentes, notamment `DB_NAME`, avant de déployer.
3. Vérifier le commit et la branche sélectionnés dans Render. Ne pas pousser sur `main` sans accord.
4. Déployer puis contrôler les logs de build/démarrage, une connexion utilisateur, le Dashboard et les API authentifiées.
5. Un contrôle de santé HTTP sur `/` vérifie seulement le serveur Next.js, **pas** MongoDB. La connexion MongoDB est paresseuse : vérifier également un parcours API authentifié.
6. Recharger une PWA existante. Le nouveau service worker purge les anciens caches Whatodo et ne stocke plus le HTML ni les API. L'application nécessite une connexion réseau ; l'écran hors ligne conserve la session et propose de réessayer.

## Vérification locale sans Atlas

```sh
yarn test
# Variables factices de test uniquement ; utiliser une base locale jetable.
JWT_SECRET='<secret-local-de-test-de-32-caracteres-minimum>' DB_NAME=whatodo_test MONGO_URL='mongodb://127.0.0.1:27017' yarn build
JWT_SECRET='<même-secret-local>' DB_NAME=whatodo_test MONGO_URL='mongodb://127.0.0.1:27017' PORT=3100 yarn start
WHATODO_TEST_MONGO_URL='mongodb://127.0.0.1:27017' WHATODO_TEST_BASE_URL='http://127.0.0.1:3100/api' WHATODO_TEST_FIXTURE='/tmp/whatodo-test-fixture.json' yarn test:integration
```

Les tests d'intégration écrivent dans `whatodo_test` et refusent une URI non locale. Ils doivent être exécutés avec une base **jetable** dont les variables correspondent au serveur démarré. Ils ne doivent jamais cibler Atlas. Les inscriptions sont limitées par IP : redémarrer le serveur ou attendre avant des exécutions rapprochées.

Le test navigateur optionnel `tests/browser-smoke.cjs` utilise Playwright installé séparément, via `WHATODO_PLAYWRIGHT_PATH`, et la fixture locale créée ci-dessus via `WHATODO_TEST_FIXTURE`. Il vérifie une vraie fermeture/réouverture de Chromium, le timeout de 15 secondes, les erreurs récupérables, les groupes, les salons et le renouvellement JWT. Aucune dépendance de production n'a été ajoutée pour ces tests.

## Limites conservées

- Pas d'envoi d'email de récupération configuré ni d'écran de saisie du token de reset. L'API reset renvoie un JWT valide, que le client sait conserver ; aucun token de reset n'est écrit dans les logs.
- Une personne appartient à un seul groupe. Les champs de couleur/emoji n'existaient pas pour les groupes et n'ont pas été ajoutés.
- Un groupe contenant des tâches (y compris en corbeille) ne peut pas être supprimé. Restaurer et déplacer ces tâches auparavant. Les salons du groupe sont archivés, leurs messages conservés.
- Les owners/admins peuvent consulter les salons privés et archivés pour les gérer ; les viewers ne peuvent pas écrire. Les notifications personnelles peuvent être marquées comme lues.
- Les écritures multi-documents existantes ne sont pas toutes transactionnelles. La gestion de forte concurrence, les index et les sauvegardes réelles Atlas restent à auditer dans l'environnement déployé.
- Les vulnérabilités de dépendances signalées par l'audit précédent restent à traiter dans un lot de mises à jour ciblées ; aucune mise à jour majeure n'a été introduite ici.
