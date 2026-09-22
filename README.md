# Whatodo

> Task & team coordination — a lightweight, multi-workspace project management platform.

Whatodo lets teams organize tasks across multiple workspaces with role-based permissions, Kanban boards, calendar, an **interactive Gantt** (drag/resize), channel-based chat, notifications, and an admin pilot dashboard.

> Whatodo starts **completely empty**. Every user, workspace, group and task is created by real users. There is no demo data, no hard-coded account.

## Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui, dnd-kit, lucide-react
- **Backend**: Next.js API routes (single file, monolithic today — will be split post-migration)
- **Database**: MongoDB via native driver (will be replaced by Supabase Postgres after migration)
- **Auth**: custom JWT (jsonwebtoken + bcryptjs) — will be replaced by Supabase Auth after migration
- **PWA**: manifest + service worker (offline shell caching)

## Features

- Real signup / login / password change / delete-account (with password confirmation, show/hide, strength check)
- Password-reset flow structured (email delivery is handled by Supabase Auth after migration)
- User profile: avatar, timezone, locale, bio, notification preferences
- Multi-step **onboarding wizard** (name → identity → groups → first task → ready)
- Interactive **tutorial tour** (5-7 steps) on first workspace, replayable from Profile
- Multi-workspace with per-workspace roles: `owner`, `admin`, `leader`, `member`, `teacher`, `viewer`
- Invite via short code + per-invitation tokens (revoke / expire)
- Workspace settings: general, invitations, audit log, danger zone (leave / transfer ownership / archive / delete)
- Tasks: statuses, priorities, assignees, proofs (base64 upload today — Storage after migration), comments, soft delete + restore
- Kanban board with drag & drop (dnd-kit + `snapCenterToCursor`)
- Calendar (month / week / day) with filters
- **Interactive Gantt** — drag to move a bar, resize left/right handles to shift start/end dates (owner / admin / group leader only)
- Chat channels (workspace / leaders / group) with mentions and 3.5 s polling (Realtime after migration)
- Notifications on task assignment, validation, comment, mention — with per-user preferences
- Admin pilot dashboard: KPIs, donut chart, 30-day trend, member workload
- Empty states everywhere — the app never feels broken when empty
- Dark UI (navy + white) — mobile-first, PWA-installable

## Local development

```bash
# Install
yarn install

# Start MongoDB locally (or use Docker: docker run -d -p 27017:27017 mongo:7)
cp .env.example .env
# Edit .env to point MONGO_URL to your local Mongo and set a real JWT_SECRET

# Run
yarn dev
```

On first launch, no user exists. Create an account from the login screen (`Créer un compte`).

## Production build

```bash
yarn build
yarn start
```

## Project structure

```
app/
├── api/[[...path]]/route.js  # all API routes (monolithic — will be split post-migration)
├── page.js                   # main React app (single-page state machine)
├── layout.js                 # root layout with SW registration
├── globals.css               # design tokens + component classes
└── providers.js              # theme + query client + toaster

lib/
├── mongo.js                  # Mongo connection singleton
├── authz.js                  # JWT + permission helpers
└── seed.js                   # invite-code + default-channel + audit-log helpers

scripts/
├── backup.js                 # dump all Mongo collections to JSON (safety net)
└── wipe-demo.js              # backup + wipe (used to clean demo data)

public/
├── manifest.json
├── sw.js
├── icon-192.png / icon-512.png
└── favicon.svg
```

## Scripts

```bash
node scripts/backup.js     # write a timestamped JSON backup to /app/backup/
node scripts/wipe-demo.js  # backup, then wipe every collection (used once to remove demo data)
```

## API routes (base: `/api`)

### Auth (no workspace header required)
- `POST /auth/register`, `POST /auth/login`
- `GET /auth/me`, `PATCH /auth/me` (profile + notif prefs + tutorial state)
- `POST /auth/change-password`
- `POST /auth/forgot-password` (structural — email delivery via Supabase Auth after migration)
- `POST /auth/delete-account`

### Workspaces (no header for list/create/join)
- `GET /workspaces`, `POST /workspaces`, `POST /workspaces/join`

### Workspace-scoped (require `X-Workspace-Id`)
- `GET /workspace`, `PATCH /workspace`, `DELETE /workspace`
- `POST /workspace/leave`, `POST /workspace/transfer-ownership`
- `POST /workspace/archive`, `POST /workspace/unarchive`
- `POST /workspace/regenerate-code`
- `GET/POST /workspace/invitations`, `PATCH/DELETE /workspace/invitations/:id`
- `GET /workspace/audit`
- `GET /workspace/members`, `PATCH/DELETE /workspace/members/:id`
- `GET /users`, `GET/POST /groups`, `GET /groups/:id`
- `GET/POST /tasks`, `GET/PATCH/DELETE /tasks/:id`, `POST /tasks/:id/restore`
- `POST /tasks/:id/comments`, `POST /tasks/:id/proofs`, `POST /tasks/:id/validate`
- **`PATCH /tasks/:id/dates`** — drag/resize commit endpoint for Gantt
- `GET /calendar`, `GET /channels`, `GET/POST /channels/:id/messages`
- `GET /notifications`, `POST /notifications/mark-read`
- `GET /pilot`, `GET /validation-queue`, `GET /dashboard`

## Security

- Every request checks the JWT + workspace membership.
- Task deletion is scoped per-role server-side (creator / group-leader / admin / owner).
- Last-owner protection: an owner cannot be demoted / removed / delete their account if they are the only owner of a workspace.
- Deleted tasks use soft delete (`deletedAt`) so owner/admin can restore them.
- Workspace archival is soft (`archivedAt`) — data preserved.

## Migration

See [MIGRATION.md](./MIGRATION.md) for the full plan to move Whatodo out of Emergent to GitHub + Supabase + Vercel.
