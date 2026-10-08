-- Spelling Hive cloud save.
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).
--
-- Each learner's progress is one JSON document keyed by a long random "save code" that the app
-- generates. The table itself is locked (RLS on, no policies, no grants), so the public key in the
-- web page can't list or read rows. The only way in is via the two functions below, which require
-- knowing the exact save code — it works like a password.

create table if not exists public.spelling_progress (
  sync_code  text primary key check (sync_code ~ '^BEE(-[A-Z2-9]{4}){4}$'),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.spelling_progress enable row level security;
revoke all on public.spelling_progress from anon, authenticated;

create or replace function public.get_spelling_progress(p_code text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select data from public.spelling_progress where sync_code = p_code;
$$;

create or replace function public.save_spelling_progress(p_code text, p_data jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved timestamptz;
begin
  if p_code !~ '^BEE(-[A-Z2-9]{4}){4}$' then
    raise exception 'invalid save code';
  end if;
  if pg_column_size(p_data) > 1000000 then
    raise exception 'progress data too large';
  end if;
  insert into public.spelling_progress as sp (sync_code, data, updated_at)
  values (p_code, p_data, now())
  on conflict (sync_code) do update set data = excluded.data, updated_at = now()
  returning sp.updated_at into saved;
  return saved;
end;
$$;

revoke all on function public.get_spelling_progress(text) from public;
revoke all on function public.save_spelling_progress(text, jsonb) from public;
grant execute on function public.get_spelling_progress(text) to anon, authenticated;
grant execute on function public.save_spelling_progress(text, jsonb) to anon, authenticated;
