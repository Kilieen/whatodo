# Migrating Whatodo from Emergent to GitHub + Supabase + Vercel

This guide walks you through moving Whatodo from the current Emergent-hosted MongoDB stack to a self-owned stack: **GitHub** for source control, **Supabase** (Postgres + Auth + Storage + Realtime) for backend, and **Vercel** for hosting.

We recommend a **progressive migration** in six phases. Do not migrate everything at once.

---

## Phase 0 — Export the code to GitHub

1. Create a new empty repository on github.com (private).
2. From the current Emergent workspace, download the `/app` folder or push it directly:

```bash
cd /app
git init
git add .
git commit -m "Initial import from Emergent"
git branch -M main
git remote add origin git@github.com:<you>/whatodo.git
git push -u origin main
```

3. Make sure the following files are **NOT** committed (a `.gitignore` should already cover them):
   - `.env` (secrets)
   - `node_modules/`
   - `.next/`

4. Commit `.env.example` so future contributors know which variables are required.

5. Branch strategy: use `main` for production, feature branches (`feat/*`, `fix/*`) merged via PRs.

---

## Phase 1 — Run locally against the current MongoDB

Before touching Supabase, make sure the app runs on your machine.

1. Install Node 20+ and Yarn.
2. Run a local MongoDB (Docker: `docker run -d -p 27017:27017 --name mongo mongo:7`).
3. Copy `.env.example` to `.env` and fill in `MONGO_URL`, `DB_NAME`, `JWT_SECRET`.
4. `yarn install && yarn dev` — the app auto-seeds itself.

Once this works locally, you have a baseline to compare against.

---

## Phase 2 — Create the Supabase project

1. Go to https://supabase.com, create a new project (choose a nearby region).
2. Note your `Project URL`, `anon key`, `service_role key` (never expose the service_role in the frontend).
3. Install the Supabase SDK in the project:

```bash
yarn add @supabase/supabase-js @supabase/ssr
```

---

## Phase 3 — Convert MongoDB collections to Postgres schema

Run this SQL in the Supabase SQL editor:

```sql
-- users are managed by supabase.auth.users; we mirror a profile
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text,
  email text unique not null,
  avatar_color text default '#3a5375',
  created_at timestamptz default now()
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text,
  color text default '#3b82f6',
  owner_id uuid references profiles(id),
  invite_code text unique not null,
  created_at timestamptz default now()
);

create type workspace_role as enum ('owner','admin','leader','member','teacher','viewer');

create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role workspace_role not null default 'member',
  group_id uuid,
  status text default 'active',
  joined_at timestamptz default now(),
  unique(workspace_id, user_id)
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  leader_id uuid references profiles(id),
  description text,
  created_at timestamptz default now()
);

create type task_status as enum ('todo','in_progress','review','blocked','done');
create type task_priority as enum ('low','medium','high','urgent');

create table tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  title text not null,
  description text,
  created_by uuid references profiles(id),
  priority task_priority default 'medium',
  status task_status default 'todo',
  start_date timestamptz,
  due_date timestamptz,
  proof_required boolean default false,
  deleted_at timestamptz,
  deleted_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table task_assignees (
  task_id uuid references tasks(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (task_id, user_id)
);

create table task_proofs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  user_id uuid references profiles(id),
  type text default 'file',
  file_url text,
  file_name text,
  mime_type text,
  link_url text,
  text_body text,
  created_at timestamptz default now()
);

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  user_id uuid references profiles(id),
  content text not null,
  created_at timestamptz default now()
);

create type channel_type as enum ('workspace','leaders','group');
create table channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  type channel_type not null,
  group_id uuid references groups(id) on delete cascade,
  description text,
  created_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  channel_id uuid references channels(id) on delete cascade,
  user_id uuid references profiles(id),
  content text not null,
  reply_to_id uuid references messages(id),
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  type text not null,
  title text,
  body text,
  link jsonb,
  read boolean default false,
  created_at timestamptz default now()
);
```

### One-time data migration script

Export MongoDB data → transform → `insert into` Postgres.

```bash
# Dump
mongoexport --uri=$MONGO_URL --db=whatodo --collection=users --out=users.json
# … repeat for each collection

# Use a small Node script to reshape (camelCase → snake_case) and insert via @supabase/supabase-js
```

---

## Phase 4 — Migrate authentication to Supabase Auth

1. Replace `/api/auth/login` and `/api/auth/register` with `supabase.auth.signInWithPassword` / `supabase.auth.signUp` calls (client-side).
2. On first login, create a row in `profiles` mirroring the auth user.
3. Remove `jsonwebtoken` and `bcryptjs` dependencies.
4. The frontend reads the session with `supabase.auth.getSession()` and passes the token to Supabase in a session cookie via `@supabase/ssr`.
5. Add `Sign in with Google` optionally through Supabase OAuth providers.

---

## Phase 5 — Row Level Security (replaces backend permission checks)

Enable RLS on every table and add policies. Example for `tasks`:

```sql
alter table tasks enable row level security;

-- SELECT: user must be a member of the workspace
create policy tasks_select on tasks for select using (
  exists (
    select 1 from workspace_members m
    where m.workspace_id = tasks.workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

-- INSERT: user must be a member of the workspace and (member of group OR admin/owner/leader)
create policy tasks_insert on tasks for insert with check (
  exists (
    select 1 from workspace_members m
    where m.workspace_id = tasks.workspace_id
      and m.user_id = auth.uid()
  )
);

-- UPDATE: assignee OR manager of group
create policy tasks_update on tasks for update using (
  exists (
    select 1 from workspace_members m
    where m.workspace_id = tasks.workspace_id and m.user_id = auth.uid()
      and (m.role in ('owner','admin') or
           (m.role = 'leader' and m.group_id = tasks.group_id) or
           exists (select 1 from task_assignees a where a.task_id = tasks.id and a.user_id = auth.uid())
      )
  )
);

-- DELETE: creator, group leader, or admin/owner
create policy tasks_delete on tasks for delete using (
  tasks.created_by = auth.uid()
  or exists (
    select 1 from workspace_members m
    where m.workspace_id = tasks.workspace_id and m.user_id = auth.uid()
      and (m.role in ('owner','admin')
           or (m.role = 'leader' and m.group_id = tasks.group_id))
  )
);
```

Apply similar policies to `channels`, `messages`, `notifications`, `groups`, `workspace_members`.

### Channel visibility policy example

```sql
create policy messages_select on messages for select using (
  exists (
    select 1 from channels c
    join workspace_members m on m.workspace_id = c.workspace_id and m.user_id = auth.uid()
    where c.id = messages.channel_id and (
      c.type = 'workspace'
      or (c.type = 'leaders' and m.role in ('owner','admin','leader'))
      or (c.type = 'group' and m.group_id = c.group_id)
      or m.role in ('owner','admin')
    )
  )
);
```

---

## Phase 6 — Storage, Realtime, and deployment

### Storage (proofs, avatars, attachments)

1. Create a `proofs` bucket in Supabase Storage (private).
2. Replace base64 uploads with `supabase.storage.from('proofs').upload(path, file)`.
3. Use signed URLs (`.createSignedUrl(path, 3600)`) to serve them.

### Realtime chat

```ts
const channel = supabase
  .channel('messages:workspace-' + workspaceId)
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'messages',
    filter: `channel_id=eq.${channelId}`
  }, (payload) => appendMessage(payload.new))
  .subscribe()
```

Remove the 3.5-second polling in `ChatView`.

### Vercel deploy

1. Push to GitHub.
2. In Vercel, click **Import Project**, pick the repo.
3. Add these environment variables in Vercel > Project > Settings > Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server side only, if needed for admin ops)
   - `NEXT_PUBLIC_BASE_URL` (Vercel will fill it, but you can override)
4. Build command: `next build`. Output: `.next`. Framework preset: **Next.js**.
5. Add your custom domain in Vercel > Domains and follow the DNS instructions.
6. Vercel handles HTTPS automatically.

---

## Progressive rollout — recommended order

1. **Week 1** — Export code, run locally, deploy to Vercel with the current MongoDB (via MongoDB Atlas free tier if needed).
2. **Week 2** — Create Supabase project, apply schema, run a one-way data migration into Supabase. Keep MongoDB read-only.
3. **Week 3** — Swap Auth to Supabase, keep API routes as-is but pointing to Postgres.
4. **Week 4** — Move `/api/*` reads to direct Supabase client calls (with RLS). Delete unused API routes.
5. **Week 5** — Move Storage + Realtime chat to Supabase. Drop MongoDB.
6. **Week 6** — Harden RLS, add push notifications, custom domain.

---

## Rollback safety

- Keep a Mongo dump before every phase.
- Only drop MongoDB collections after two weeks of stable Supabase operation.
- Use Vercel Preview Deployments to test every PR before merging to `main`.

---

## Cost estimate

- **Vercel Hobby**: free for personal use
- **Supabase Free tier**: 500 MB DB + 1 GB Storage + 2 GB egress — enough for a class of 20
- **Domain**: ~10€/year

Total: **~1€/month** for a class of 20 users.
