alter table public.website_page_history
  add column if not exists page_visit_key uuid;

create unique index if not exists website_page_history_page_visit_key_uidx
  on public.website_page_history (page_visit_key)
  where page_visit_key is not null;
