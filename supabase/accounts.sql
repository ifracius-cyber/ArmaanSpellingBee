-- Spelling Hive accounts (run after setup.sql; safe to run more than once).
-- Dashboard → SQL Editor → New query → paste → Run.
--
-- Each signed-in learner gets one row holding their progress. Row Level Security makes sure a
-- learner can only ever read or change their own row.

create table if not exists public.learner_progress (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  constraint learner_progress_size check (pg_column_size(data) < 1000000)
);

alter table public.learner_progress enable row level security;

drop policy if exists "Learners read their own progress" on public.learner_progress;
create policy "Learners read their own progress" on public.learner_progress
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Learners add their own progress" on public.learner_progress;
create policy "Learners add their own progress" on public.learner_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Learners update their own progress" on public.learner_progress;
create policy "Learners update their own progress" on public.learner_progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.learner_progress from anon;
grant select, insert, update on public.learner_progress to authenticated;
