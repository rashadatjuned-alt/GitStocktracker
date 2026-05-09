# ⬛ TeamFlow — Next.js + Supabase

## Deploy to Vercel (5 minutes)

### 1. Push to GitHub
Upload all files to a new GitHub repo.

### 2. Deploy on Vercel
1. Go to **vercel.com** → sign up with GitHub
2. Click **Add New Project** → import your repo
3. Framework: **Next.js** (auto-detected)
4. Add Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL     = https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key
   ```
5. Click **Deploy** → done in ~60 seconds

### 3. Supabase tables needed
```sql
create table "Users" (id uuid primary key, email text, full_name text, role text default 'Team Member');
create table "Projects" (id uuid primary key default gen_random_uuid(), name text, description text, color_code text default '#378ADD', created_at timestamptz default now());
create table "Tasks" (id uuid primary key default gen_random_uuid(), project_name text, topic text, description text, owner text, type text default 'One-time', start_date date, end_date date, status text default 'Not Started', tags text[], created_at timestamptz default now());
create table "Subtasks" (id uuid primary key default gen_random_uuid(), parent_task_id uuid references "Tasks"(id) on delete cascade, topic text, start_date date, end_date date, status text default 'Not Started');
create table "Notifications" (id uuid primary key default gen_random_uuid(), user_id uuid references "Users"(id) on delete cascade, message text, is_read boolean default false, created_at timestamptz default now());

alter table "Users" disable row level security;
alter table "Projects" disable row level security;
alter table "Tasks" disable row level security;
alter table "Subtasks" disable row level security;
alter table "Notifications" disable row level security;
```
