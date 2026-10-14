// Uloženie tímu v prehliadači – po obnovení stránky sa tím vráti do hry.
export interface TeamSession {
  gameId: string
  teamId: string
  token: string
  name: string
  pin: string
}

const KEY = 'kvizovka.team'

export function loadTeamSession(): TeamSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as TeamSession) : null
  } catch {
    return null
  }
}

export function saveTeamSession(s: TeamSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // súkromné okno a pod. – hra pôjde, len sa nepamätá po obnovení
  }
}

export function clearTeamSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
