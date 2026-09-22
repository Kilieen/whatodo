# Whatodo

> Task & team coordination — a lightweight, multi-workspace project management platform.

Whatodo lets teams organize tasks across multiple workspaces with role-based permissions, Kanban boards, calendar, Gantt chart, channel-based chat, notifications, and an admin pilot dashboard.

## Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui, dnd-kit, lucide-react
- **Backend**: Next.js API routes, MongoDB (native driver)
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **PWA**: manifest + service worker (offline shell caching)

## Features

- Multi-workspace with per-workspace roles (owner, admin, leader, member, teacher, viewer)
- Invite via short code (`EPCO-XXXXX`)
- Tasks: statuses, priorities, assignees, proofs (base64 upload), comments, soft delete + restore
- Kanban board with drag & drop (dnd-kit + snapCenterToCursor)
- Calendar (month/week/day) with filters
- Interactive Gantt with today marker
- Chat channels (workspace / leaders / group) with mentions and polling-based realtime
- Notifications on task assignment, validation, comment, mention
- Admin pilot dashboard with KPIs, donut chart, 30-day trend, member workload
- Members management with role & group editing
- Dark UI (navy + white) — mobile-first, PWA-ready

## Local development

```bash
# Install
yarn install

# Start MongoDB locally (or use Docker: docker run -d -p 27017:27017 mongo:7)
# Configure .env
cp .env.example .env

# Run
yarn dev
```

The app auto-seeds a demo workspace (EPCO — Speed Dating) with 4 groups and 21 users on first run.

### Demo credentials

| Role   | Email                | Password    |
| ------ | -------------------- | ----------- |
| Owner  | admin@epco.ch        | admin2026   |
| Leader | jules@epco.ch        | epco2026    |
| Member | hugo@epco.ch         | epco2026    |

## Production build

```bash
yarn build
yarn start
```

## Project structure

```
app/
├── api/[[...path]]/route.js  # all API routes (one file)
├── page.js                    # main React app (single-page state machine)
├── layout.js                  # root layout with SW registration
├── globals.css                # design tokens + component classes
└── providers.js               # theme + query client + toaster

lib/
├── mongo.js                   # Mongo connection singleton
├── authz.js                   # JWT + permission helpers
└── seed.js                    # first-run seed + EPCO migration + channels

public/
├── manifest.json
├── sw.js
├── icon-192.png
├── icon-512.png
└── favicon.svg
```

## Security notes

- All API endpoints check the JWT and the workspace membership on every request.
- Task deletion enforces creator/leader/admin scoping server-side.
- Non-member access to a workspace returns 403.
- Deleted tasks use soft delete (`deletedAt`) so owner/admin can restore them.

## Roadmap ideas

- WebSocket-based realtime chat (currently 3.5s polling)
- Custom per-member permission overrides
- Task dependencies visible in Gantt
- Push notifications (PWA)
- Google OAuth login

See [MIGRATION.md](./MIGRATION.md) for the full plan to move Whatodo out of Emergent to GitHub + Supabase + Vercel.
