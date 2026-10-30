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
  await as(ADMIN, `update questions set explanation = 'Bratislava je hlavným mestom od roku 1993.' where quiz_id = $1 and position = 0`, [quizId])
  const rows = await as(ADMIN, `select count(*)::int as n from questions where quiz_id = $1`, [quizId])
  assert.equal(rows[0].n, 3)
})

await test('vysvetlenie má limit 300 znakov a predvolene je prázdne', async () => {
  await rejects(
    as(ADMIN, `update questions set explanation = repeat('x', 301) where quiz_id = $1 and position = 0`, [quizId]),
    /check constraint/,
  )
  const [q] = await as(ADMIN, `select explanation from questions where quiz_id = $1 and position = 1`, [quizId])
  assert.equal(q.explanation, '')
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
  pin = g.pin
  assert.match(pin, /^\d{6}$/)
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
  const games = await as(ANON, `select pin, status from games where id = $1`, [gameId])
  assert.equal(games.length, 1)
  await rejects(as(ANON, `select * from teams`), /permission denied/)
  await rejects(as(ANON, `select * from answers`), /permission denied/)
  await rejects(as(ANON, `select * from game_questions`), /permission denied/)
  await rejects(as(ANON, `update games set status = 'finished'`), /permission denied/)
})

await test('hostovské akcie nemôže volať anonym ani cudzí používateľ', async () => {
  await rejects(as(ANON, `select host_show_question($1, 0)`, [gameId]), /permission denied/)
  await rejects(as(OTHER, `select host_show_question($1, 0)`, [gameId]), /not_authorized/)
  await rejects(as(OTHER, `select host_reveal($1)`, [gameId]), /not_authorized/)
})

await test('preview: otázka je verejná, ale bez správnej odpovede; odpovedať sa ešte nedá', async () => {
  await as(ADMIN, `select host_show_question($1, 0)`, [gameId])
  const [g] = await as(ANON, `select status, question from games where id = $1`, [gameId])
  assert.equal(g.status, 'preview')
  assert.equal(g.question.text, 'Hlavné mesto SR?')
  assert.equal(g.question.correct, undefined)
  assert.equal(g.question.explanation, undefined, 'vysvetlenie by prezradilo odpoveď')
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

await test('koniec hry: PIN sa uvoľní, pripojiť sa už nedá', async () => {
  await rejects(as(ADMIN, `select host_show_question($1, 3)`, [gameId]), /invalid_index/)
  await as(ADMIN, `select host_finish($1)`, [gameId])
  const [g] = await as(ANON, `select status, finished_at from games where id = $1`, [gameId])
  assert.equal(g.status, 'finished')
  assert.ok(g.finished_at)
  await rejects(as(ANON, `select join_game($1, $2)`, [pin, 'Neskorý tím']), /game_not_found/)
  await rejects(as(ADMIN, `select host_show_question($1, 0)`, [gameId]), /game_finished/)
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
