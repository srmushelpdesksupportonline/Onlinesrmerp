# SRM Online ERP — Frontend (React + Vite)

A minimal React (JavaScript) frontend wired to Supabase. Pages: Admissions,
Academics, Students, Faculties, Finance, Tickets.

## Run locally (VS Code + Node.js)

1. Install Node.js 18+ from https://nodejs.org/
2. Open this folder in VS Code.
3. In the terminal:
   ```bash
   npm install
   cp .env.example .env     # then edit .env with your Supabase URL + anon key
   npm run dev
   ```
4. Open http://localhost:5173

## What's wired

- `src/supabaseClient.js` — single Supabase client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `src/pages/Admissions.jsx` — reads `applications` + `programs`, lets you create a new application and update its status.
- `src/pages/Academics.jsx`, `Students.jsx`, `Faculties.jsx`, `Finance.jsx`, `Tickets.jsx` — page shells with a starter query. Adjust table names to match your schema.
- `src/pages/Tickets.jsx` — supports `category` of `student`, `staff_helpdesk`, or `admissions_enquiry`. Create a `tickets` table (see SQL at the bottom of the file).

## Adding the `tickets` table

This frontend assumes a `tickets` table. Run this in the Supabase SQL editor:

```sql
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text,
  category text not null check (category in ('student','staff_helpdesk','admissions_enquiry')),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  created_by uuid references auth.users(id) on delete set null,
  assignee_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tickets to authenticated;
grant all on public.tickets to service_role;
alter table public.tickets enable row level security;
create policy "auth users read tickets" on public.tickets for select to authenticated using (true);
create policy "auth users create tickets" on public.tickets for insert to authenticated with check (auth.uid() = created_by);
create policy "auth users update own or assigned" on public.tickets for update to authenticated using (auth.uid() = created_by or auth.uid() = assignee_id);
```

## Auth

This starter does NOT include a login page — it assumes you handle auth elsewhere
or temporarily disable RLS while testing. To add login, use
`supabase.auth.signInWithPassword({...})` from `@supabase/supabase-js`.
