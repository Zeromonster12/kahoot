// Test zámku webu (middleware.js). Spustenie: npm run test:middleware
import assert from 'node:assert/strict'
import middleware from '../middleware.js'

const req = (auth) => new Request('https://kvizovka.vercel.app/admin', { headers: auth ? { authorization: auth } : {} })
const basic = (user, pass) => 'Basic ' + Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')
const passes = (res) => res.headers.get('x-middleware-next') === '1'

let n = 0
function test(name, fn) {
  fn()
  n++
  console.log(`  ✓ ${name}`)
}

delete process.env.SITE_PASSWORD
test('bez SITE_PASSWORD je web otvorený', () => assert.ok(passes(middleware(req()))))

process.env.SITE_PASSWORD = 'Tajné-heslo:123'
test('bez hesla → 401 s výzvou na prihlásenie', () => {
  const res = middleware(req())
  assert.equal(res.status, 401)
  assert.match(res.headers.get('www-authenticate'), /^Basic /)
})
test('nesprávne heslo → 401', () => assert.equal(middleware(req(basic('x', 'zle'))).status, 401))
test('heslo len ako začiatok správneho → 401', () => assert.equal(middleware(req(basic('x', 'Tajné'))).status, 401))
test('pokazená hlavička → 401', () => assert.equal(middleware(req('Basic %%%nie-base64')).status, 401))
test('správne heslo (aj s diakritikou a dvojbodkou), ľubovoľné meno → pustí', () => {
  assert.ok(passes(middleware(req(basic('ucitel', 'Tajné-heslo:123')))))
  assert.ok(passes(middleware(req(basic('', 'Tajné-heslo:123')))))
})

console.log(`\nVšetkých ${n} testov prešlo.`)
