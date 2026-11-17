-- =====================================================================
-- Kvízovka – hra nezamrzne bez projektora, odchod tímu, bez automatického zámku
-- Spusti v Supabase → SQL Editor → New query → Run (po 0005_hardening.sql).
-- =====================================================================

-- Kedy sa po zobrazení otázky (fáza "preview") otvorí odpovedanie – rovnaké ako
-- PREVIEW_SECONDS v aplikácii (src/lib/theme.ts)
alter table public.games add column if not exists preview_ends_at timestamptz;

-- ---------------------------------------------------------------------
-- 1) Časové prechody hry ako interné funkcie (bez kontroly admina)
--    Volá ich host (s kontrolou admina) aj advance_game (len keď už uplynul čas).
-- ---------------------------------------------------------------------

create or replace function public.internal_open_answers(p_game_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update games set
    status     = 'question',
    started_at = now(),
    ends_at    = now() + make_interval(secs => (question ->> 'time_limit')::int)
  where id = p_game_id and status = 'preview';
end $$;

create or replace function public.internal_reveal(p_game_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_game     games;
  v_q        game_questions;
  v_counts   jsonb;
  v_answered int;
begin
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
                 'correct',     v_q.correct,
                 'counts',      v_counts,
                 'answered',    v_answered,
                 'explanation', v_q.explanation,
                 'explanation_image_url', v_q.explanation_image_url)
  where id = p_game_id;
end $$;

-- ---------------------------------------------------------------------
-- 2) Hostiteľ
-- ---------------------------------------------------------------------

create or replace function public.host_open_answers(p_game_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  perform public.internal_open_answers(p_game_id);
end $$;

create or replace function public.host_reveal(p_game_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  perform public.internal_reveal(p_game_id);
end $$;

-- Zobrazí otázku. Hra sa už sama nezamyká (neskoro prišlí žiaci sa majú vedieť
-- pripojiť); zamknúť ju môže učiteľ tlačidlom so zámkom.
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
    status          = 'preview',
    question_index  = p_index,
    question        = jsonb_build_object(
                        'idx',        v_q.idx,
                        'category',   v_q.category,
                        'text',       v_q.text,
                        'image_url',  v_q.image_url,
                        'answers',    to_jsonb(v_q.answers),
                        'time_limit', v_q.time_limit,
                        'points',     v_q.points),
    preview_ends_at = now() + interval '5 seconds',
    started_at      = null,
    ends_at         = null
  where id = p_game_id;
end $$;

-- ---------------------------------------------------------------------
-- 3) Hráči
-- ---------------------------------------------------------------------

-- Posunie hru, ak už uplynul čas – aj keď projektor (karta učiteľa) nebeží.
-- Robí len to, čo by aj tak spravil časovač: nikdy nič neurýchli.
-- (Predčasné vyhodnotenie „odpovedali všetci“ ostáva len na hostiteľovi.)
create or replace function public.advance_game(p_game_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_game games;
begin
  -- najprv lacná kontrola bez zámku – opakované volania nič nezdržia
  select * into v_game from games where id = p_game_id;
  if not found then raise exception 'game_not_found'; end if;

  if v_game.status = 'preview' and v_game.preview_ends_at is not null and now() >= v_game.preview_ends_at then
    perform public.internal_open_answers(p_game_id);
  elsif v_game.status = 'question' and now() > v_game.ends_at + interval '1 second' then
    -- po rezerve 1 s, počas ktorej submit_answer ešte prijíma odpovede
    perform public.internal_reveal(p_game_id);
  end if;
end $$;

-- Tím odíde z rozohranej hry (zmaže sa aj s odpoveďami); s rovnakým názvom sa môže vrátiť.
-- Po skončení hry sa tím nemaže – ostáva vo výsledkoch.
create or replace function public.leave_game(p_team_id uuid, p_token uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  select g.status into v_status
  from teams t join games g on g.id = t.game_id
  where t.id = p_team_id and t.token = p_token;
  if not found then raise exception 'team_not_found'; end if;
  if v_status = 'finished' then return; end if;
  delete from teams where id = p_team_id and token = p_token;
end $$;

-- ---------------------------------------------------------------------
-- 4) Práva k funkciám (Supabase dáva novým funkciám EXECUTE aj pre anon)
-- ---------------------------------------------------------------------

revoke execute on function public.internal_open_answers(uuid), public.internal_reveal(uuid)
  from public, anon, authenticated;
grant execute on function public.advance_game(uuid), public.leave_game(uuid, uuid) to anon, authenticated;
