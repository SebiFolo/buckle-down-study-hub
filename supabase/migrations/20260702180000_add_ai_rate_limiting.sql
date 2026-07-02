-- Per-user rate limiting for AI-calling edge functions (generate-study,
-- generate-summary, generate-hint, generate-quests) to cap AI gateway cost
-- exposure from a single account.

create table if not exists public.ai_rate_limits (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  fn_name text not null,
  called_at timestamptz not null default now()
);

create index if not exists ai_rate_limits_user_fn_time_idx
  on public.ai_rate_limits (user_id, fn_name, called_at);

alter table public.ai_rate_limits enable row level security;
-- Intentionally no policies: only the service-role key (used by edge
-- functions) can read/write this table; regular users get no access at all.

create or replace function public.check_ai_rate_limit(
  _user_id uuid,
  _fn_name text,
  _window_seconds int,
  _max_calls int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _count int;
begin
  delete from public.ai_rate_limits
    where user_id = _user_id
      and fn_name = _fn_name
      and called_at < now() - make_interval(secs => _window_seconds);

  select count(*) into _count
    from public.ai_rate_limits
    where user_id = _user_id
      and fn_name = _fn_name
      and called_at >= now() - make_interval(secs => _window_seconds);

  if _count >= _max_calls then
    return false;
  end if;

  insert into public.ai_rate_limits (user_id, fn_name) values (_user_id, _fn_name);
  return true;
end;
$$;

-- Only callable via the service-role client used inside edge functions, not
-- directly by end users through PostgREST.
revoke all on function public.check_ai_rate_limit(uuid, text, int, int) from public, anon, authenticated;
