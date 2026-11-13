-- =====================================================================
-- Kvízovka – sprísnenie práv a kontrol
-- Spusti v Supabase → SQL Editor → New query → Run (po 0004_game_access.sql).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Práva na tabuľky: len to, čo aplikácia naozaj používa
--    Supabase pri vytvorení tabuľky dá rolám anon/authenticated všetky práva
--    (aj TRUNCATE). Doteraz zápis zastavovalo len RLS – teraz už aj samotné práva.
-- ---------------------------------------------------------------------

revoke insert, update, delete, truncate, references, trigger on public.games from anon;
revoke truncate, references, trigger
  on public.quizzes, public.questions, public.games, public.game_questions,
     public.teams, public.answers, public.game_pins, public.game_kicked_names
  from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.admin_emails from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) search_path s pg_temp vo všetkých funkciách
--    (dočasná schéma nemôže podvrhnúť tabuľku ani funkciu s rovnakým názvom)
-- ---------------------------------------------------------------------

alter function public.is_admin()                          set search_path = public, pg_temp;
alter function public.touch_updated_at()                  set search_path = public, pg_temp;
alter function public.server_now()                        set search_path = public, pg_temp;
alter function public.create_game(uuid)                   set search_path = public, pg_temp;
alter function public.host_show_question(uuid, int)       set search_path = public, pg_temp;
alter function public.host_open_answers(uuid)             set search_path = public, pg_temp;
alter function public.host_reveal(uuid)                   set search_path = public, pg_temp;
alter function public.host_scoreboard(uuid)               set search_path = public, pg_temp;
alter function public.host_finish(uuid)                   set search_path = public, pg_temp;
alter function public.host_set_locked(uuid, boolean)      set search_path = public, pg_temp;
alter function public.host_kick_team(uuid)                set search_path = public, pg_temp;
alter function public.clean_team_name(text)               set search_path = public, pg_temp;
alter function public.find_game(text)                     set search_path = public, pg_temp;
alter function public.join_game(text, text)               set search_path = public, pg_temp;
alter function public.team_state(uuid, uuid)              set search_path = public, pg_temp;
alter function public.get_leaderboard(uuid)               set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 3) submit_answer – jasná chyba, ak otázka v snímke hry chýba
--    (inak by sa klientovi zobrazila surová chyba databázy)
-- ---------------------------------------------------------------------

create or replace function public.submit_answer(p_team_id uuid, p_token uuid, p_answer int)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
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
  if not found then raise exception 'not_accepting'; end if;
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

-- ---------------------------------------------------------------------
-- 4) Obrázky k otázkam len cez https://
--    (načítavajú sa na mobiloch žiakov – http by bol nešifrovaný „mixed content“)
--    NOT VALID + pokus o overenie: staré záznamy s http:// migráciu nezhodia.
-- ---------------------------------------------------------------------

alter table public.questions drop constraint if exists questions_image_url_https;
alter table public.questions add constraint questions_image_url_https
  check (image_url is null or image_url ~ '^https://[^[:space:]]+$') not valid;

alter table public.questions drop constraint if exists questions_explanation_image_url_https;
alter table public.questions add constraint questions_explanation_image_url_https
  check (explanation_image_url is null or explanation_image_url ~ '^https://[^[:space:]]+$') not valid;

do $$
begin
  alter table public.questions validate constraint questions_image_url_https;
  alter table public.questions validate constraint questions_explanation_image_url_https;
exception when check_violation then
  raise notice 'Niektoré otázky majú obrázok s http:// adresou – nové a upravené otázky už musia mať https://.';
end $$;
