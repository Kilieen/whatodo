# Soutien volontaire via TWINT

Le bouton « Faire un don » se trouve au bas de la sidebar (menu latéral sur mobile). Il ouvre une modal utilisant les composants, couleurs et boutons existants.

## Fonctionnement

1. Prénom et nom obligatoires, limités à 80 caractères.
2. Montants rapides CHF 1, 2, 5 et 10 ; montant personnalisé de CHF 0.01 à CHF 200.00 avec deux décimales au maximum. Le point et la virgule sont acceptés.
3. « Continuer avec TWINT » affiche le récapitulatif, le numéro destinataire et les instructions d'envoi manuel dans l'app TWINT.
4. « Copier le numéro » copie le numéro au format international. En cas de refus du presse-papiers, le numéro reste visible et est sélectionné pour une copie manuelle.

Le numéro est défini à un seul endroit : `DONATION_CONFIG.phone` dans `lib/donations.js`. Aucune variable Render supplémentaire n'est nécessaire.

## TWINT : méthode vérifiée

Documentation officielle consultée le 24 septembre 2026 :

- [Envoi d'argent à un numéro depuis l'app](https://www.twint.ch/fr/faq/comment-envoyer-ou-demander-de-largent-a-un-autre-utilisateur-twint/).
- [Accès à l'API TWINT](https://www.twint.ch/en/faq/how-do-i-as-a-software-developer-receive-the-twint-api/) : l'API n'est pas publiquement accessible.
- [Documentation des liens de paiement](https://www.twint.ch/content/uploads/2024/11/Paylink-Dokumentation_EN.pdf) : les liens officiels sont obtenus via le portail commerçant.

Aucun mécanisme public officiellement documenté n'a été identifié pour fabriquer un lien P2P à partir d'un numéro et d'un montant. Aucun lien marchand n'a été fourni. **Le fallback manuel est donc utilisé sur desktop, mobile et PWA.** Aucun schéma d'URL TWINT, lien de paiement ou QR code n'est inventé. Le guide officiel s'ouvre dans un nouvel onglet ; ce n'est pas un bouton qui lance un paiement.

La modal ne promet pas « TWINT va s'ouvrir » : elle demande explicitement d'ouvrir l'application manuellement. Elle n'affiche jamais de paiement réussi et n'en déduit aucun statut.

## Données et limites

- Aucun endpoint, aucune collection MongoDB et aucun suivi de don ne sont créés.
- Les données du formulaire restent en mémoire dans le composant, ne sont pas envoyées au serveur ni à TWINT, et sont effacées à la fermeture. Le montant reste affiché tant que la modal reste ouverte, y compris au retour de TWINT.
- Aucun statut `paid`, aucun secret, aucune donnée bancaire, aucun paiement automatique.
- Aucune fonctionnalité de Whatodo ne dépend d'une contribution.
- Une vraie ouverture automatique nécessiterait une méthode officiellement supportée et, selon le cas, un lien commerçant fourni par TWINT. Ce lot n'ajoute pas d'intégration marchande.

## Tests

```sh
yarn test
yarn build
```

Les tests locaux existants restent disponibles : `yarn test:integration` et `tests/browser-smoke.cjs` (voir `RENDER.md` pour la base jetable).

`tests/donations-browser.cjs` utilise la même fixture locale et Playwright installé séparément, avec `WHATODO_PLAYWRIGHT_PATH` et `WHATODO_TEST_FIXTURE`. Il vérifie la validation, les montants, la copie/refus du presse-papiers, le clavier, le focus, Escape, le responsive et l'absence de transmission/persistance des noms. Le mode PWA est simulé avec un service worker actif ; il ne remplace pas un essai sur téléphone physique. Aucun paiement réel n'est exécuté.

## Git

Vérifications locales effectuées le 24 septembre 2026 : 9 tests unitaires réussis, 13 tests API réussis avec MongoDB jetable, parcours de don desktop/mobile réussis, suite navigateur existante réussie et `yarn build` réussi. Captures desktop/mobile inspectées. Aucun essai de paiement réel ni test sur téléphone physique.

Branche : `feature/donations-twint`, créée depuis `fix/stabilisation-whatodo` au commit `015c043`. La fonctionnalité s'appuie sur cette version stabilisée. Aucun merge ou déploiement n'est effectué.

Après relecture :

```sh
git diff --check
git add app/page.js components/donation-support.jsx lib/donations.js package.json tests/donations.test.cjs tests/donations-browser.cjs DONATIONS.md
git commit -m "Add optional TWINT donation instructions"
git push -u origin feature/donations-twint
```

Si la stabilisation n'est pas encore intégrée à `main`, comparer cette branche à `fix/stabilisation-whatodo` pour examiner uniquement la fonctionnalité de don.
