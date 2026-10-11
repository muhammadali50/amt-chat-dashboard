-- Allow WhatsApp conversations in databases created before WhatsApp support.
alter table public.conversations
  drop constraint if exists conversations_platform_check;

alter table public.conversations
  add constraint conversations_platform_check
  check (platform in ('instagram', 'facebook', 'whatsapp'));
