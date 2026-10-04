-- Perfil público del jugador (1:1 con auth.users)
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);

-- Una fila por partida guardada
create table public.scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    text not null check (game_id ~ '^[a-z0-9-]{1,40}$'),
  score      integer not null check (score between 0 and 10000000),
  created_at timestamptz not null default now()
);
create index scores_game_score_idx on public.scores (game_id, score desc);
create index scores_user_idx on public.scores (user_id);

-- Mejor marca por jugador y juego (el ranking que se muestra)
create view public.leaderboard with (security_invoker = true) as
select distinct on (s.game_id, s.user_id)
       s.game_id, s.user_id, p.username, s.score, s.created_at
from public.scores s
join public.profiles p on p.id = s.user_id
order by s.game_id, s.user_id, s.score desc, s.created_at asc;

-- Crea el perfil al registrarse, tomando el username de los metadatos
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, upper(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.scores   enable row level security;

create policy "profiles: lectura pública" on public.profiles
  for select to anon, authenticated using (true);

create policy "scores: lectura pública" on public.scores
  for select to anon, authenticated using (true);

create policy "scores: insertar los propios" on public.scores
  for insert to authenticated with check (user_id = (select auth.uid()));
