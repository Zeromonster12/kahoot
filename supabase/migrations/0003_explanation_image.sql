-- =====================================================================
-- Kvízovka – vlastný obrázok k vysvetleniu (zobrazí sa po odhalení odpovede)
-- Spusti v Supabase → SQL Editor → New query → Run (po 0002_explanation.sql).
-- =====================================================================

alter table public.questions add column if not exists explanation_image_url text;

alter table public.game_questions add column if not exists explanation_image_url text;

-- Snímka otázok pri spustení hry – teraz aj s obrázkom k vysvetleniu
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

  insert into game_questions (game_id, idx, category, text, image_url, answers, correct, time_limit, points, explanation, explanation_image_url)
  select v_game,
         (row_number() over (order by position, created_at, id))::int - 1,
         category, text, image_url, answers, correct, time_limit, points, explanation, explanation_image_url
  from questions
  where quiz_id = p_quiz_id;

  return v_game;
end $$;

-- Odhalenie: k správnej odpovedi a štatistike pribudne vysvetlenie aj jeho obrázok.
-- (Do verejného games.question sa dostanú až teraz – skôr by mohli prezradiť odpoveď.)
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
                 'correct',     v_q.correct,
                 'counts',      v_counts,
                 'answered',    v_answered,
                 'explanation', v_q.explanation,
                 'explanation_image_url', v_q.explanation_image_url)
  where id = p_game_id;
end $$;
