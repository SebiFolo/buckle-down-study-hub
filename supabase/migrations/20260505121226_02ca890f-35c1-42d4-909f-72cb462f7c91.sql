
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  level int not null default 1,
  xp int not null default 0,
  streak_count int not null default 0,
  longest_streak int not null default 0,
  last_active_date date,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles are readable by everyone" on public.profiles for select using (true);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- DOCUMENTS
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  file_type text not null,
  file_url text,
  raw_text text,
  summary text,
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
create policy "Users manage own documents" on public.documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.documents (user_id, created_at desc);

-- FLASHCARDS
create table public.flashcard_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);
alter table public.flashcard_sets enable row level security;
create policy "Users manage own flashcard sets" on public.flashcard_sets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.flashcard_sets(id) on delete cascade,
  front_text text not null,
  back_text text not null,
  position int not null default 0
);
alter table public.flashcards enable row level security;
create policy "Users manage own flashcards" on public.flashcards for all
  using (exists (select 1 from public.flashcard_sets s where s.id = set_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.flashcard_sets s where s.id = set_id and s.user_id = auth.uid()));

-- QUIZZES
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);
alter table public.quizzes enable row level security;
create policy "Users manage own quizzes" on public.quizzes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_text text not null,
  options jsonb not null,
  correct_answer text not null,
  position int not null default 0
);
alter table public.quiz_questions enable row level security;
create policy "Users manage own quiz questions" on public.quiz_questions for all
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid()))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid()));

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score int not null,
  total int not null,
  completed_at timestamptz not null default now()
);
alter table public.quiz_attempts enable row level security;
create policy "Users manage own quiz attempts" on public.quiz_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- XP EVENTS
create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.xp_events enable row level security;
create policy "Users see own xp events" on public.xp_events for select using (auth.uid() = user_id);
create index on public.xp_events (user_id, created_at desc);

-- Storage bucket for documents
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "Users can upload own docs" on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can read own docs" on storage.objects for select
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete own docs" on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
