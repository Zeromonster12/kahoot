// End-to-end test proti skutočnému Supabase projektu: host + 3 tímy, realtime, bodovanie.
// Vytvorí dočasný kvíz a hru a na konci ich zmaže.
//
// Spustenie (premenné môžu byť aj v .env):
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const envFile = new URL('../.env', import.meta.url)
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key, E2E_ADMIN_EMAIL: email, E2E_ADMIN_PASSWORD: password } = process.env
if (!url || !key || !email || !password) {
  console.error('Chýba SUPABASE_URL, SUPABASE_ANON_KEY, E2E_ADMIN_EMAIL alebo E2E_ADMIN_PASSWORD.')
  process.exit(1)
}

const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const step = (msg) => console.log(`• ${msg}`)

async function rpc(c, fn, args) {
  const { data, error } = await c.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data
}

/** Počká, kým realtime doručí stav hry `status` (s indexom otázky). */
function waitForStatus(events, status, index, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    const check = () => {
      const hit = events.find((g) => g.status === status && (index === undefined || g.question_index === index))
      if (hit) return resolve(hit)
      if (Date.now() - t0 > timeout) return reject(new Error(`realtime: neprišiel stav ${status}/${index}`))
      setTimeout(check, 50)
    }
    check()
  })
}

const host = client()
let quizId, gameId
const players = []

try {
  step('prihlásenie admina')
  const { error: loginError } = await host.auth.signInWithPassword({ email, password })
  if (loginError) throw loginError
  assert.equal(await rpc(host, 'is_admin'), true, 'účet nie je v admin_emails')

  step('vytvorenie kvízu')
  const { data: quiz, error: qe } = await host.from('quizzes').insert({ title: 'E2E test (môžeš zmazať)' }).select().single()
  if (qe) throw qe
  quizId = quiz.id
  const { error: qse } = await host.from('questions').insert([
    { quiz_id: quizId, position: 0, category: 'Test', text: 'Otázka 1', answers: ['A', 'B', 'C', 'D'], correct: 2, time_limit: 5, explanation: 'Lebo C.', explanation_image_url: 'https://example.com/c.png' },
    { quiz_id: quizId, position: 1, category: 'Test', text: 'Otázka 2', answers: ['Áno', 'Nie'], correct: 0, time_limit: 5, points: 2000 },
  ])
  if (qse) throw qse

  step('spustenie hry')
  gameId = await rpc(host, 'create_game', { p_quiz_id: quizId })
  const { data: game } = await host.from('games').select('*').eq('id', gameId).single()
  assert.equal(game.pin, undefined, 'PIN nesmie byť vo verejnej tabuľke games')
  const { data: pinRow, error: pe } = await host.from('game_pins').select('pin').eq('game_id', gameId).single()
  if (pe) throw pe
  game.pin = pinRow.pin

  const hostAnswers = []
  const hostChannel = host
    .channel('e2e-host')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers', filter: `game_id=eq.${gameId}` }, (p) => hostAnswers.push(p.new))
  await new Promise((res) => hostChannel.subscribe((s) => s === 'SUBSCRIBED' && res()))

  step('pripojenie 3 tímov (anonymne) + realtime odber hry')
  for (const name of ['Sovy', 'Líšky', 'Ježkovia']) {
    const c = client()
    const team = await rpc(c, 'join_game', { p_pin: game.pin, p_name: name })
    const events = []
    const ch = c
      .channel(`e2e-${name}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (p) => events.push(p.new))
    await new Promise((res) => ch.subscribe((s) => s === 'SUBSCRIBED' && res()))
    players.push({ c, team, events, ch })
  }
  await assert.rejects(rpc(players[0].c, 'join_game', { p_pin: game.pin, p_name: 'sovy' }), /name_taken/)

  step('anonym nevidí tímy ani odpovede')
  const { data: leakedTeams } = await players[0].c.from('teams').select('*')
  assert.ok(!leakedTeams || leakedTeams.length === 0, 'anonym vidí tímy!')
  const { data: leakedQs } = await players[0].c.from('game_questions').select('*')
  assert.ok(!leakedQs || leakedQs.length === 0, 'anonym vidí správne odpovede!')
  const { data: leakedPins } = await players[0].c.from('game_pins').select('*')
  assert.ok(!leakedPins || leakedPins.length === 0, 'anonym vidí PIN-y hier!')

  step('otázka 1: preview → realtime k tímom bez správnej odpovede')
  await rpc(host, 'host_show_question', { p_game_id: gameId, p_index: 0 })
  for (const p of players) {
    const g = await waitForStatus(p.events, 'preview', 0)
    assert.equal(g.question.correct, undefined)
    assert.equal(g.question.explanation, undefined, 'vysvetlenie prezradené pred odhalením')
    assert.equal(g.question.explanation_image_url, undefined, 'obrázok k vysvetleniu prezradený pred odhalením')
  }

  step('otvorenie odpovedí, tímy odpovedajú')
  await rpc(host, 'host_open_answers', { p_game_id: gameId })
  await Promise.all(players.map((p) => waitForStatus(p.events, 'question', 0)))
  await rpc(players[0].c, 'submit_answer', { p_team_id: players[0].team.team_id, p_token: players[0].team.token, p_answer: 2 })
  await sleep(1500)
  await rpc(players[1].c, 'submit_answer', { p_team_id: players[1].team.team_id, p_token: players[1].team.token, p_answer: 2 })
  await rpc(players[2].c, 'submit_answer', { p_team_id: players[2].team.team_id, p_token: players[2].team.token, p_answer: 0 })
  await assert.rejects(
    rpc(players[2].c, 'submit_answer', { p_team_id: players[2].team.team_id, p_token: players[2].team.token, p_answer: 2 }),
    /already_answered/,
  )
  const during = await rpc(players[0].c, 'team_state', { p_team_id: players[0].team.team_id, p_token: players[0].team.token })
  assert.equal(during.answer.correct, undefined, 'správnosť prezradená pred odhalením')

  await sleep(800)
  assert.equal(hostAnswers.length, 3, `host cez realtime dostal ${hostAnswers.length}/3 odpovedí`)

  step('odhalenie')
  await rpc(host, 'host_reveal', { p_game_id: gameId })
  for (const p of players) {
    const g = await waitForStatus(p.events, 'reveal', 0)
    assert.equal(g.question.correct, 2)
    assert.deepEqual(g.question.counts, [1, 0, 2, 0])
    assert.equal(g.question.explanation, 'Lebo C.')
    assert.equal(g.question.explanation_image_url, 'https://example.com/c.png')
  }
  const s0 = await rpc(players[0].c, 'team_state', { p_team_id: players[0].team.team_id, p_token: players[0].team.token })
  const s1 = await rpc(players[1].c, 'team_state', { p_team_id: players[1].team.team_id, p_token: players[1].team.token })
  const s2 = await rpc(players[2].c, 'team_state', { p_team_id: players[2].team.team_id, p_token: players[2].team.token })
  assert.ok(s0.answer.correct && s1.answer.correct && !s2.answer.correct)
  assert.ok(s0.answer.points > s1.answer.points, `rýchlejší tím má viac bodov (${s0.answer.points} vs ${s1.answer.points})`)
  assert.equal(s0.rank, 1)
  console.log(`  body: Sovy ${s0.score}, Líšky ${s1.score}, Ježkovia ${s2.score}`)

  step('otázka 2 (2× body) a koniec času bez odpovede')
  await rpc(host, 'host_scoreboard', { p_game_id: gameId })
  await rpc(host, 'host_show_question', { p_game_id: gameId, p_index: 1 })
  await rpc(host, 'host_open_answers', { p_game_id: gameId })
  await rpc(players[2].c, 'submit_answer', { p_team_id: players[2].team.team_id, p_token: players[2].team.token, p_answer: 0 })
  await sleep(6500)
  await assert.rejects(
    rpc(players[1].c, 'submit_answer', { p_team_id: players[1].team.team_id, p_token: players[1].team.token, p_answer: 0 }),
    /time_up/,
  )
  await rpc(host, 'host_reveal', { p_game_id: gameId })

  step('koniec hry a rebríček')
  await rpc(host, 'host_finish', { p_game_id: gameId })
  for (const p of players) await waitForStatus(p.events, 'finished')
  const lb = await rpc(players[0].c, 'get_leaderboard', { p_game_id: gameId })
  console.log('  ' + lb.map((t) => `${t.rank}. ${t.name} (${t.score})`).join(', '))
  assert.equal(lb[0].name, 'Ježkovia')

  console.log('\nE2E test prešiel ✓')
} catch (e) {
  console.error('\nE2E test zlyhal:', e)
  process.exitCode = 1
} finally {
  for (const p of players) await p.c.removeChannel(p.ch).catch(() => {})
  await host.removeAllChannels().catch(() => {})
  if (gameId) await host.from('games').delete().eq('id', gameId)
  if (quizId) await host.from('quizzes').delete().eq('id', quizId)
  await host.auth.signOut().catch(() => {})
  process.exit(process.exitCode ?? 0)
}
