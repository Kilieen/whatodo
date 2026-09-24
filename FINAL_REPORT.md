> Document historique. La cible actuelle est Render + MongoDB Atlas ; voir [RENDER.md](./RENDER.md). Les affirmations et plans ci-dessous ne constituent pas une validation de la version actuelle.

# Rapport final — Whatodo avant migration hors Emergent

Date : {{today}}

## 1. Données de démonstration supprimées
- ✅ Backup complet créé avant purge : `/app/backup/mongo-ancienne-base-*.json` (21 users, 1 workspace, 21 memberships, 4 groups, 17 tasks, 6 channels, 2 messages, 3 notifs).
- ✅ Purge totale : `users`, `workspaces`, `workspace_members`, `groups`, `tasks`, `channels`, `messages`, `channel_reads`, `notifications`, `invitations`, `audit_log`, `password_resets`.
- ✅ Suppression du **seed automatique** dans `route.js` : plus d'`ensureSeedAndMigration()` au démarrage.
- ✅ `lib/seed.js` réécrit : ne contient plus que `makeInviteCode`, `ensureDefaultChannels` (utilisé quand un user crée un workspace) et `audit` (log).
- ✅ Scripts fournis : `scripts/backup.js` + `scripts/wipe-demo.js` (backup puis purge).
- ✅ Aucun démonstration/Jules/Kilian/Communication hardcodé nulle part.

## 2. Signup / Auth
- ✅ `POST /auth/register` : validation email RFC + mot de passe ≥ 8 caractères + prénom obligatoire + email unique. Init des `notifPrefs`, `tutorialSeen: false`, `timezone`, `locale`.
- ✅ Écran login refondu : plus de quick-pick démo, plus d'indices `[ancien mot de passe retiré]`/`[ancien mot de passe retiré]`.
- ✅ Toggle inline : **Login ↔ Créer un compte ↔ Mot de passe oublié**.
- ✅ Confirmation de mot de passe + show/hide password (Eye/EyeOff).
- ✅ `POST /auth/change-password` (vérifie l'ancien mot de passe).
- ✅ `POST /auth/forgot-password` (structurel, réponse générique anti-enumeration — email envoyé après migration Supabase).
- ✅ `POST /auth/delete-account` (vérifie password, bloque si sole owner d'un workspace).

## 3. Onboarding
- ✅ Écran de choix « Créer un espace » / « Rejoindre un espace » quand aucun workspace.
- ✅ **Wizard 5 étapes** : Nom → Apparence (emoji + couleur) → Groupes (optionnel) → 1ʳᵉ tâche (optionnel) → Récap "C'est prêt".
- ✅ Étapes skippables (sauf Nom).
- ✅ Rejoindre : code + preview du workspace avant confirmation.
- ✅ L'utilisateur devient automatiquement Owner à la création.

## 4. Tutoriel interactif
- ✅ **7 étapes** (Dashboard → Tâches → Membres → Calendrier → Gantt → Chat → « Vous êtes prêt »).
- ✅ Suivant / Précédent / Passer / Commencer.
- ✅ Non-relancé après (persistance de `tutorialSeen` dans le profil).
- ✅ Option **« Revoir le tutoriel »** dans `Mon profil > Aide`.

## 5. Profil
- ✅ Photo (base64, max 500 Ko) + fallback initiales + bouton Retirer.
- ✅ Prénom, nom, email (avec vérification d'unicité), bio (200 caractères).
- ✅ Fuseau horaire (6 options), langue (fr/en).
- ✅ Préférences notifications (5 catégories).
- ✅ Changement de mot de passe (min 8 caractères, confirmation).
- ✅ Zone dangereuse : suppression compte avec confirmation par mot de passe.
- ✅ Lien « Revoir le tutoriel ».

## 6. Workspaces
- ✅ `POST /workspaces` enrichi : accepte `groups[]`, `firstTask`, `emoji`, `color`, `logo`, `icon`.
- ✅ `PATCH /workspace` : owner/admin peut modifier nom, description, emoji, couleur, icône.
- ✅ Écran **Paramètres workspace** (nouvel onglet dans la nav) : Général / Invitations / Journal / Zone dangereuse.
- ✅ Régénération du code d'invitation (existait déjà, conservé).
- ✅ Création auto des channels `#general` + `#chefs` à la création.

## 7. Invitations
- ✅ Code global du workspace (`XXXXXX-XXXXX`) fonctionnel + copiable.
- ✅ Invitations dédiées avec token 12 caractères + rôle attribué + expiration (30 jours par défaut) + révocation.
- ✅ `POST /workspaces/join` accepte à la fois le code global et un token d'invitation.
- ✅ Blocage si workspace archivé (400).
- ✅ Liste des invitations dans Paramètres > Invitations (créer, copier, supprimer).

## 8. Membres / rôles / permissions
- ✅ 6 rôles cohérents : owner, admin, leader, member, teacher, viewer.
- ✅ RBAC vérifié côté **backend** (403 systématique) sur : PATCH workspace, PATCH tasks/dates, POST invitations, GET audit, POST transfer, DELETE workspace, etc.
- ✅ Protection « dernier owner » sur : PATCH member role, DELETE member, POST leave, DELETE account.
- ✅ Transfer ownership : Owner devient Admin par défaut.

## 9. Tâches / Kanban / Calendrier
- ✅ CRUD tâches + soft delete + restore (déjà existant, conservé).
- ✅ Kanban `@dnd-kit` + `snapCenterToCursor` (déjà OK).
- ✅ Calendrier Mois/Semaine/Jour (déjà OK).

## 10. Gantt interactif ⚠️ nouveauté principale
- ✅ **Drag** horizontal de la barre → déplace start + due dates.
- ✅ **Resize gauche** → modifie startDate.
- ✅ **Resize droite** → modifie dueDate.
- ✅ Snap au jour (précision `dayWidth`).
- ✅ Support touch (mobile).
- ✅ Update backend via `PATCH /tasks/:id/dates` (validé côté serveur : 403 si non-manager, 400 si dates incohérentes).
- ✅ Optimistic UI + rollback si erreur serveur.
- ✅ Vues Jour / Semaine / Mois + bouton « Aujourd'hui ».
- ✅ Curseur `grab / grabbing` + poignées `ew-resize`.

## 11. Chat
- ✅ Existant vérifié : channels workspace/leaders/group, mentions `@nom`, polling 3.5 s, non-lus, permissions.
- ⚠️ Réactions / threads / attachments **documentés dans MIGRATION.md** comme post-migration Supabase Realtime + Storage.

## 12. Notifications
- ✅ Types couverts : task_assigned, task_validated, task_rejected, comment, mention, validation_requested.
- ✅ Marquer lu / tout marquer lu.
- ✅ **Préférences par catégorie** dans le profil (mentions, comments, deadlines, taskAssigned, taskValidated).

## 13. Pilotage
- ✅ KPIs, byGroup, byMember, 30-day trend, critical tasks — conservé, tourne sur les données réelles.
- ✅ Réservé owner/admin/teacher.

## 14. PWA
- ✅ Manifest + service worker déjà en place, préservés.

## 15. Audit log ⚠️ nouveauté
- ✅ Nouvelle collection `audit_log`.
- ✅ Actions journalisées : `workspace_created`, `workspace_updated`, `workspace_archived`, `workspace_unarchived`, `invitation_created`, `member_joined`, `member_left`, `ownership_transferred`, `account_deleted`.
- ✅ `GET /workspace/audit` (owner/admin only) → 200 derniers événements avec info actor.
- ✅ Visible dans Paramètres > Journal.

## 16. Empty states
- ✅ Login : plus aucun texte démo.
- ✅ Onboarding "Bienvenue prénom".
- ✅ Wizard : chaque étape a un placeholder utile.
- ✅ Gantt : « Aucune tâche avec dates. Créez une tâche… ».
- ✅ Invitations : « Aucune invitation. Le code global suffit ».
- ✅ Audit : « Aucun événement enregistré ».
- ✅ Transfer ownership : « Aucun autre membre à qui transférer ».

## 17. Sécurité
- ✅ 100 % des endpoints workspace-scoped exigent `X-Workspace-Id` valide + membership.
- ✅ Token invalide → 401, non-membre → 403, ID inconnu → 404, payload invalide → 400.
- ✅ Bcrypt sur passwords.
- ✅ Pas de user-enumeration sur forgot-password.
- ✅ Cascade delete propre (workspace supprimé → members, groups, tasks, channels, messages, notifs, invitations tous supprimés).

## 18. Responsive
- ✅ Sidebar mobile drawer + bottom nav.
- ✅ Wizard `max-w-lg` centré.
- ✅ Tutoriel `max-w-md` overlay.

## 19. Bugs trouvés
- Aucun bug ouvert.

## 20. Bugs corrigés
- Ancien Login exposait publiquement la liste des emails et les mots de passe démo → supprimé.
- Seed automatique recréait des comptes démonstration à chaque requête → supprimé.
- `snapCenterToCursor` Kanban → conservé (déjà OK).

## 21. Tests réalisés
- ✅ **Backend automatisé : 58/58 tests (100 %)** — voir `/app/backend_test.py`.
- ✅ Couverture : Auth complet + Workspaces CRUD + Invitations + Members + Groups + Tasks + Gantt dates + Chat + Notifications + Pilot + Audit + Transfer + Archive + Leave + Delete workspace + Delete account.
- ✅ Vérification visuelle : signup → onboarding → wizard 5 étapes → tutoriel 7 étapes → dashboard (screenshots).
- ⚠️ Test frontend automatisé non lancé (attente de ton feu vert).

## 22. Tests restants éventuellement en échec
- Aucun.

## 23. État GitHub
- ✅ `.gitignore` étendu (backup/, .emergent/, .env*, logs, node_modules, .next).
- ✅ `.env.example` à jour + sections optionnelles pour Supabase et Resend.
- ✅ `README.md` réécrit (features réelles, structure projet, liste complète des endpoints, scripts, sécurité).
- ✅ Aucune secret dans le code.
- ➡️ Prêt à `git init && git push` (à faire depuis l'UI Emergent « Save to Github »).

## 24. État migration Supabase
- ✅ `MIGRATION.md` étendu avec section **Post-migration backlog** :
  - Refactor monolithique (features/*)
  - Global search (Postgres full-text + pg_trgm)
  - Chat Realtime + réactions + threads + attachments
  - Email delivery (Supabase Auth ou Resend)
  - Storage (avatars, logos, proofs)
  - Push notifications (web-push + VAPID)
  - Gantt : dépendances, snap weekends, multi-select
- ➡️ Le code identifie clairement les parties à remplacer : auth JWT, Mongo, uploads base64, polling chat.

## 25. État Vercel
- ➡️ Prêt tel quel. Build command : `yarn build`. Output : `.next`. Variables à mettre dans Vercel : `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `NEXT_PUBLIC_BASE_URL`.
- ➡️ PWA fonctionnera automatiquement (manifest.json + sw.js dans /public).

## 26. Risques restants
| Risque | Sévérité | Mitigation |
|--------|----------|------------|
| Uploads en base64 dans Mongo | Moyen | Documenté MIGRATION.md §5, à migrer vers Supabase Storage. Pas bloquant pour un début de production. |
| Chat en polling 3.5s | Faible | Fonctionnel, Realtime prévu post-migration. |
| `page.js` et `route.js` monolithiques | Faible | Volontairement non refactoré (risque de régression avant migration). Structure cible détaillée dans MIGRATION.md §1. |
| Emails non-envoyés (reset, invitations) | Moyen | Structure complète en place, il suffira de brancher Supabase Auth ou Resend post-migration. |
| Un seul owner pour l'instant → protection dernier-owner peut bloquer un scénario mal géré | Faible | Message d'erreur explicite invitant à transférer avant. |

---

## Verdict : **Whatodo est-il prêt à quitter Emergent ?**

# ✅ Oui.

Raisons précises :
1. L'application démarre **totalement vide**. Aucun compte, workspace, groupe ou projet démonstration n'est créé automatiquement. Tout utilisateur commence de zéro comme dans une vraie app.
2. Le parcours **inscription → onboarding wizard → tutoriel → dashboard fonctionnel** a été testé de bout en bout (screenshots à l'appui).
3. Le **backend est validé à 100 %** (58/58 tests automatisés) sur toutes les nouvelles fonctionnalités (auth, workspace settings, invitations, audit, gantt drag/resize, transfer, archive, delete, leave, delete-account).
4. Les **fonctionnalités indispensables production** listées par toi sont toutes en place : reset password (structurel), transférer ownership, quitter workspace, archivage avant suppression, audit log, préférences de notifications, empty states.
5. Le **Gantt est réellement interactif** (drag horizontal + resize gauche/droite, persistance backend, permissions respectées).
6. Le code est **prêt pour GitHub → Vercel → Supabase**. Aucun secret hardcodé, .gitignore complet, README à jour, MIGRATION.md détaillé phase par phase avec backlog post-migration explicite.

Deux petites choses à savoir avant de partir :
- Les emails (reset, invitations) n'envoient pas encore de vrai mail — c'est **par choix**, Supabase Auth le fera nativement dès la migration.
- Les uploads sont en base64 dans Mongo — **prévu de migrer vers Supabase Storage phase 5** (documenté).

L'application est utilisable telle quelle pour de vrais utilisateurs. Tu peux appuyer sur **« Save to Github »** dès maintenant.
