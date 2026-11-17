-- =====================================================================
-- Kvízovka – snímky (informačné obrazovky medzi otázkami)
-- Spusti v Supabase → SQL Editor → New query → Run (po 0006_gameplay.sql).
--
-- Snímka je položka kvízu bez odpovedí a bez bodov: nadpis (stĺpec text),
-- nepovinný text (stĺpec explanation) a obrázok (image_url). V hre sa ukáže
-- na projektore aj na mobiloch, kým učiteľ nepokračuje ďalej.
-- ---------------------------------------------------------------------

alter table public.questions      add column if not exists kind text not null default 'question';
alter table public.game_questions add column if not exists kind text not null default 'question';

alter table public.questions drop constraint if exists questions_kind_check;
alter table public.questions add constraint questions_kind_check check (kind in ('question', 'slide'));
alter table public.game_questions drop constraint if exists game_questions_kind_check;
alter table public.game_questions add constraint game_questions_kind_check check (kind in ('question', 'slide'));

-- otázka musí mať 2 – 4 odpovede, snímka žiadne
alter table public.questions drop constraint if exists questions_kind_answers_check;
alter table public.questions add constraint questions_kind_answers_check
  check (case when kind = 'slide' then coalesce(array_length(answers, 1), 0) = 0
              else coalesce(array_length(answers, 1), 0) between 2 and 4 end) not valid;
do $$
begin
  alter table public.questions validate constraint questions_kind_answers_check;
exception when check_violation then
  raise notice 'Niektoré otázky nemajú 2 – 4 odpovede – nové a upravené už musia.';
end $$;

-- počet položiek hry (otázky + snímky); question_count ostáva počet otázok
alter table public.games add column if not exists item_count int;

-- nový stav hry 'slide'
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.games'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%' and pg_get_constraintdef(oid) like '%lobby%'
  loop
    execute format('alter table public.games drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.games add constraint games_status_check
  check (status in ('lobby', 'slide', 'preview', 'question', 'reveal', 'scoreboard', 'finished'));

-- ---------------------------------------------------------------------
-- Spustenie hry: snímka otázok aj snímok, počty zvlášť
-- ---------------------------------------------------------------------

create or replace function public.create_game(p_quiz_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_title     text;
  v_questions int;
  v_items     int;
  v_pin       text;
  v_game      uuid;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  select title into v_title from quizzes where id = p_quiz_id;
  if not found then raise exception 'quiz_not_found'; end if;

  select count(*) filter (where kind = 'question'), count(*)
  into v_questions, v_items
  from questions where quiz_id = p_quiz_id;
  if v_questions = 0 then raise exception 'quiz_empty'; end if;

  insert into games (quiz_id, quiz_title, question_count, item_count)
  values (p_quiz_id, v_title, v_questions, v_items)
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

  insert into game_questions (game_id, idx, kind, category, text, image_url, answers, correct, time_limit, points, explanation, explanation_image_url)
  select v_game,
         (row_number() over (order by position, created_at, id))::int - 1,
         kind, category, text, image_url, answers, correct, time_limit, points, explanation, explanation_image_url
  from questions
  where quiz_id = p_quiz_id;

  return v_game;
end $$;

-- ---------------------------------------------------------------------
-- Zobrazenie položky: otázka → 'preview', snímka → 'slide'
-- Verejný riadok dostane aj poradie otázky (number) a počet otázok (total),
-- aby sa snímky nerátali do „Otázka 3 / 10“.
-- ---------------------------------------------------------------------

create or replace function public.host_show_question(p_game_id uuid, p_index int)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_game   games;
  v_q      game_questions;
  v_number int;
  v_total  int;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  select * into v_game from games where id = p_game_id for update;
  if not found then raise exception 'game_not_found'; end if;
  if v_game.status = 'finished' then raise exception 'game_finished'; end if;
  if v_game.status in ('preview', 'question') then return; end if;  -- už beží otázka
  if v_game.question_index >= p_index then return; end if;          -- opakované volanie

  select * into v_q from game_questions where game_id = p_game_id and idx = p_index;
  if not found then raise exception 'invalid_index'; end if;

  select count(*) filter (where kind = 'question' and idx <= p_index),
         count(*) filter (where kind = 'question')
  into v_number, v_total
  from game_questions where game_id = p_game_id;

  if v_q.kind = 'slide' then
    update games set
      status          = 'slide',
      question_index  = p_index,
      question        = jsonb_build_object(
                          'idx',         v_q.idx,
                          'kind',        'slide',
                          'category',    v_q.category,
                          'text',        v_q.text,
                          'body',        v_q.explanation,
                          'image_url',   v_q.image_url,
                          'answers',     '[]'::jsonb,
                          'time_limit',  0,
                          'points',      0,
                          'total',       v_total),
      preview_ends_at = null,
      started_at      = null,
      ends_at         = null
    where id = p_game_id;
    return;
  end if;

  update games set
    status          = 'preview',
    question_index  = p_index,
    question        = jsonb_build_object(
                        'idx',        v_q.idx,
                        'kind',       'question',
                        'category',   v_q.category,
                        'text',       v_q.text,
                        'image_url',  v_q.image_url,
                        'answers',    to_jsonb(v_q.answers),
                        'time_limit', v_q.time_limit,
                        'points',     v_q.points,
                        'number',     v_number,
                        'total',      v_total),
    preview_ends_at = now() + interval '5 seconds',
    started_at      = null,
    ends_at         = null
  where id = p_game_id;
end $$;
