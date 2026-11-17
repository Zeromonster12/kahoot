// Testy hernej logiky v SQL (supabase/migrations/*.sql) na PGlite – Postgres vo WASM.
// Spustenie: npm run test:sql
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'

// všetky migrácie v poradí (0001_init.sql, 0002_….sql, …)
const migrationsDir = new URL('../supabase/migrations/', import.meta.url)
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(new URL(f, migrationsDir), 'utf8'))

const db = new PGlite()

// Náhrada za Supabase prostredie: roly a auth.jwt()
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  grant execute on function auth.jwt() to anon, authenticated;
`)
for (const sql of migrations) await db.exec(sql)
await db.exec(`insert into public.admin_emails (email) values ('ucitel@skola.sk')`)

const ADMIN = { role: 'authenticated', claims: { email: 'Ucitel@Skola.sk' } }
const OTHER = { role: 'authenticated', claims: { email: 'student@skola.sk' } }
const ANON = { role: 'anon', claims: {} }

async function as(who, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify(who.claims)}', false); set role ${who.role};`)
  try {
    return (await db.query(sql, params)).rows
  } finally {
    await db.exec('reset role')
  }
}

async function rejects(promise, pattern) {
  await assert.rejects(promise, (e) => {
    assert.match(e.message, pattern)
    return true
  })
}

let passed = 0
async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.stack ?? e}`)
    process.exitCode = 1
  }
}

// ---------------------------------------------------------------------------
let quizId, gameId, pin, teamA, teamB, teamC

await test('admin vytvorí kvíz s otázkami', async () => {
  ;[{ id: quizId }] = await as(ADMIN, `insert into quizzes (title) values ('Test kvíz') returning id`)
  await as(ADMIN, `
    insert into questions (quiz_id, position, category, text, answers, correct, time_limit, points) values
      ($1, 0, 'Geografia', 'Hlavné mesto SR?', array['Košice','Bratislava','Žilina','Nitra'], 1, 20, 1000),
      ($1, 2, 'Šport',     'Koľko hráčov má futbalový tím?', array['9','10','11'], 2, 10, 2000),
      ($1, 1, 'Geografia', 'Najvyšší štít Tatier?', array['Gerlachovský štít','Lomnický štít'], 0, 30, 0)
  `, [quizId])
  await as(ADMIN, `update questions set explanation = 'Bratislava je hlavným mestom od roku 1993.', explanation_image_url = 'https://example.com/mapa.png' where quiz_id = $1 and position = 0`, [quizId])
  const rows = await as(ADMIN, `select count(*)::int as n from questions where quiz_id = $1`, [quizId])
  assert.equal(rows[0].n, 3)
})

await test('vysvetlenie má limit 300 znakov a predvolene je prázdne', async () => {
  await rejects(
    as(ADMIN, `update questions set explanation = repeat('x', 301) where quiz_id = $1 and position = 0`, [quizId]),
    /check constraint/,
  )
  const [q] = await as(ADMIN, `select explanation, explanation_image_url from questions where quiz_id = $1 and position = 1`, [quizId])
  assert.equal(q.explanation, '')
  assert.equal(q.explanation_image_url, null)
})

await test('anonym ani cudzí používateľ nevidí kvízy', async () => {
  await rejects(as(ANON, `select * from quizzes`), /permission denied/)
  const rows = await as(OTHER, `select * from quizzes`)
  assert.equal(rows.length, 0)
  await rejects(as(OTHER, `insert into quizzes (title) values ('hack')`), /row-level security/)
})

await test('neplatná otázka je odmietnutá (správna odpoveď mimo rozsahu)', async () => {
  await rejects(
    as(ADMIN, `insert into questions (quiz_id, text, answers, correct) values ($1, 'x', array['a','b'], 2)`, [quizId]),
    /check constraint/,
  )
})

await test('create_game: len admin, skopíruje otázky v poradí', async () => {
  await rejects(as(ANON, `select create_game($1)`, [quizId]), /permission denied/)
  await rejects(as(OTHER, `select create_game($1)`, [quizId]), /not_authorized/)
  ;[{ create_game: gameId }] = await as(ADMIN, `select create_game($1)`, [quizId])
  const [g] = await as(ADMIN, `select * from games where id = $1`, [gameId])
  ;[{ pin }] = await as(ADMIN, `select pin from game_pins where game_id = $1 and active`, [gameId])
  assert.match(pin, /^\d{6}$/)
  assert.equal(g.pin, undefined, 'PIN nesmie byť vo verejnej tabuľke games')
  assert.equal(g.locked, false)
  assert.equal(g.status, 'lobby')
  assert.equal(g.question_count, 3)
  const qs = await as(ADMIN, `select idx, text from game_questions where game_id = $1 order by idx`, [gameId])
  assert.deepEqual(qs.map((q) => q.text), ['Hlavné mesto SR?', 'Najvyšší štít Tatier?', 'Koľko hráčov má futbalový tím?'])
})

await test('prázdny kvíz sa nedá spustiť', async () => {
  const [{ id }] = await as(ADMIN, `insert into quizzes (title) values ('Prázdny') returning id`)
  await rejects(as(ADMIN, `select create_game($1)`, [id]), /quiz_empty/)
})

await test('join_game: tímy sa pripoja, meno je unikátne bez ohľadu na veľkosť písmen', async () => {
  ;[{ join_game: teamA }] = await as(ANON, `select join_game($1, $2)`, [pin, '  Rýchle   šípy '])
  assert.equal(teamA.name, 'Rýchle šípy')
  assert.equal(teamA.game_id, gameId)
  ;[{ join_game: teamB }] = await as(ANON, `select join_game($1, $2)`, [` ${pin} `, 'Bystré hlavy'])
  ;[{ join_game: teamC }] = await as(ANON, `select join_game($1, $2)`, [pin, 'Spáči'])
  await rejects(as(ANON, `select join_game($1, $2)`, [pin, 'RÝCHLE ŠÍPY']), /name_taken/)
  await rejects(as(ANON, `select join_game($1, $2)`, [pin, '   ']), /invalid_name/)
  await rejects(as(ANON, `select join_game($1, $2)`, [pin, 'x'.repeat(25)]), /invalid_name/)
  await rejects(as(ANON, `select join_game($1, $2)`, ['000000', 'Niekto']), /game_not_found/)
})

await test('anonym vidí hru, ale nie tímy, tokeny, odpovede ani správne odpovede', async () => {
  const games = await as(ANON, `select * from games where id = $1`, [gameId])
  assert.equal(games.length, 1)
  await rejects(as(ANON, `select * from teams`), /permission denied/)
  await rejects(as(ANON, `select * from answers`), /permission denied/)
  await rejects(as(ANON, `select * from game_questions`), /permission denied/)
  await rejects(as(ANON, `update games set status = 'finished'`), /permission denied/)
})

await test('PIN-y nie sú verejné: anonym ich nevypíše, hru nájde len so správnym PIN-om', async () => {
  const [g] = await as(ANON, `select * from games where id = $1`, [gameId])
  assert.ok(!('pin' in g), 'riadok games nesmie obsahovať PIN')
  await rejects(as(ANON, `select * from game_pins`), /permission denied/)
  await rejects(as(ANON, `select * from game_kicked_names`), /permission denied/)
  const others = await as(OTHER, `select * from game_pins`)
  assert.equal(others.length, 0, 'prihlásený ne-admin nevidí PIN-y')
  const [{ find_game: found }] = await as(ANON, `select find_game($1)`, [` ${pin} `])
  assert.deepEqual(found, { id: gameId, status: 'lobby', locked: false, quiz_title: 'Test kvíz' })
  const [{ find_game: none }] = await as(ANON, `select find_game($1)`, ['000000'])
  assert.equal(none, null)
})

await test('hostovské funkcie zámku a vyhadzovania nemôže volať anonym ani cudzí používateľ', async () => {
  await rejects(as(ANON, `select host_set_locked($1, true)`, [gameId]), /permission denied/)
  await rejects(as(OTHER, `select host_set_locked($1, true)`, [gameId]), /not_authorized/)
  await rejects(as(ANON, `select host_kick_team($1)`, [teamA.team_id]), /permission denied/)
  await rejects(as(OTHER, `select host_kick_team($1)`, [teamA.team_id]), /not_authorized/)
  await rejects(as(ANON, `select clean_team_name('x')`), /permission denied/)
})

await test('hostovské akcie nemôže volať anonym ani cudzí používateľ', async () => {
  await rejects(as(ANON, `select host_show_question($1, 0)`, [gameId]), /permission denied/)
  await rejects(as(OTHER, `select host_show_question($1, 0)`, [gameId]), /not_authorized/)
  await rejects(as(OTHER, `select host_reveal($1)`, [gameId]), /not_authorized/)
})

await test('preview: otázka je verejná, ale bez správnej odpovede; odpovedať sa ešte nedá', async () => {
  await as(ADMIN, `select host_show_question($1, 0)`, [gameId])
  const [g] = await as(ANON, `select status, locked, preview_ends_at, question from games where id = $1`, [gameId])
  assert.equal(g.status, 'preview')
  assert.equal(g.locked, false, 'hra sa sama nezamyká – neskoro prišlí žiaci sa môžu pripojiť')
  assert.ok(g.preview_ends_at, 'termín otvorenia odpovedí je na serveri')
  assert.equal(g.question.text, 'Hlavné mesto SR?')
  assert.equal(g.question.correct, undefined)
  assert.equal(g.question.explanation, undefined, 'vysvetlenie by prezradilo odpoveď')
  assert.equal(g.question.explanation_image_url, undefined, 'obrázok k vysvetleniu by prezradil odpoveď')
  assert.deepEqual(g.question.answers, ['Košice', 'Bratislava', 'Žilina', 'Nitra'])
  await rejects(as(ANON, `select submit_answer($1, $2, 1)`, [teamA.team_id, teamA.token]), /not_accepting/)
})

await test('odpovedanie: body podľa rýchlosti, jedna odpoveď na tím, falošný token neprejde', async () => {
  await as(ADMIN, `select host_open_answers($1)`, [gameId])
  // tím A odpovedá "okamžite", tím B o 10 s (simulujeme posunom started_at)
  await as(ANON, `select submit_answer($1, $2, 1)`, [teamA.team_id, teamA.token])
  await db.exec(`update games set started_at = started_at - interval '10 seconds', ends_at = ends_at - interval '10 seconds' where id = '${gameId}'`)
  await as(ANON, `select submit_answer($1, $2, 1)`, [teamB.team_id, teamB.token])
  await rejects(as(ANON, `select submit_answer($1, $2, 0)`, [teamA.team_id, teamA.token]), /already_answered/)
  await rejects(as(ANON, `select submit_answer($1, $2, 0)`, [teamC.team_id, teamA.token]), /team_not_found/)
  await rejects(as(ANON, `select submit_answer($1, $2, 7)`, [teamC.team_id, teamC.token]), /invalid_answer/)

  const ans = await as(ADMIN, `select t.name, a.points, a.correct from answers a join teams t on t.id = a.team_id order by t.name`)
  const a = ans.find((x) => x.name === 'Rýchle šípy')
  const b = ans.find((x) => x.name === 'Bystré hlavy')
  assert.ok(a.points > 990 && a.points <= 1000, `rýchly tím: ${a.points}`)
  assert.ok(b.points >= 745 && b.points <= 755, `pomalší tím (10/20 s): ${b.points}`)
})

await test('team_state počas otázky neprezradí správnosť ani body', async () => {
  const [{ team_state: s }] = await as(ANON, `select team_state($1, $2)`, [teamA.team_id, teamA.token])
  assert.equal(s.score, 0)
  assert.equal(s.answer.answer, 1)
  assert.equal(s.answer.correct, undefined)
  assert.equal(s.answer.points, undefined)
  const [{ team_state: c }] = await as(ANON, `select team_state($1, $2)`, [teamC.team_id, teamC.token])
  assert.equal(c.answer, null)
  await rejects(as(ANON, `select team_state($1, $2)`, [teamA.team_id, teamB.token]), /team_not_found/)
})

await test('reveal: pripočíta body raz, zverejní správnu odpoveď a štatistiku', async () => {
  await as(ADMIN, `select host_reveal($1)`, [gameId])
  await as(ADMIN, `select host_reveal($1)`, [gameId]) // opakované volanie nič nepokazí
  const [g] = await as(ANON, `select status, question from games where id = $1`, [gameId])
  assert.equal(g.status, 'reveal')
  assert.equal(g.question.correct, 1)
  assert.deepEqual(g.question.counts, [0, 2, 0, 0])
  assert.equal(g.question.answered, 2)
  assert.equal(g.question.explanation, 'Bratislava je hlavným mestom od roku 1993.')
  assert.equal(g.question.explanation_image_url, 'https://example.com/mapa.png')

  const [{ team_state: s }] = await as(ANON, `select team_state($1, $2)`, [teamA.team_id, teamA.token])
  assert.equal(s.status, 'reveal')
  assert.equal(s.question_index, 0)
  assert.equal(s.answer.correct, true)
  assert.equal(s.score, s.answer.points)
  assert.equal(s.rank, 1)
  assert.equal(s.team_count, 3)
  const [{ team_state: c }] = await as(ANON, `select team_state($1, $2)`, [teamC.team_id, teamC.token])
  assert.equal(c.score, 0)
  assert.equal(c.rank, 3)
  await rejects(as(ANON, `select submit_answer($1, $2, 1)`, [teamC.team_id, teamC.token]), /not_accepting/)
})

await test('otázka bez bodov (0) a neskorá odpoveď po čase', async () => {
  await as(ADMIN, `select host_scoreboard($1)`, [gameId])
  await as(ADMIN, `select host_show_question($1, 1)`, [gameId])
  await as(ADMIN, `select host_show_question($1, 1)`, [gameId]) // duplicitné volanie je ignorované
  await as(ADMIN, `select host_open_answers($1)`, [gameId])
  await as(ANON, `select submit_answer($1, $2, 0)`, [teamC.team_id, teamC.token])
  await db.exec(`update games set ends_at = now() - interval '2 seconds' where id = '${gameId}'`)
  await rejects(as(ANON, `select submit_answer($1, $2, 0)`, [teamA.team_id, teamA.token]), /time_up/)
  await as(ADMIN, `select host_reveal($1)`, [gameId])
  const [{ team_state: c }] = await as(ANON, `select team_state($1, $2)`, [teamC.team_id, teamC.token])
  assert.equal(c.answer.correct, true)
  assert.equal(c.answer.points, 0)
})

await test('dvojnásobné body a rebríček', async () => {
  await as(ADMIN, `select host_show_question($1, 2)`, [gameId])
  await as(ADMIN, `select host_open_answers($1)`, [gameId])
  await as(ANON, `select submit_answer($1, $2, 2)`, [teamC.team_id, teamC.token])
  await as(ANON, `select submit_answer($1, $2, 0)`, [teamA.team_id, teamA.token])
  await as(ADMIN, `select host_reveal($1)`, [gameId])
  const [{ get_leaderboard: lb }] = await as(ANON, `select get_leaderboard($1)`, [gameId])
  assert.deepEqual(lb.map((t) => t.name), ['Spáči', 'Rýchle šípy', 'Bystré hlavy'])
  assert.ok(lb[0].score > 1990, `2x body: ${lb[0].score}`)
  assert.deepEqual(lb.map((t) => t.rank), [1, 2, 3])
})

await test('koniec hry: PIN sa uvoľní, pripojiť sa už nedá, správna odpoveď zmizne z verejného riadku', async () => {
  await rejects(as(ADMIN, `select host_show_question($1, 3)`, [gameId]), /invalid_index/)
  await as(ADMIN, `select host_finish($1)`, [gameId])
  const [g] = await as(ANON, `select status, finished_at, question from games where id = $1`, [gameId])
  assert.equal(g.status, 'finished')
  assert.ok(g.finished_at)
  assert.equal(g.question.correct, undefined, 'ukončená hra nesmie byť ťahákom')
  assert.equal(g.question.counts, undefined)
  assert.equal(g.question.explanation, undefined)
  assert.equal(g.question.text, 'Koľko hráčov má futbalový tím?')
  const [p] = await as(ADMIN, `select active from game_pins where game_id = $1`, [gameId])
  assert.equal(p.active, false)
  await rejects(as(ANON, `select join_game($1, $2)`, [pin, 'Neskorý tím']), /game_not_found/)
  const [{ find_game: none }] = await as(ANON, `select find_game($1)`, [pin])
  assert.equal(none, null)
  await rejects(as(ADMIN, `select host_show_question($1, 0)`, [gameId]), /game_finished/)
  await rejects(as(ADMIN, `select host_set_locked($1, false)`, [gameId]), /game_finished/)
})

// ---------------------------------------------------------------------------
// Zámok hry, vyhadzovanie, názvy tímov, strop 200 tímov (samostatná hra)

let game2, pin2
await test('zamknutie a odomknutie hry', async () => {
  ;[{ create_game: game2 }] = await as(ADMIN, `select create_game($1)`, [quizId])
  ;[{ pin: pin2 }] = await as(ADMIN, `select pin from game_pins where game_id = $1`, [game2])
  assert.notEqual(pin2, pin)
  await as(ADMIN, `select host_set_locked($1, true)`, [game2])
  const [{ find_game: f }] = await as(ANON, `select find_game($1)`, [pin2])
  assert.equal(f.locked, true)
  await rejects(as(ANON, `select join_game($1, $2)`, [pin2, 'Sovy']), /game_locked/)
  await as(ADMIN, `select host_set_locked($1, false)`, [game2])
  await as(ANON, `select join_game($1, $2)`, [pin2, 'Sovy'])
})

await test('vyhodený tím sa s rovnakým názvom nevráti, s iným áno', async () => {
  const [t] = await as(ADMIN, `select id, token from teams where game_id = $1 and name = 'Sovy'`, [game2])
  await as(ADMIN, `select host_kick_team($1)`, [t.id])
  await as(ADMIN, `select host_kick_team($1)`, [t.id]) // opakované volanie nič nepokazí
  await rejects(as(ANON, `select team_state($1, $2)`, [t.id, t.token]), /team_not_found/)
  await rejects(as(ANON, `select join_game($1, $2)`, [pin2, 'SOVY']), /name_kicked/)
  await as(ANON, `select join_game($1, $2)`, [pin2, 'Sovy 2'])
})

await test('názov tímu: NFKC, bez neviditeľných a riadiacich znakov', async () => {
  const [{ join_game: a }] = await as(ANON, `select join_game($1, $2)`, [pin2, '​Líš­ky‮ \t tím﻿'])
  assert.equal(a.name, 'Líšky tím')
  const [{ join_game: b }] = await as(ANON, `select join_game($1, $2)`, [pin2, 'ＡＢＣ'])
  assert.equal(b.name, 'ABC')
  await rejects(as(ANON, `select join_game($1, $2)`, [pin2, 'a​bc']), /name_taken/)
  await rejects(as(ANON, `select join_game($1, $2)`, [pin2, '​‌⁦']), /invalid_name/)
})

await test('strop 200 tímov na hru', async () => {
  const [{ n }] = await as(ADMIN, `select count(*)::int as n from teams where game_id = $1`, [game2])
  await db.query(`insert into teams (game_id, name) select $1, 'bot ' || i from generate_series(1, $2::int) i`, [game2, 199 - n])
  await as(ANON, `select join_game($1, $2)`, [pin2, 'Dvojstý tím'])
  await rejects(as(ANON, `select join_game($1, $2)`, [pin2, 'Navyše']), /game_full/)
  await as(ADMIN, `select host_finish($1)`, [game2])
})

// ---------------------------------------------------------------------------
// Hra bez projektora a odchod tímu (0006, samostatná hra)

let game3, pin3, t3a, t3b
await test('advance_game: hra pokračuje bez projektora, ale nič neurýchli', async () => {
  ;[{ create_game: game3 }] = await as(ADMIN, `select create_game($1)`, [quizId])
  ;[{ pin: pin3 }] = await as(ADMIN, `select pin from game_pins where game_id = $1`, [game3])
  ;[{ join_game: t3a }] = await as(ANON, `select join_game($1, $2)`, [pin3, 'Prví'])
  ;[{ join_game: t3b }] = await as(ANON, `select join_game($1, $2)`, [pin3, 'Druhí'])
  const status = async () => (await as(ANON, `select status from games where id = $1`, [game3]))[0].status

  await as(ANON, `select advance_game($1)`, [game3])
  assert.equal(await status(), 'lobby', 'lobby posúva len učiteľ')
  await as(ADMIN, `select host_show_question($1, 0)`, [game3])
  await as(ANON, `select advance_game($1)`, [game3])
  assert.equal(await status(), 'preview', 'pred koncom úvodu sa nič nestane')

  await db.query(`update games set preview_ends_at = now() - interval '1 second' where id = $1`, [game3])
  await as(ANON, `select advance_game($1)`, [game3])
  assert.equal(await status(), 'question', 'po úvode sa odpovedanie otvorí aj bez projektora')

  await as(ANON, `select submit_answer($1, $2, 1)`, [t3a.team_id, t3a.token])
  await as(ANON, `select advance_game($1)`, [game3])
  assert.equal(await status(), 'question', 'pred koncom času sa nevyhodnocuje (ani keď všetci neodpovedali)')
  await db.query(`update games set ends_at = now() - interval '0.5 second' where id = $1`, [game3])
  await as(ANON, `select advance_game($1)`, [game3])
  assert.equal(await status(), 'question', 'počas 1 s rezervy pre neskoré odpovede sa ešte nevyhodnocuje')

  await db.query(`update games set ends_at = now() - interval '2 seconds' where id = $1`, [game3])
  await as(ANON, `select advance_game($1)`, [game3])
  await as(ANON, `select advance_game($1)`, [game3]) // opakované volanie body nepripočíta znova
  const [g] = await as(ANON, `select status, question from games where id = $1`, [game3])
  assert.equal(g.status, 'reveal')
  assert.equal(g.question.correct, 1)
  const [{ team_state: s }] = await as(ANON, `select team_state($1, $2)`, [t3a.team_id, t3a.token])
  assert.equal(s.score, s.answer.points)
  assert.ok(s.score > 0)

  await as(ANON, `select advance_game($1)`, [game3])
  assert.equal(await status(), 'reveal', 'po vyhodnotení pokračuje len učiteľ')
  await rejects(as(ANON, `select internal_reveal($1)`, [game3]), /permission denied/)
  await rejects(as(ANON, `select internal_open_answers($1)`, [game3]), /permission denied/)
  await rejects(as(ANON, `select advance_game($1)`, ['00000000-0000-0000-0000-000000000000']), /game_not_found/)
})

await test('leave_game: tím odíde, s rovnakým názvom sa môže vrátiť; po konci hry ostáva vo výsledkoch', async () => {
  await rejects(as(ANON, `select leave_game($1, $2)`, [t3b.team_id, t3a.token]), /team_not_found/)
  await as(ANON, `select leave_game($1, $2)`, [t3b.team_id, t3b.token])
  await rejects(as(ANON, `select team_state($1, $2)`, [t3b.team_id, t3b.token]), /team_not_found/)
  const [{ join_game: back }] = await as(ANON, `select join_game($1, $2)`, [pin3, 'Druhí'])
  assert.equal(back.name, 'Druhí')

  await as(ADMIN, `select host_finish($1)`, [game3])
  await as(ANON, `select leave_game($1, $2)`, [t3a.team_id, t3a.token])
  const [{ get_leaderboard: lb }] = await as(ANON, `select get_leaderboard($1)`, [game3])
  assert.ok(lb.some((t) => t.name === 'Prví'), 'po konci hry sa tím z výsledkov nezmaže')
})

// ---------------------------------------------------------------------------
// Snímky (0007)

let slideQuiz, game4, pin4, t4
await test('snímky: databáza vyžaduje odpovede len pri otázke', async () => {
  ;[{ id: slideQuiz }] = await as(ADMIN, `insert into quizzes (title) values ('So snímkami') returning id`)
  await rejects(
    as(ADMIN, `insert into questions (quiz_id, kind, text, answers, correct) values ($1, 'question', 'x', '{}', 0)`, [slideQuiz]),
    /check constraint/,
  )
  await rejects(
    as(ADMIN, `insert into questions (quiz_id, kind, text, answers, correct) values ($1, 'slide', 'x', array['a','b'], 0)`, [slideQuiz]),
    /check constraint/,
  )
  await rejects(
    as(ADMIN, `insert into questions (quiz_id, kind, text, answers, correct) values ($1, 'video', 'x', '{}', 0)`, [slideQuiz]),
    /check constraint/,
  )
  await as(ADMIN, `
    insert into questions (quiz_id, position, kind, category, text, answers, correct, points, explanation) values
      ($1, 0, 'slide',    'Geografia', 'Geografia', '{}', 0, 0, '2 otázky o Slovensku'),
      ($1, 1, 'question', 'Geografia', 'Hlavné mesto SR?', array['Košice','Bratislava'], 1, 1000, ''),
      ($1, 2, 'slide',    'Šport', 'Šport', '{}', 0, 0, ''),
      ($1, 3, 'question', 'Šport', 'Koľko hráčov má futbalový tím?', array['10','11'], 1, 1000, '')
  `, [slideQuiz])
})

await test('snímky: kvíz len so snímkami sa nedá spustiť, počty otázok a položiek', async () => {
  const [{ id: onlySlides }] = await as(ADMIN, `insert into quizzes (title) values ('Len snímky') returning id`)
  await as(ADMIN, `insert into questions (quiz_id, kind, text, answers, correct, points) values ($1, 'slide', 'Ahoj', '{}', 0, 0)`, [onlySlides])
  await rejects(as(ADMIN, `select create_game($1)`, [onlySlides]), /quiz_empty/)

  ;[{ create_game: game4 }] = await as(ADMIN, `select create_game($1)`, [slideQuiz])
  ;[{ pin: pin4 }] = await as(ADMIN, `select pin from game_pins where game_id = $1`, [game4])
  const [g] = await as(ANON, `select question_count, item_count from games where id = $1`, [game4])
  assert.equal(g.question_count, 2, 'question_count ráta len otázky')
  assert.equal(g.item_count, 4)
  ;[{ join_game: t4 }] = await as(ANON, `select join_game($1, $2)`, [pin4, 'Sovy'])
})

await test('snímky: hra prejde snímkou, otázky sa číslujú bez snímok', async () => {
  await as(ADMIN, `select host_show_question($1, 0)`, [game4])
  let [g] = await as(ANON, `select status, question, preview_ends_at from games where id = $1`, [game4])
  assert.equal(g.status, 'slide')
  assert.equal(g.question.kind, 'slide')
  assert.equal(g.question.text, 'Geografia')
  assert.equal(g.question.body, '2 otázky o Slovensku')
  assert.equal(g.question.number, undefined)
  assert.equal(g.question.total, 2)
  assert.equal(g.preview_ends_at, null, 'snímka nemá časovač')
  await rejects(as(ANON, `select submit_answer($1, $2, 0)`, [t4.team_id, t4.token]), /not_accepting/)
  await as(ANON, `select advance_game($1)`, [game4])
  ;[g] = await as(ANON, `select status from games where id = $1`, [game4])
  assert.equal(g.status, 'slide', 'snímku posúva len učiteľ')
  await as(ANON, `select join_game($1, $2)`, [pin4, 'Neskorí']) // počas snímky sa dá pripojiť

  await as(ADMIN, `select host_show_question($1, 1)`, [game4]) // zo snímky rovno na otázku
  ;[g] = await as(ANON, `select status, question from games where id = $1`, [game4])
  assert.equal(g.status, 'preview')
  assert.equal(g.question.kind, 'question')
  assert.equal(g.question.number, 1)
  assert.equal(g.question.total, 2)
  await as(ADMIN, `select host_open_answers($1)`, [game4])
  await as(ANON, `select submit_answer($1, $2, 1)`, [t4.team_id, t4.token])
  await as(ADMIN, `select host_reveal($1)`, [game4])
  await as(ADMIN, `select host_scoreboard($1)`, [game4])

  await as(ADMIN, `select host_show_question($1, 2)`, [game4])
  ;[g] = await as(ANON, `select status, question from games where id = $1`, [game4])
  assert.equal(g.status, 'slide')
  await as(ADMIN, `select host_show_question($1, 3)`, [game4])
  ;[g] = await as(ANON, `select status, question from games where id = $1`, [game4])
  assert.equal(g.question.number, 2, 'druhá otázka je č. 2, hoci je to 4. položka')
  await as(ADMIN, `select host_finish($1)`, [game4])
  const [{ team_state: s }] = await as(ANON, `select team_state($1, $2)`, [t4.team_id, t4.token])
  assert.ok(s.score > 0)
})

// ---------------------------------------------------------------------------
// Sprísnenie (0005)

await test('práva: anonym nemá zápis do games, nikto okrem servera nemení admin_emails', async () => {
  const privs = await db.query(`
    select grantee, privilege_type from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated')
      and (table_name = 'admin_emails' and privilege_type <> 'SELECT'
           or table_name = 'games' and grantee = 'anon' and privilege_type <> 'SELECT'
           or privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES'))`)
  assert.deepEqual(privs.rows, [])
})

await test('všetky funkcie majú search_path s pg_temp', async () => {
  const { rows } = await db.query(`
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and not coalesce('search_path=public, pg_temp' = any (p.proconfig), false)`)
  assert.deepEqual(rows.map((r) => r.proname), [])
})

await test('obrázky k otázkam len cez https://', async () => {
  const [{ id }] = await as(ADMIN, `select id from questions where quiz_id = $1 limit 1`, [quizId])
  await rejects(as(ADMIN, `update questions set image_url = 'http://example.com/a.png' where id = $1`, [id]), /check constraint/)
  await rejects(as(ADMIN, `update questions set explanation_image_url = 'javascript:alert(1)' where id = $1`, [id]), /check constraint/)
  await as(ADMIN, `update questions set image_url = 'https://example.com/a.png', explanation_image_url = null where id = $1`, [id])
})

await test('vymazanie kvízu nezmaže odohrané hry', async () => {
  await as(ADMIN, `delete from quizzes where id = $1`, [quizId])
  const [g] = await as(ADMIN, `select quiz_id, quiz_title from games where id = $1`, [gameId])
  assert.equal(g.quiz_id, null)
  assert.equal(g.quiz_title, 'Test kvíz')
  const qs = await as(ADMIN, `select count(*)::int as n from game_questions where game_id = $1`, [gameId])
  assert.equal(qs[0].n, 3)
})

await test('ukážkový kvíz (seed.sql) sa dá nahrať a spustiť', async () => {
  await db.exec(readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8'))
  const [{ id }] = await as(ADMIN, `select id from quizzes where title = 'Ukážkový kvíz'`)
  const [{ create_game: g }] = await as(ADMIN, `select create_game($1)`, [id])
  const [game] = await as(ADMIN, `select question_count from games where id = $1`, [g])
  assert.equal(game.question_count, 8)
})

console.log(process.exitCode ?'\nNiektoré testy zlyhali.' : `\nVšetkých ${passed} testov prešlo.`)
