create extension if not exists "pgcrypto";

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  platform_user_id text not null,
  username text,
  user_avatar text,
  last_message text,
  last_message_at timestamptz not null default now(),
  status text not null default 'active',
  unread_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_platform_check check (platform in ('instagram', 'facebook', 'whatsapp')),
  constraint conversations_status_check check (status in ('active', 'resolved')),
  constraint conversations_platform_user_unique unique (platform, platform_user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_type text not null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint messages_sender_type_check check (sender_type in ('user', 'bot'))
);

create index if not exists conversations_last_message_at_idx
  on public.conversations(last_message_at desc);
create index if not exists messages_conversation_id_idx
  on public.messages(conversation_id);
create index if not exists messages_created_at_idx
  on public.messages(created_at asc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- No public dashboard policies or realtime publication.
revoke all on public.conversations, public.messages from public, anon, authenticated;
grant all on public.conversations, public.messages to service_role;
