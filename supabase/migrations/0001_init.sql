-- =====================================================================
-- Kvízovka – databázová schéma pre Supabase
-- Spusti celý tento súbor v Supabase → SQL Editor → New query → Run.
-- Na konci súboru doplň e-mail učiteľa/admina (sekcia ADMIN).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabuľky
-- ---------------------------------------------------------------------

-- Zoznam e-mailov, ktoré majú prístup do administrácie
create table if not exists public.admin_emails (
  email text primary key check (email = lower(email))
);

create table if not exists public.quizzes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.questions (
  id         uuid primary key default gen_random_uuid(),
  quiz_id    uuid not null references public.quizzes(id) on delete cascade,
  position   int not null default 0,
  category   text not null default '' check (char_length(category) <= 60),
  text       text not null check (char_length(text) between 1 and 400),
  image_url  text,
  answers    text[] not null check (array_length(answers, 1) between 2 and 4),
  correct    smallint not null,
  time_limit smallint not null default 20 check (time_limit between 5 and 240),
  points     smallint not null default 1000 check (points in (0, 1000, 2000)),
  created_at timestamptz not null default now(),
  check (correct >= 0 and correct < array_length(answers, 1))
);
create index if not exists questions_quiz_idx on public.questions (quiz_id, position);

-- Jedna spustená hra. Riadok je verejne čitateľný (hráči ho sledujú cez realtime),
-- preto nesmie obsahovať správnu odpoveď skôr, než ju host odhalí.
create table if not exists public.games (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid references public.quizzes(id) on delete set null,
  quiz_title     text not null,
  pin            text not null,
  status         text not null default 'lobby'
                 check (status in ('lobby', 'preview', 'question', 'reveal', 'scoreboard', 'finished')),
  question_index int not null default -1,
  question_count int not null,
  question       jsonb,          -- verejné údaje aktuálnej otázky (+ correct/counts po odhalení)
  started_at     timestamptz,    -- kedy sa otvorilo odpovedanie
  ends_at        timestamptz,    -- kedy odpovedanie končí
  created_at     timestamptz not null default now(),
  finished_at    timestamptz
);
create unique index if not exists games_active_pin on public.games (pin) where status <> 'finished';
create index if not exists games_created_idx on public.games (created_at desc);

-- Snímka otázok v čase spustenia hry (úprava kvízu neovplyvní bežiacu hru). Neverejné.
create table if not exists public.game_questions (
  game_id    uuid not null references public.games(id) on delete cascade,
  idx        int not null,
  category   text not null,
  text       text not null,
  image_url  text,
  answers    text[] not null,
  correct    smallint not null,
  time_limit smallint not null,
  points     smallint not null,
  primary key (game_id, idx)
);

create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  name       text not null,
  token      uuid not null default gen_random_uuid(),  -- tajný kľúč zariadenia tímu
  score      int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists teams_game_name on public.teams (game_id, lower(name));

create table if not exists public.answers (
  id           bigint generated always as identity primary key,
  game_id      uuid not null references public.games(id) on delete cascade,
  team_id      uuid not null references public.teams(id) on delete cascade,
  question_idx int not null,
  answer       smallint not null,
  correct      boolean not null,
  points       int not null,
  response_ms  int not null,
  created_at   timestamptz not null default now(),
  unique (team_id, question_idx)
);
create index if not exists answers_game_q_idx on public.answers (game_id, question_idx);

-- ---------------------------------------------------------------------
-- Pomocné funkcie
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admin_emails
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists quizzes_touch on public.quizzes;
create trigger quizzes_touch before update on public.quizzes
  for each row execute function public.touch_updated_at();

-- Serverový čas – klienti si podľa neho synchronizujú odpočet
create or replace function public.server_now()
returns timestamptz language sql stable as $$ select now() $$;

-- ---------------------------------------------------------------------
-- Hra – funkcie pre hosta (učiteľa)
-- ---------------------------------------------------------------------

create or replace function public.create_game(p_quiz_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_title text;
  v_count int;
  v_pin   text;
  v_game  uuid;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  select title into v_title from quizzes where id = p_quiz_id;
  if not found then raise exception 'quiz_not_found'; end if;

  select count(*) into v_count from questions where quiz_id = p_quiz_id;
  if v_count = 0 then raise exception 'quiz_empty'; end if;

  loop
    v_pin := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from games where pin = v_pin and status <> 'finished');
  end loop;

  insert into games (quiz_id, quiz_title, pin, question_count)
  values (p_quiz_id, v_title, v_pin, v_count)
  returning id into v_game;

  insert into game_questions (game_id, idx, category, text, image_url, answers, correct, time_limit, points)
  select v_game,
         (row_number() over (order by position, created_at, id))::int - 1,
         category, text, image_url, answers, correct, time_limit, points
  from questions
  where quiz_id = p_quiz_id;

  return v_game;
end $$;

-- Zobrazí otázku (fáza "preview" – hráči vidia otázku, ešte nemôžu odpovedať)
create or replace function public.host_show_question(p_game_id uuid, p_index int)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_game games;
  v_q    game_questions;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  select * into v_game from games where id = p_game_id for update;
  if not found then raise exception 'game_not_found'; end if;
  if v_game.status = 'finished' then raise exception 'game_finished'; end if;
  if v_game.status in ('preview', 'question') then return; end if;  -- už beží otázka
  if v_game.question_index >= p_index then return; end if;          -- opakované volanie

  select * into v_q from game_questions where game_id = p_game_id and idx = p_index;
  if not found then raise exception 'invalid_index'; end if;

  update games set
    status         = 'preview',
    question_index = p_index,
    question       = jsonb_build_object(
                       'idx',        v_q.idx,
                       'category',   v_q.category,
                       'text',       v_q.text,
                       'image_url',  v_q.image_url,
                       'answers',    to_jsonb(v_q.answers),
                       'time_limit', v_q.time_limit,
                       'points',     v_q.points),
    started_at     = null,
    ends_at        = null
  where id = p_game_id;
end $$;

-- Otvorí odpovedanie a spustí časovač
create or replace function public.host_open_answers(p_game_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  update games set
    status     = 'question',
    started_at = now(),
    ends_at    = now() + make_interval(secs => (question ->> 'time_limit')::int)
  where id = p_game_id and status = 'preview';
end $$;

-- Ukončí odpovedanie, pripočíta body a odhalí správnu odpoveď
create or replace function public.host_reveal(p_game_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_game     games;
  v_q        game_questions;
  v_counts   jsonb;
  v_answered int;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  -- zámok riadku: submit_answer čaká, kým sa odhalenie nedokončí (a naopak)
  select * into v_game from games where id = p_game_id for update;
  if not found then raise exception 'game_not_found'; end if;
  if v_game.status <> 'question' then return; end if;

  select * into v_q from game_questions where game_id = p_game_id and idx = v_game.question_index;

  update teams t set score = t.score + a.points
  from answers a
  where a.team_id = t.id and a.game_id = p_game_id and a.question_idx = v_game.question_index;

  select coalesce(jsonb_agg(coalesce(c.cnt, 0) order by i), '[]'::jsonb)
  into v_counts
  from generate_series(0, array_length(v_q.answers, 1) - 1) as i
  left join (
    select answer, count(*)::int as cnt
    from answers
    where game_id = p_game_id and question_idx = v_game.question_index
    group by answer
  ) c on c.answer = i;

  select count(*) into v_answered
  from answers where game_id = p_game_id and question_idx = v_game.question_index;

  update games set
    status   = 'reveal',
    ends_at  = least(ends_at, now()),
    question = question || jsonb_build_object(
                 'correct',  v_q.correct,
                 'counts',   v_counts,
                 'answered', v_answered)
  where id = p_game_id;
end $$;

create or replace function public.host_scoreboard(p_game_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  update games set status = 'scoreboard' where id = p_game_id and status = 'reveal';
end $$;

create or replace function public.host_finish(p_game_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  update games set status = 'finished', finished_at = now()
  where id = p_game_id and status <> 'finished';
end $$;

-- ---------------------------------------------------------------------
-- Hra – funkcie pre hráčov (tímy, bez prihlásenia)
-- ---------------------------------------------------------------------

create or replace function public.join_game(p_pin text, p_name text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_game games;
  v_team teams;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 24 then
    raise exception 'invalid_name';
  end if;

  select * into v_game from games
  where pin = btrim(coalesce(p_pin, '')) and status <> 'finished'
  order by created_at desc limit 1;
  if not found then raise exception 'game_not_found'; end if;

  if (select count(*) from teams where game_id = v_game.id) >= 200 then
    raise exception 'game_full';
  end if;

  begin
    insert into teams (game_id, name) values (v_game.id, v_name) returning * into v_team;
  exception when unique_violation then
    raise exception 'name_taken';
  end;

  return jsonb_build_object('game_id', v_game.id, 'team_id', v_team.id, 'token', v_team.token, 'name', v_team.name);
end $$;

create or replace function public.submit_answer(p_team_id uuid, p_token uuid, p_answer int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_team    teams;
  v_game    games;
  v_q       game_questions;
  v_elapsed int;
  v_correct boolean;
  v_points  int;
begin
  select * into v_team from teams where id = p_team_id and token = p_token;
  if not found then raise exception 'team_not_found'; end if;

  -- zdieľaný zámok – host_reveal počká, kým sa odpoveď nezapíše
  select * into v_game from games where id = v_team.game_id for share;
  if v_game.status <> 'question' then raise exception 'not_accepting'; end if;
  if now() > v_game.ends_at + interval '1 second' then raise exception 'time_up'; end if;

  select * into v_q from game_questions where game_id = v_game.id and idx = v_game.question_index;
  if p_answer is null or p_answer < 0 or p_answer >= array_length(v_q.answers, 1) then
    raise exception 'invalid_answer';
  end if;

  v_elapsed := greatest(0, least(v_q.time_limit * 1000,
                 (extract(epoch from (now() - v_game.started_at)) * 1000)::int));
  v_correct := p_answer = v_q.correct;
  -- Kahoot vzorec: správna odpoveď = 50 – 100 % bodov podľa rýchlosti
  v_points  := case when v_correct
                 then round(v_q.points * (1 - (v_elapsed::numeric / (v_q.time_limit * 1000)) / 2))::int
                 else 0 end;

  insert into answers (game_id, team_id, question_idx, answer, correct, points, response_ms)
  values (v_game.id, v_team.id, v_game.question_index, p_answer, v_correct, v_points, v_elapsed)
  on conflict (team_id, question_idx) do nothing;
  if not found then raise exception 'already_answered'; end if;

  return jsonb_build_object('ok', true);
end $$;

-- Stav tímu: skóre, poradie a výsledok aktuálnej otázky (správnosť až po odhalení)
create or replace function public.team_state(p_team_id uuid, p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_team     teams;
  v_game     games;
  v_answer   answers;
  v_rank     int;
  v_count    int;
  v_revealed boolean;
begin
  select * into v_team from teams where id = p_team_id and token = p_token;
  if not found then raise exception 'team_not_found'; end if;

  select * into v_game from games where id = v_team.game_id;
  v_revealed := v_game.status in ('reveal', 'scoreboard', 'finished');

  select 1 + count(*) into v_rank from teams where game_id = v_team.game_id and score > v_team.score;
  select count(*) into v_count from teams where game_id = v_team.game_id;

  select * into v_answer from answers
  where team_id = v_team.id and question_idx = v_game.question_index;

  return jsonb_build_object(
    'status',         v_game.status,
    'question_index', v_game.question_index,
    'team_id',    v_team.id,
    'name',       v_team.name,
    'score',      v_team.score,
    'rank',       v_rank,
    'team_count', v_count,
    'answer', case
      when v_answer.id is null then null
      when v_revealed then jsonb_build_object(
        'question_idx', v_answer.question_idx,
        'answer',  v_answer.answer,
        'correct', v_answer.correct,
        'points',  v_answer.points)
      else jsonb_build_object(
        'question_idx', v_answer.question_idx,
        'answer',  v_answer.answer)
    end
  );
end $$;

-- Verejný rebríček hry
create or replace function public.get_leaderboard(p_game_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'team_id', id, 'name', name, 'score', score, 'rank', rnk)
         order by score desc, created_at), '[]'::jsonb)
  from (
    select id, name, score, created_at, rank() over (order by score desc) as rnk
    from teams where game_id = p_game_id
  ) t;
$$;

-- ---------------------------------------------------------------------
-- Práva a Row Level Security
-- ---------------------------------------------------------------------

alter table public.admin_emails   enable row level security;
alter table public.quizzes        enable row level security;
alter table public.questions      enable row level security;
alter table public.games          enable row level security;
alter table public.game_questions enable row level security;
alter table public.teams          enable row level security;
alter table public.answers        enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.quizzes, public.questions, public.games,
  public.game_questions, public.teams, public.answers to authenticated;
grant select on public.admin_emails to authenticated;
grant select on public.games to anon;
revoke all on public.quizzes, public.questions, public.game_questions, public.teams,
  public.answers, public.admin_emails from anon;

drop policy if exists "admin self" on public.admin_emails;
create policy "admin self" on public.admin_emails for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "admin all" on public.quizzes;
create policy "admin all" on public.quizzes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all" on public.questions;
create policy "admin all" on public.questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read" on public.games;
create policy "public read" on public.games for select to anon, authenticated using (true);
drop policy if exists "admin write" on public.games;
create policy "admin write" on public.games for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all" on public.game_questions;
create policy "admin all" on public.game_questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all" on public.teams;
create policy "admin all" on public.teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all" on public.answers;
create policy "admin all" on public.answers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Funkcie: hostovské len pre prihlásených (a aj tak kontrolujú is_admin()),
-- hráčske pre všetkých
revoke execute on function public.create_game(uuid), public.host_show_question(uuid, int),
  public.host_open_answers(uuid), public.host_reveal(uuid), public.host_scoreboard(uuid),
  public.host_finish(uuid) from public, anon;
grant execute on function public.create_game(uuid), public.host_show_question(uuid, int),
  public.host_open_answers(uuid), public.host_reveal(uuid), public.host_scoreboard(uuid),
  public.host_finish(uuid), public.is_admin() to authenticated;
grant execute on function public.server_now(), public.join_game(text, text),
  public.submit_answer(uuid, uuid, int), public.team_state(uuid, uuid),
  public.get_leaderboard(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Realtime (hráči sledujú games, host aj teams a answers)
-- ---------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.games;   exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.teams;   exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.answers; exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Úložisko obrázkov k otázkam (verejné na čítanie, zápis len admin)
-- ---------------------------------------------------------------------

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('quiz-images', 'quiz-images', true, 5242880,
            array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
    on conflict (id) do nothing;

    drop policy if exists "quiz images admin read"   on storage.objects;
    drop policy if exists "quiz images admin insert" on storage.objects;
    drop policy if exists "quiz images admin update" on storage.objects;
    drop policy if exists "quiz images admin delete" on storage.objects;

    create policy "quiz images admin read" on storage.objects for select to authenticated
      using (bucket_id = 'quiz-images' and public.is_admin());
    create policy "quiz images admin insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'quiz-images' and public.is_admin());
    create policy "quiz images admin update" on storage.objects for update to authenticated
      using (bucket_id = 'quiz-images' and public.is_admin());
    create policy "quiz images admin delete" on storage.objects for delete to authenticated
      using (bucket_id = 'quiz-images' and public.is_admin());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- ADMIN – sem doplň e-mail(y) učiteľov, ktorí môžu spravovať kvízy.
-- Používateľa vytvor v Supabase → Authentication → Users → Add user.
-- ---------------------------------------------------------------------
-- insert into public.admin_emails (email) values ('ucitel@skola.sk') on conflict do nothing;
