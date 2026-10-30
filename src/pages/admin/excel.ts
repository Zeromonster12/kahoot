import type { PointsMode } from '../../lib/types'
import { TIME_LIMITS } from '../../lib/theme'
import {
  DEFAULT_POINTS,
  DEFAULT_TIME,
  MAX_ANSWER,
  MAX_ANSWERS,
  MAX_CATEGORY,
  MAX_EXPLANATION,
  MAX_QUESTION,
  MIN_ANSWERS,
  type QuestionData,
} from './model'
import { normalizeKey, slugify } from './utils'

// Import a export otázok – Excel (.xlsx/.xls/.ods) a CSV.
// Knižnica SheetJS sa načíta až keď ju treba (je veľká).

export type ParsedQuestion = QuestionData

export interface ParseError {
  /** číslo riadku v tabuľke (hlavička = 1) */
  row: number
  message: string
}

export interface ParseResult {
  questions: ParsedQuestion[]
  errors: ParseError[]
}

export const ACCEPTED_FILES = '.xlsx,.xls,.ods,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv'

const LETTERS = ['A', 'B', 'C', 'D']

const HEADERS = [
  'Kategória',
  'Otázka',
  'Odpoveď A',
  'Odpoveď B',
  'Odpoveď C',
  'Odpoveď D',
  'Správna',
  'Čas (s)',
  'Body',
  'Obrázok (URL)',
  'Vysvetlenie',
]

const COL_WIDTHS = [18, 60, 26, 26, 26, 26, 10, 9, 8, 40, 60]

type Field = 'category' | 'text' | 'a' | 'b' | 'c' | 'd' | 'correct' | 'time' | 'points' | 'image' | 'explanation'

function answerAliases(letter: string, n: number): string[] {
  return [
    letter,
    `odpoved ${letter}`,
    `odpoved ${n}`,
    `odpovede ${letter}`,
    `moznost ${letter}`,
    `moznost ${n}`,
    `answer ${letter}`,
    `answer ${n}`,
    `option ${letter}`,
    `option ${n}`,
    `${letter} odpoved`,
  ]
}

// kľúče sú už normalizované (bez diakritiky, malými písmenami)
const ALIASES: Record<Field, string[]> = {
  category: ['kategoria', 'kategorie', 'category', 'tema', 'predmet', 'oblast', 'okruh'],
  text: ['otazka', 'otazky', 'question', 'text', 'text otazky', 'znenie', 'znenie otazky', 'zadanie'],
  a: answerAliases('a', 1),
  b: answerAliases('b', 2),
  c: answerAliases('c', 3),
  d: answerAliases('d', 4),
  correct: [
    'spravna',
    'spravna odpoved',
    'spravne',
    'spravna moznost',
    'odpoved spravna',
    'riesenie',
    'correct',
    'correct answer',
    'answer',
    'spravna a d',
  ],
  time: [
    'cas',
    'cas s',
    'cas sek',
    'cas sekundy',
    'cas v sekundach',
    'cas na odpoved',
    'casovy limit',
    'casovy limit s',
    'limit',
    'sekundy',
    'time',
    'time s',
    'time limit',
  ],
  points: ['body', 'pocet bodov', 'bodovanie', 'points', 'score'],
  image: ['obrazok', 'obrazok url', 'obrazek', 'obrazek url', 'url obrazka', 'image', 'image url', 'foto', 'url'],
  explanation: ['vysvetlenie', 'vysvetleni', 'vysvetlenie odpovede', 'zdovodnenie', 'poznamka', 'explanation', 'reason'],
}

function fieldFor(header: string): Field | null {
  const key = normalizeKey(header)
  if (!key) return null
  for (const f of Object.keys(ALIASES) as Field[]) {
    if (ALIASES[f].includes(key)) return f
  }
  return null
}

type Columns = Partial<Record<Field, number>>

function detectColumns(row: string[]): Columns {
  const cols: Columns = {}
  row.forEach((cell, i) => {
    const f = fieldFor(cell)
    if (f && cols[f] === undefined) cols[f] = i
  })
  return cols
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  return String(v).replace(/\r\n?/g, '\n').trim()
}

function parseCorrect(raw: string, answers: string[]): number | 'empty' | 'invalid' {
  const v = raw.trim()
  if (!v) return 'empty'
  const letter = /^([a-d])[).:]?$/i.exec(v)
  if (letter) return letter[1].toUpperCase().charCodeAt(0) - 65
  const num = /^([1-4])(?:[.,]0+)?$/.exec(v)
  if (num) return Number(num[1]) - 1
  const lower = v.toLowerCase()
  const byText = answers.findIndex((a) => a && a.toLowerCase() === lower)
  return byText >= 0 ? byText : 'invalid'
}

function snapTime(n: number): number {
  return TIME_LIMITS.reduce((best, t) => (Math.abs(t - n) < Math.abs(best - n) ? t : best), TIME_LIMITS[0])
}

function parseTime(raw: string): number | null {
  const v = raw.trim().toLowerCase()
  if (!v) return DEFAULT_TIME
  const mmss = /^(\d{1,2}):(\d{1,2})$/.exec(v)
  if (mmss) return snapTime(Number(mmss[1]) * 60 + Number(mmss[2]))
  const num = /^(\d+(?:[.,]\d+)?)\s*(s|sek|sek\.|sekund|sekúnd|sekundy|sec|min|minúta|minúty|minút)?$/.exec(v)
  if (!num) return null
  let n = Number(num[1].replace(',', '.'))
  if (num[2]?.startsWith('min')) n *= 60
  return Number.isFinite(n) ? snapTime(n) : null
}

function parsePoints(raw: string): PointsMode | null {
  const trimmed = raw.trim()
  if (!trimmed) return DEFAULT_POINTS
  // číslo, aj v tvare „1.00“ alebo „2 000“
  const n = Number(trimmed.replace(/\s/g, '').replace(',', '.'))
  if (Number.isFinite(n)) {
    if (n === 1 || n === 1000) return 1000
    if (n === 2 || n === 2000) return 2000
    if (n === 0) return 0
    return null
  }
  const v = normalizeKey(trimmed).replace(/ /g, '')
  if (['1', '1x', 'x1', '1000', 'standardne', 'standardny', 'standard', 'normalne', 'normal'].includes(v)) return 1000
  if (['2', '2x', 'x2', '2000', 'dvojnasobne', 'dvojnasobny', 'dvojite', 'double'].includes(v)) return 2000
  if (['0', '0x', 'x0', 'bez', 'bezbodov', 'ziadne', 'nie', 'none'].includes(v)) return 0
  return null
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s)
}

/** Spracuje riadky tabuľky (prvý riadok s hlavičkou sa nájde automaticky). */
export function parseRows(rows: unknown[][], firstRowNumber = 1): ParseResult {
  const table = rows.map((r) => (Array.isArray(r) ? r.map(cellText) : []))
  let headerIdx = -1
  let cols: Columns = {}
  for (let i = 0; i < Math.min(table.length, 20); i++) {
    const c = detectColumns(table[i])
    if (c.text !== undefined && (c.a !== undefined || c.b !== undefined)) {
      headerIdx = i
      cols = c
      break
    }
  }
  if (headerIdx < 0) {
    throw new Error(
      'V súbore sa nenašla hlavička so stĺpcami „Otázka“, „Odpoveď A“, „Odpoveď B“… Stiahni si šablónu a dodrž jej stĺpce.',
    )
  }
  if (cols.a === undefined || cols.b === undefined) {
    throw new Error('V súbore chýba stĺpec „Odpoveď A“ alebo „Odpoveď B“.')
  }
  if (cols.correct === undefined) {
    throw new Error('V súbore chýba stĺpec „Správna“ (písmeno správnej odpovede A – D).')
  }

  const questions: ParsedQuestion[] = []
  const errors: ParseError[] = []
  const answerCols = [cols.a, cols.b, cols.c, cols.d]
  const get = (row: string[], col: number | undefined) => (col === undefined ? '' : (row[col] ?? ''))

  for (let i = headerIdx + 1; i < table.length; i++) {
    const row = table[i]
    const rowNumber = firstRowNumber + i
    if (row.every((c) => !c)) continue
    const fail = (message: string) => errors.push({ row: rowNumber, message })

    const text = get(row, cols.text).replace(/\s*\n\s*/g, ' ')
    if (!text) {
      fail('Chýba text otázky.')
      continue
    }
    if (text.length > MAX_QUESTION) {
      fail(`Otázka je dlhšia ako ${MAX_QUESTION} znakov (${text.length}).`)
      continue
    }

    const slots = answerCols.map((col) => get(row, col).replace(/\s*\n\s*/g, ' '))
    const tooLong = slots.findIndex((a) => a.length > MAX_ANSWER)
    if (tooLong >= 0) {
      fail(`Odpoveď ${LETTERS[tooLong]} je dlhšia ako ${MAX_ANSWER} znakov.`)
      continue
    }
    const filled = slots.map((a, idx) => ({ a, idx })).filter((s) => s.a)
    if (filled.length < MIN_ANSWERS) {
      fail('Otázka musí mať aspoň 2 vyplnené odpovede.')
      continue
    }

    const correctRaw = get(row, cols.correct)
    const correct = parseCorrect(correctRaw, slots)
    if (correct === 'empty') {
      fail('Chýba správna odpoveď (A, B, C alebo D).')
      continue
    }
    if (correct === 'invalid') {
      fail(`Neplatná správna odpoveď „${correctRaw}“ – použi A, B, C alebo D.`)
      continue
    }
    if (!slots[correct]) {
      fail(`Správna odpoveď je ${LETTERS[correct]}, ale táto odpoveď je prázdna.`)
      continue
    }

    const timeRaw = get(row, cols.time)
    const time = parseTime(timeRaw)
    if (time === null) {
      fail(`Neplatný čas „${timeRaw}“ – zadaj počet sekúnd (5 – 240).`)
      continue
    }

    const pointsRaw = get(row, cols.points)
    const points = parsePoints(pointsRaw)
    if (points === null) {
      fail(`Neplatná hodnota bodov „${pointsRaw}“ – použi 1 (štandardné), 2 (dvojnásobné) alebo 0 (bez bodov).`)
      continue
    }

    const image = get(row, cols.image)
    if (image && !isHttpUrl(image)) {
      fail('Obrázok musí byť verejná webová adresa začínajúca na http:// alebo https://.')
      continue
    }

    const explanation = get(row, cols.explanation)
    if (explanation.length > MAX_EXPLANATION) {
      fail(`Vysvetlenie je dlhšie ako ${MAX_EXPLANATION} znakov (${explanation.length}).`)
      continue
    }

    // odpovede bez medzier (napr. prázdne C a vyplnené D → D sa posunie na miesto C)
    questions.push({
      category: get(row, cols.category).replace(/\s+/g, ' ').slice(0, MAX_CATEGORY),
      text,
      image_url: image || null,
      answers: filled.slice(0, MAX_ANSWERS).map((s) => s.a),
      correct: filled.findIndex((s) => s.idx === correct),
      time_limit: time,
      points,
      explanation,
    })
  }
  return { questions, errors }
}

// ---------------------------------------------------------------------------
// CSV (vlastný parser – nepotrebuje SheetJS)
// ---------------------------------------------------------------------------

function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, Math.max(0, text.indexOf('\n')) || text.length)
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 }
  let quoted = false
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && ch in counts) counts[ch]++
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return best[1] > 0 ? best[0] : ','
}

export function parseCsv(text: string): string[][] {
  const delim = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === delim) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    // Excel na Windows ukladá CSV v kódovaní windows-1250
    return new TextDecoder('windows-1250').decode(buf)
  }
}

// ---------------------------------------------------------------------------
// Načítanie súboru
// ---------------------------------------------------------------------------

export async function parseQuestionsFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase()
  const buf = await file.arrayBuffer()
  if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv') {
    return parseRows(parseCsv(decodeText(buf)))
  }
  if (!/\.(xlsx|xlsm|xls|ods)$/.test(name)) {
    throw new Error('Nepodporovaný typ súboru. Použi Excel (.xlsx, .xls) alebo CSV.')
  }
  const XLSX = await import('xlsx')
  let wb: import('xlsx').WorkBook
  try {
    wb = XLSX.read(buf, { type: 'array' })
  } catch {
    throw new Error('Súbor sa nepodarilo otvoriť. Je to naozaj tabuľka z Excelu?')
  }
  // uprednostni hárok „Otázky“, inak prvý hárok, v ktorom sa nájde hlavička
  const names = [...wb.SheetNames].sort(
    (a, b) => Number(normalizeKey(b) === 'otazky') - Number(normalizeKey(a) === 'otazky'),
  )
  let firstError: unknown = null
  for (const sheetName of names) {
    const ws = wb.Sheets[sheetName]
    if (!ws?.['!ref']) continue
    const range = XLSX.utils.decode_range(ws['!ref'])
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '', blankrows: true })
    try {
      return parseRows(rows, range.s.r + 1)
    } catch (e) {
      firstError ??= e
    }
  }
  throw firstError ?? new Error('Súbor neobsahuje žiadne údaje.')
}

/** Názov súboru bez prípony – návrh názvu kvízu. */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return base || 'Importovaný kvíz'
}

// ---------------------------------------------------------------------------
// Export a šablóna
// ---------------------------------------------------------------------------

function pointsCell(p: PointsMode): number {
  return p === 2000 ? 2 : p === 0 ? 0 : 1
}

function questionRow(q: QuestionData): (string | number)[] {
  return [
    q.category,
    q.text,
    q.answers[0] ?? '',
    q.answers[1] ?? '',
    q.answers[2] ?? '',
    q.answers[3] ?? '',
    LETTERS[q.correct] ?? 'A',
    q.time_limit,
    pointsCell(q.points),
    q.image_url ?? '',
    q.explanation ?? '',
  ]
}

async function questionsSheet(questions: QuestionData[]) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...questions.map(questionRow)])
  ws['!cols'] = COL_WIDTHS.map((wch) => ({ wch }))
  return { XLSX, ws }
}

export async function exportQuizToXlsx(title: string, questions: QuestionData[]): Promise<void> {
  const { XLSX, ws } = await questionsSheet(questions)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Otázky')
  wb.Props = { Title: title }
  XLSX.writeFile(wb, `${slugify(title)}.xlsx`, { compression: true })
}

const SAMPLE: QuestionData[] = [
  {
    category: 'Geografia',
    text: 'Ktorý je najvyšší vrch Slovenska?',
    answers: ['Kriváň', 'Gerlachovský štít', 'Lomnický štít', 'Rysy'],
    correct: 1,
    time_limit: 20,
    points: 1000,
    image_url: null,
    explanation: 'Gerlachovský štít (2 655 m) je najvyšší vrch Slovenska aj celých Karpát.',
  },
  {
    category: 'Príroda',
    text: 'Koľko nôh má pavúk?',
    answers: ['6', '8', '10'],
    correct: 1,
    time_limit: 10,
    points: 1000,
    image_url: null,
    explanation: 'Pavúky patria medzi pavúkovce, nie hmyz – hmyz má 6 nôh.',
  },
  {
    category: 'Šport',
    text: 'Koľko hráčov jedného tímu je naraz na ihrisku vo futbale?',
    answers: ['9', '10', '11', '12'],
    correct: 2,
    time_limit: 20,
    points: 2000,
    image_url: null,
    explanation: '',
  },
  {
    category: 'Príroda',
    text: 'Pravda alebo nepravda: Slnko je hviezda.',
    answers: ['Pravda', 'Nepravda'],
    correct: 0,
    time_limit: 10,
    points: 0,
    image_url: null,
    explanation: 'Slnko je najbližšia hviezda k Zemi.',
  },
]

const GUIDE: string[][] = [
  ['Stĺpec', 'Čo doňho napísať'],
  ['Kategória', 'Nepovinné. Téma otázky, napr. Geografia, Príroda, Šport. Zobrazí sa pri otázke ako farebný štítok.'],
  ['Otázka', 'Povinné. Text otázky (najviac 400 znakov).'],
  ['Odpoveď A, Odpoveď B', 'Povinné. Prvé dve možnosti (najviac 120 znakov).'],
  ['Odpoveď C, Odpoveď D', 'Nepovinné. Ak má otázka len 2 alebo 3 možnosti, nechaj bunky prázdne.'],
  ['Správna', 'Povinné. Písmeno správnej odpovede: A, B, C alebo D.'],
  ['Čas (s)', 'Nepovinné. Čas na odpoveď v sekundách, 5 – 240. Ak je prázdne, použije sa 20 s.'],
  ['Body', 'Nepovinné. 1 = štandardné (do 1 000 bodov), 2 = dvojnásobné (do 2 000 bodov), 0 = bez bodov. Ak je prázdne, použije sa 1.'],
  ['Obrázok (URL)', 'Nepovinné. Verejná webová adresa obrázka (začína https://). Obrázok môžeš pridať aj neskôr v editore.'],
  ['Vysvetlenie', 'Nepovinné. Krátke vysvetlenie správnej odpovede (najviac 300 znakov). Zobrazí sa po odhalení odpovede na projektore aj na mobiloch.'],
  ['', ''],
  ['Tipy', ''],
  ['', 'Každá otázka = jeden riadok. Prvý riadok s názvami stĺpcov nemeň.'],
  ['', 'Vzorové otázky na hárku „Otázky“ prepíš alebo zmaž.'],
  ['', 'Za správnu odpoveď dostane tím 500 – 1 000 bodov – čím rýchlejšie odpovie, tým viac.'],
  ['', 'Hotový súbor nahraj v Kvízovke tlačidlom „Importovať z Excelu“.'],
]

export async function downloadTemplate(): Promise<void> {
  const { XLSX, ws } = await questionsSheet(SAMPLE)
  const guide = XLSX.utils.aoa_to_sheet(GUIDE)
  guide['!cols'] = [{ wch: 24 }, { wch: 110 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Otázky')
  XLSX.utils.book_append_sheet(wb, guide, 'Návod')
  XLSX.writeFile(wb, 'kvizovka-sablona.xlsx', { compression: true })
}
