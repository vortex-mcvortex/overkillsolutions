create extension if not exists "pgcrypto";

create table if not exists public.quotes (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_logs (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_items (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_rules (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.quotes enable row level security;
alter table public.jobs enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_logs enable row level security;
alter table public.customers enable row level security;
alter table public.expenses enable row level security;
alter table public.schedule_items enable row level security;
alter table public.automation_rules enable row level security;
alter table public.templates enable row level security;
alter table public.app_settings enable row level security;

-- TEMPORARY PRIVATE-APP POLICIES.
-- Replace these before launching a public customer portal.

create policy "temporary anon all quotes" on public.quotes for all using (true) with check (true);
create policy "temporary anon all jobs" on public.jobs for all using (true) with check (true);
create policy "temporary anon all inventory_items" on public.inventory_items for all using (true) with check (true);
create policy "temporary anon all inventory_logs" on public.inventory_logs for all using (true) with check (true);
create policy "temporary anon all customers" on public.customers for all using (true) with check (true);
create policy "temporary anon all expenses" on public.expenses for all using (true) with check (true);
create policy "temporary anon all schedule_items" on public.schedule_items for all using (true) with check (true);
create policy "temporary anon all automation_rules" on public.automation_rules for all using (true) with check (true);
create policy "temporary anon all templates" on public.templates for all using (true) with check (true);
create policy "temporary anon all app_settings" on public.app_settings for all using (true) with check (true);
