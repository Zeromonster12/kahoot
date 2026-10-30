// Vercel Routing Middleware – zámok celého webu počas vývoja.
// Kým je vo Verceli nastavená premenná SITE_PASSWORD, každá požiadavka (stránky aj súbory)
// vyžaduje heslo (meno môže byť ľubovoľné). Po spustení stačí premennú zmazať a dať Redeploy.
// Lokálne (npm run dev) sa nepoužíva.

export default function middleware(request) {
  const password = process.env.SITE_PASSWORD
  if (!password) return pass()

  const header = request.headers.get('authorization') ?? ''
  if (header.startsWith('Basic ') && safeEqual(passwordFrom(header), password)) return pass()

  return new Response('Stránka je vo vývoji. Na prístup treba heslo.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Kvizovka", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

/** Pustí požiadavku ďalej (rovnaké ako next() z @vercel/functions). */
function pass() {
  return new Response(null, { headers: { 'x-middleware-next': '1' } })
}

/** Heslo z hlavičky "Basic base64(meno:heslo)" – UTF-8, aby fungovala aj diakritika. */
function passwordFrom(header) {
  try {
    const bytes = Uint8Array.from(atob(header.slice(6).trim()), (c) => c.charCodeAt(0))
    const decoded = new TextDecoder().decode(bytes)
    return decoded.slice(decoded.indexOf(':') + 1)
  } catch {
    return ''
  }
}

/** Porovnanie v konštantnom čase (neprezradí dĺžku zhody). */
function safeEqual(a, b) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}
