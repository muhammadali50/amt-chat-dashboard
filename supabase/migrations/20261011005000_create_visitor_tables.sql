-- For fresh installs; preserves existing externally provisioned tables.
create table if not exists public.website_visitors (
 id uuid primary key default gen_random_uuid(), visitor_key uuid not null unique,
 name text, email text, city text, region text, country text,
 first_source text not null default 'direct', last_source text not null default 'direct',
 first_seen timestamptz default now(), last_seen timestamptz default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.website_page_history (
 id uuid primary key default gen_random_uuid(),
 visitor_id uuid not null references public.website_visitors(id) on delete cascade,
 page_path text not null, entered_at timestamptz not null default now(),
 duration_seconds integer not null default 0 check (duration_seconds between 0 and 604800)
);
create index if not exists website_page_history_visitor_idx on public.website_page_history(visitor_id);
alter table public.website_visitors enable row level security;
alter table public.website_page_history enable row level security;
revoke all on public.website_visitors, public.website_page_history from public, anon, authenticated;
grant all on public.website_visitors, public.website_page_history to service_role;
