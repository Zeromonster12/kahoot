-- =====================================================================
-- Kvízovka – PIN mimo verejnej tabuľky, zamknutie hry, vyhodenie tímu
-- Spusti v Supabase → SQL Editor → New query → Run (po 0003_explanation_image.sql).
-- Hneď potom nasaď novú verziu aplikácie – stará hľadá PIN v tabuľke games.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PIN-y hier v samostatnej neverejnej tabuľke
--    Tabuľka games je verejne čitateľná (hráči ju sledujú cez realtime). Keby v nej
--    bol PIN, ktokoľvek s anon kľúčom by si jedným dotazom vypísal PIN-y všetkých
--    bežiacich hier a pripojil sa do nich bez toho, aby videl projektor.
-- ---------------------------------------------------------------------

create table if not exists public.game_pins (
  game_id uuid primary key references public.games(id) on delete cascade,
  pin     text not null check (pin ~ '^[0-9]{6}$'),
  active  boolean not null default true   -- false = hra skončila, PIN je voľný
);
create unique index if not exists game_pins_active on public.game_pins (pin) where active;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'games' and column_name = 'pin') then
    insert into public.game_pins (game_id, pin, active)
    select id, pin, status <> 'finished' from public.games
    on conflict (game_id) do nothing;
  end if;
end $$;

drop index if exists public.games_active_pin;
alter table public.games drop column if exists pin;

-- ---------------------------------------------------------------------
-- 2) Zamknutie hry a vyhodené názvy tímov
-- ---------------------------------------------------------------------

-- zamknutá hra neprijíma nové tímy (verejné – mobil hráča vie povedať prečo)
alter table public.games add column if not exists locked boolean not null default false;

-- názvy vyhodených tímov – s rovnakým názvom sa do tej istej hry už nepripoja
create table if not exists public.game_kicked_names (
  game_id  uuid not null references public.games(id) on delete cascade,
  name_key text not null,   -- lower(názov)
  primary key (game_id, name_key)
);

-- ---------------------------------------------------------------------
-- 3) Práva k novým tabuľkám (zápis len cez funkcie nižšie)
-- ---------------------------------------------------------------------

alter table public.game_pins         enable row level security;
alter table public.game_kicked_names enable row level security;

revoke all on public.game_pins, public.game_kicked_names from anon, authenticated;
grant select on public.game_pins, public.game_kicked_names to authenticated;

drop policy if exists "admin read" on public.game_pins;
create policy "admin read" on public.game_pins for select to authenticated using (public.is_admin());
drop policy if exists "admin read" on public.game_kicked_names;
create policy "admin read" on public.game_kicked_names for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 4) Názov tímu – jednotná úprava
--    NFKC (napr. ﬁ → fi, celošírkové znaky → bežné), bez riadiacich a neviditeľných
--    znakov (zero-width, smer textu…), aby sa tím nemohol na projektore vydávať za iný.
-- ---------------------------------------------------------------------

create or replace function public.clean_team_name(p_name text)
returns text
language sql immutable set search_path = public, pg_temp
as $$
  select btrim(regexp_replace(
           regexp_replace(
             regexp_replace(normalize(coalesce(p_name, ''), NFKC), '\s+', ' ', 'g'),
             '[[:cntrl:]­​-‏‪-‮⁠-⁤⁦-⁩﻿]', '', 'g'),
           '\s+', ' ', 'g'))
$$;

-- ---------------------------------------------------------------------
-- 5) Hra – funkcie
-- ---------------------------------------------------------------------

-- Spustenie hry: PIN sa zapíše do game_pins (unikátny medzi bežiacimi hrami)
create or replace function public.create_game(p_quiz_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
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

  insert into games (quiz_id, quiz_title, question_count)
  values (p_quiz_id, v_title, v_count)
  returning id into v_game;

  loop
    v_pin := (100000 + floor(random() * 900000))::int::text;
    begin
      insert into game_pins (game_id, pin) values (v_game, v_pin);
      exit;
    exception when unique_violation then
      -- PIN práve používa iná bežiaca hra – skús iný
    end;
  end loop;

  insert into game_questions (game_id, idx, category, text, image_url, answers, correct, time_limit, points, explanation, explanation_image_url)
  select v_game,
         (row_number() over (order by position, created_at, id))::int - 1,
         category, text, image_url, answers, correct, time_limit, points, explanation, explanation_image_url
  from questions
  where quiz_id = p_quiz_id;

  return v_game;
end $$;

-- Zobrazí otázku; pri prvej otázke sa hra sama zamkne (učiteľ ju môže odomknúť)
create or replace function public.host_show_question(p_game_id uuid, p_index int)
returns void
language plpgsql security definer set search_path = public, pg_temp
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
    locked         = locked or v_game.question_index < 0,
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

-- Koniec hry: uvoľní PIN, zamkne hru a z verejného riadku odstráni správnu odpoveď
-- a vysvetlenie poslednej otázky (inak by z ukončených hier vznikal ťahák pre ďalšie triedy)
create or replace function public.host_finish(p_game_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  update games set
    status      = 'finished',
    finished_at = now(),
    locked      = true,
    question    = question - array['correct', 'counts', 'answered', 'explanation', 'explanation_image_url']
  where id = p_game_id and status <> 'finished';
  update game_pins set active = false where game_id = p_game_id;
end $$;

-- Zamknutie / odomknutie hry pre nové tímy
create or replace function public.host_set_locked(p_game_id uuid, p_locked boolean)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  select status into v_status from games where id = p_game_id for update;
  if not found then raise exception 'game_not_found'; end if;
  if v_status = 'finished' then raise exception 'game_finished'; end if;
  update games set locked = coalesce(p_locked, true) where id = p_game_id;
end $$;

-- Vyhodenie tímu (kedykoľvek počas hry); s rovnakým názvom sa už nepripojí
create or replace function public.host_kick_team(p_team_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_team teams;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  delete from teams where id = p_team_id returning * into v_team;
  if not found then return; end if;  -- už vyhodený
  insert into game_kicked_names (game_id, name_key)
  values (v_team.game_id, lower(v_team.name))
  on conflict do nothing;
end $$;

-- Hráč: nájde bežiacu hru podľa PIN-u (vráti len to, čo potrebuje obrazovka pripojenia)
create or replace function public.find_game(p_pin text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object('id', g.id, 'status', g.status, 'locked', g.locked, 'quiz_title', g.quiz_title)
  from game_pins p
  join games g on g.id = p.game_id
  where p.active and p.pin = btrim(coalesce(p_pin, '')) and g.status <> 'finished'
  limit 1
$$;

-- Hráč: pripojenie tímu
create or replace function public.join_game(p_pin text, p_name text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_name text := public.clean_team_name(p_name);
  v_game games;
  v_team teams;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 24 then
    raise exception 'invalid_name';
  end if;

  select g.* into v_game
  from game_pins p
  join games g on g.id = p.game_id
  where p.active and p.pin = btrim(coalesce(p_pin, '')) and g.status <> 'finished'
  limit 1;
  if not found then raise exception 'game_not_found'; end if;
  if v_game.locked then raise exception 'game_locked'; end if;

  -- pripojenia do tej istej hry po jednom – strop 200 tímov platí aj pri súbežných volaniach
  perform pg_advisory_xact_lock(hashtextextended('kvizovka.join:' || v_game.id::text, 0));

  if (select count(*) from teams where game_id = v_game.id) >= 200 then
    raise exception 'game_full';
  end if;
  if exists (select 1 from game_kicked_names where game_id = v_game.id and name_key = lower(v_name)) then
    raise exception 'name_kicked';
  end if;

  begin
    insert into teams (game_id, name) values (v_game.id, v_name) returning * into v_team;
  exception when unique_violation then
    raise exception 'name_taken';
  end;

  return jsonb_build_object('game_id', v_game.id, 'team_id', v_team.id, 'token', v_team.token, 'name', v_team.name);
end $$;

-- ---------------------------------------------------------------------
-- 6) Práva k funkciám (Supabase dáva novým funkciám EXECUTE aj pre anon)
-- ---------------------------------------------------------------------

revoke execute on function public.clean_team_name(text) from public, anon, authenticated;
revoke execute on function public.host_set_locked(uuid, boolean), public.host_kick_team(uuid) from public, anon;
grant execute on function public.host_set_locked(uuid, boolean), public.host_kick_team(uuid) to authenticated;
grant execute on function public.find_game(text) to anon, authenticated;
