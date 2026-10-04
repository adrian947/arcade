-- Catálogo de juegos con ranking real. scores.game_id pasa a referenciarlo.
create table public.games (
  id         text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  title      text not null check (char_length(title) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "games: lectura pública" on public.games
  for select to anon, authenticated using (true);

insert into public.games (id, title) values ('asteroides', 'ASTEROIDES');

alter table public.scores
  add constraint scores_game_id_fkey
  foreign key (game_id) references public.games (id) on delete restrict;
-- El índice existente scores_game_score_idx (game_id, score desc) ya cubre esta FK.
