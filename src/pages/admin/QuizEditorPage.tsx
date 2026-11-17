import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, CircleAlert, Download, FileSpreadsheet, Plus, SearchX, X } from 'lucide-react'
import { AnswerShape } from '../../components/AnswerShape'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'
import { createGame } from '../../lib/api'
import { ANSWER_STYLES, pluralQuestions } from '../../lib/theme'
import { useConfirm } from './components/ConfirmDialog'
import { ImportDialog, type ImportMode } from './components/ImportDialog'
import { ErrorState } from './components/States'
import { Toaster, toast } from './components/Toast'
import { getQuestions, getQuiz, saveQuiz } from './data'
import { EditorTopBar, type SaveState } from './editor/EditorTopBar'
import { LeaveDialog, QuizSettingsDialog } from './editor/EditorDialogs'
import { QuestionEditor } from './editor/QuestionEditor'
import { QuestionList } from './editor/QuestionList'
import { QuestionSettings } from './editor/QuestionSettings'
import { ACCEPTED_FILES, downloadTemplate, exportQuizToXlsx, parseQuestionsFile, type ParseResult } from './excel'
import {
  fromQuestion,
  groupByCategory,
  isBlank,
  newQuestion,
  newSlide,
  snapshot,
  type GroupOptions,
  uniqueCategories,
  validateQuestion,
  type DraftQuestion,
  type QuestionIssues,
} from './model'
import { errorMessage, isUuid, uuid } from './utils'

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'notfound' } | { kind: 'error'; message: string }

const MAX_LISTED_ISSUES = 6

export default function QuizEditorPage() {
  const { quizId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isNew = (location.state as { isNew?: boolean } | null)?.isNew === true
  const [confirm, confirmDialog] = useConfirm()

  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<DraftQuestion[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** otázka, do ktorej sa má po zobrazení presunúť kurzor (nová otázka) */
  const [focusId, setFocusId] = useState<string | null>(null)
  const [savedSnap, setSavedSnap] = useState('')
  /** id otázok, ktoré môžu byť v databáze – pri ukladaní sa zmažú tie, čo v editore chýbajú */
  const knownIds = useRef(new Set<string>())

  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [starting, setStarting] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [importState, setImportState] = useState<{ fileName: string; result: ParseResult } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const questionsRef = useRef(questions)
  const selectedIdRef = useRef(selectedId)
  useLayoutEffect(() => {
    questionsRef.current = questions
    selectedIdRef.current = selectedId
  })

  // ---------------------------------------------------------------- načítanie

  const load = useCallback(async () => {
    if (!isUuid(quizId)) {
      setStatus({ kind: 'notfound' })
      return
    }
    setStatus({ kind: 'loading' })
    try {
      const [quiz, rows] = await Promise.all([getQuiz(quizId), getQuestions(quizId)])
      if (!quiz) {
        setStatus({ kind: 'notfound' })
        return
      }
      const drafts = rows.map(fromQuestion)
      setTitle(quiz.title)
      setDescription(quiz.description ?? '')
      setQuestions(drafts)
      setSelectedId(drafts[0]?.id ?? null)
      setFocusId(null)
      setSavedSnap(snapshot(quiz.title, quiz.description ?? '', drafts))
      knownIds.current = new Set(drafts.map((q) => q.id))
      setShowErrors(false)
      setStatus({ kind: 'ready' })
    } catch (e) {
      setStatus({ kind: 'error', message: errorMessage(e) })
    }
  }, [quizId])

  useEffect(() => {
    void load()
  }, [load])

  // nový kvíz – rovno označ názov, aby ho učiteľ mohol prepísať
  useEffect(() => {
    if (status.kind === 'ready' && isNew) titleRef.current?.select()
  }, [status.kind, isNew])

  // ---------------------------------------------------------------- odvodené hodnoty

  const issues = useMemo(() => {
    const map = new Map<string, QuestionIssues>()
    for (const q of questions) {
      const v = validateQuestion(q)
      if (v) map.set(q.id, v)
    }
    return map
  }, [questions])
  const invalidIds = useMemo(() => new Set(issues.keys()), [issues])
  const categories = useMemo(() => uniqueCategories(questions), [questions])
  const currentSnap = useMemo(() => snapshot(title, description, questions), [title, description, questions])
  const dirty = status.kind === 'ready' && currentSnap !== savedSnap
  const titleMissing = !title.trim()
  const selectedIndex = Math.max(0, questions.findIndex((q) => q.id === selectedId))
  const selected = questions[selectedIndex] ?? null
  const saveState: SaveState = saving ? 'saving' : dirty ? 'dirty' : 'saved'

  // ---------------------------------------------------------------- úpravy otázok

  const updateQuestion = useCallback((id: string, fn: (q: DraftQuestion) => DraftQuestion) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? fn(q) : q)))
  }, [])

  const selectQuestion = useCallback((id: string) => {
    setSelectedId(id)
    setFocusId(null)
  }, [])

  const moveQuestion = useCallback((from: number, to: number) => {
    setQuestions((qs) => {
      if (from === to || to < 0 || to >= qs.length || from < 0 || from >= qs.length) return qs
      const next = [...qs]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  const addQuestion = useCallback(() => {
    const qs = questionsRef.current
    const q = newQuestion(qs[qs.length - 1])
    setQuestions((prev) => [...prev, q])
    setSelectedId(q.id)
    setFocusId(q.id)
  }, [])

  // snímka sa vloží za práve vybranú položku (napr. úvod pred ďalšiu kategóriu sa potom len posunie)
  const addSlide = useCallback(() => {
    const slide = newSlide()
    setQuestions((prev) => {
      const i = prev.findIndex((q) => q.id === selectedIdRef.current)
      if (i < 0) return [...prev, slide]
      const next = [...prev]
      next.splice(i + 1, 0, slide)
      return next
    })
    setSelectedId(slide.id)
    setFocusId(slide.id)
  }, [])

  const sortByCategory = useCallback((opts: GroupOptions) => {
    const before = questionsRef.current
    const after = groupByCategory(before, opts)
    const added = after.length - before.length
    const moved = added > 0 || after.some((q, i) => q.id !== before[i]?.id)
    if (!moved) {
      toast.info('Položky už sú zoskupené podľa kategórií.')
      return
    }
    setQuestions(after)
    toast.success(
      `Zoskupené podľa kategórií${added > 0 ? ` a pridané úvodné snímky: ${added}` : ''}. Ak sa ti poradie nepáči, kvíz neukladaj – zmeny zahodíš tlačidlom „Moje kvízy“.`,
    )
  }, [])

  const duplicateQuestion = useCallback((id: string) => {
    const source = questionsRef.current.find((q) => q.id === id)
    if (!source) return
    const copy: DraftQuestion = { ...source, id: uuid(), answers: [...source.answers] }
    setQuestions((prev) => {
      const i = prev.findIndex((q) => q.id === id)
      const next = [...prev]
      next.splice(i + 1, 0, copy)
      return next
    })
    setSelectedId(copy.id)
    setFocusId(null)
  }, [])

  const deleteQuestion = useCallback(
    async (id: string) => {
      const qs = questionsRef.current
      const i = qs.findIndex((q) => q.id === id)
      if (i < 0) return
      if (!isBlank(qs[i])) {
        const text = qs[i].text.trim()
        const slide = qs[i].kind === 'slide'
        const ok = await confirm({
          title: slide ? `Zmazať snímku ${i + 1}?` : `Zmazať otázku ${i + 1}?`,
          message: (
            <>
              {text ? (
                <>
                  {slide ? 'Snímka' : 'Otázka'} „{text.length > 80 ? `${text.slice(0, 80)}…` : text}“ sa odstráni z kvízu.{' '}
                </>
              ) : null}
              Zmena sa natrvalo prejaví po uložení kvízu.
            </>
          ),
          confirmLabel: slide ? 'Zmazať snímku' : 'Zmazať otázku',
          danger: true,
        })
        if (!ok) return
      }
      const latest = questionsRef.current
      const idx = latest.findIndex((q) => q.id === id)
      const rest = latest.filter((q) => q.id !== id)
      setQuestions(rest)
      setSelectedId((cur) => (cur === id ? (rest[Math.min(Math.max(idx, 0), rest.length - 1)]?.id ?? null) : cur))
    },
    [confirm],
  )

  // ---------------------------------------------------------------- ukladanie

  const save = useCallback(async (): Promise<boolean> => {
    if (savingRef.current || status.kind !== 'ready') return false
    if (!dirty) return true
    if (titleMissing || issues.size) {
      setShowErrors(true)
      const firstBad = questions.find((q) => issues.has(q.id))
      if (firstBad) {
        setSelectedId(firstBad.id)
        setFocusId(null)
      } else titleRef.current?.focus()
      const parts: string[] = []
      if (titleMissing) parts.push('chýba názov kvízu')
      if (issues.size) {
        const bad = questions.flatMap((q, i) => (issues.has(q.id) ? [{ n: i + 1, slide: q.kind === 'slide' }] : []))
        const what = bad.some((b) => b.slide) ? (bad.length === 1 ? 'neúplná položka' : 'neúplné položky') : bad.length === 1 ? 'neúplná otázka' : 'neúplné otázky'
        parts.push(`${what} ${bad.map((b) => b.n).join(', ')}`)
      }
      toast.error(`Kvíz sa nedá uložiť – ${parts.join(' a ')}.`)
      return false
    }

    savingRef.current = true
    setSaving(true)
    const ids = new Set(questions.map((q) => q.id))
    const removed = [...knownIds.current].filter((id) => !ids.has(id))
    for (const id of ids) knownIds.current.add(id)
    try {
      await saveQuiz(quizId, title, description, questions, removed)
      knownIds.current = ids
      setSavedSnap(snapshot(title, description, questions))
      setShowErrors(false)
      toast.success('Kvíz je uložený.')
      return true
    } catch (e) {
      toast.error(`Kvíz sa nepodarilo uložiť. ${errorMessage(e)}`)
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [status.kind, dirty, titleMissing, issues, questions, quizId, title, description])

  // Ctrl+S / Cmd+S
  const saveRef = useRef(save)
  useLayoutEffect(() => {
    saveRef.current = save
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ochrana pred zatvorením karty s neuloženými zmenami
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  function onBack(e: MouseEvent) {
    if (!dirty) return
    e.preventDefault()
    setLeaveOpen(true)
  }

  async function saveAndLeave() {
    if (await save()) {
      setLeaveOpen(false)
      navigate('/admin')
    } else setLeaveOpen(false)
  }

  const hasQuestion = questions.some((q) => q.kind === 'question')

  async function startGame() {
    if (!hasQuestion) {
      toast.info('Najprv pridaj aspoň jednu otázku – kvíz len so snímkami sa nedá hrať.')
      return
    }
    if (dirty && !(await save())) return
    setStarting(true)
    try {
      const gameId = await createGame(quizId)
      navigate(`/host/${gameId}`)
    } catch (e) {
      toast.error(`Hru sa nepodarilo spustiť. ${errorMessage(e)}`)
      setStarting(false)
    }
  }

  // ---------------------------------------------------------------- import / export

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setParsing(true)
    try {
      const result = await parseQuestionsFile(file)
      setImportState({ fileName: file.name, result })
      setImportOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Súbor sa nepodarilo načítať.')
    } finally {
      setParsing(false)
    }
  }

  function onImportConfirm({ mode }: { mode: ImportMode }) {
    if (!importState) return
    const imported: DraftQuestion[] = importState.result.questions.map((q) => ({ ...q, id: uuid(), answers: [...q.answers] }))
    if (!imported.length) return
    setQuestions((prev) => (mode === 'replace' ? imported : [...prev, ...imported]))
    setSelectedId(imported[0].id)
    setFocusId(null)
    setImportOpen(false)
    toast.success(
      `${mode === 'replace' ? 'Otázky boli nahradené' : 'Pridané'}: ${pluralQuestions(imported.length)}. Nezabudni kvíz uložiť.`,
    )
  }

  async function onExport() {
    if (!questions.length) {
      toast.info('Kvíz nemá žiadne otázky na export.')
      return
    }
    try {
      await exportQuizToXlsx(title.trim() || 'kviz', questions)
    } catch (e) {
      toast.error(`Export sa nepodaril. ${errorMessage(e)}`)
    }
  }

  async function onTemplate() {
    try {
      await downloadTemplate()
    } catch (e) {
      toast.error(`Šablónu sa nepodarilo vytvoriť. ${errorMessage(e)}`)
    }
  }

  const pickFile = () => fileRef.current?.click()

  // ---------------------------------------------------------------- vykreslenie

  if (status.kind !== 'ready') {
    return (
      <div className="flex min-h-dvh flex-col bg-gray-50">
        <header className="flex h-16 items-center border-b border-gray-200 bg-white px-4">
          <Link
            to="/admin"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100"
          >
            <ArrowLeft className="size-5" />
            Moje kvízy
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center p-6">
          {status.kind === 'loading' ? (
            <div className="flex flex-col items-center gap-3 text-brand-700">
              <Spinner className="size-10" />
              <p className="font-semibold text-gray-500">Načítavam kvíz…</p>
            </div>
          ) : status.kind === 'notfound' ? (
            <div className="flex max-w-md flex-col items-center rounded-2xl border border-gray-200 bg-white px-8 py-10 text-center">
              <SearchX className="mb-3 size-12 text-gray-300" />
              <h1 className="text-xl font-extrabold">Kvíz sa nenašiel</h1>
              <p className="mt-1 text-gray-600">Možno bol zmazaný alebo je odkaz nesprávny.</p>
              <Button variant="brand" className="mt-6" onClick={() => navigate('/admin')}>
                Späť na moje kvízy
              </Button>
            </div>
          ) : (
            <ErrorState title="Kvíz sa nepodarilo načítať" message={status.message} onRetry={load} className="w-full max-w-md" />
          )}
        </div>
      </div>
    )
  }

  const showIssues = showErrors && (titleMissing || issues.size > 0)

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50">
      <EditorTopBar
        titleRef={titleRef}
        title={title}
        titleError={showErrors && titleMissing}
        description={description}
        saveState={saveState}
        starting={starting}
        canStart={hasQuestion}
        onTitle={setTitle}
        onBack={onBack}
        onSettings={() => setSettingsOpen(true)}
        onSave={() => void save()}
        onStart={() => void startGame()}
      />

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="flex max-h-[26rem] flex-col border-b border-gray-200 bg-gray-100/70 md:sticky md:top-16 md:h-[calc(100dvh-4rem)] md:max-h-none md:w-72 md:shrink-0 md:border-r md:border-b-0">
          <QuestionList
            questions={questions}
            selectedId={selected?.id ?? null}
            invalidIds={invalidIds}
            showErrors={showErrors}
            importing={parsing}
            onSelect={selectQuestion}
            onMove={moveQuestion}
            onDuplicate={duplicateQuestion}
            onDelete={deleteQuestion}
            onAdd={addQuestion}
            onAddSlide={addSlide}
            onSort={sortByCategory}
            onImport={pickFile}
            onExport={onExport}
          />
        </aside>

        <main className="min-w-0 flex-1">
          <AnimatePresence>
            {showIssues && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <IssuesBanner
                  titleMissing={titleMissing}
                  questions={questions}
                  issues={issues}
                  onTitle={() => titleRef.current?.focus()}
                  onSelect={selectQuestion}
                  onClose={() => setShowErrors(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {selected ? (
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 xl:flex-row xl:items-start">
              <div className="min-w-0 flex-1">
                <QuestionEditor
                  key={selected.id}
                  quizId={quizId}
                  question={selected}
                  // otázky sa číslujú bez snímok, snímka ukazuje poradie medzi všetkými položkami
                  index={
                    selected.kind === 'slide'
                      ? selectedIndex
                      : questions.filter((q) => q.kind === 'question').findIndex((q) => q.id === selected.id)
                  }
                  count={selected.kind === 'slide' ? questions.length : questions.filter((q) => q.kind === 'question').length}
                  categories={categories}
                  issues={showErrors ? (issues.get(selected.id) ?? null) : null}
                  autoFocus={focusId === selected.id}
                  onChange={updateQuestion}
                />
              </div>
              <aside className="rounded-2xl border border-gray-200 bg-white p-5 xl:sticky xl:top-22 xl:w-72 xl:shrink-0">
                <QuestionSettings
                  slide={selected.kind === 'slide'}
                  timeLimit={selected.time_limit}
                  points={selected.points}
                  onTimeLimit={(s) => updateQuestion(selected.id, (q) => ({ ...q, time_limit: s }))}
                  onPoints={(p) => updateQuestion(selected.id, (q) => ({ ...q, points: p }))}
                  onDuplicate={() => duplicateQuestion(selected.id)}
                  onDelete={() => void deleteQuestion(selected.id)}
                />
              </aside>
            </div>
          ) : (
            <EmptyQuiz onAdd={addQuestion} onImport={pickFile} onTemplate={onTemplate} importing={parsing} />
          )}
        </main>
      </div>

      <input ref={fileRef} type="file" accept={ACCEPTED_FILES} className="hidden" onChange={onFile} />
      <ImportDialog
        open={importOpen}
        fileName={importState?.fileName ?? ''}
        result={importState?.result ?? null}
        target="editor"
        existingCount={questions.length}
        onConfirm={onImportConfirm}
        onClose={() => setImportOpen(false)}
      />
      <QuizSettingsDialog
        open={settingsOpen}
        title={title}
        description={description}
        onTitle={setTitle}
        onDescription={setDescription}
        onClose={() => setSettingsOpen(false)}
      />
      <LeaveDialog
        open={leaveOpen}
        saving={saving}
        onSaveAndLeave={() => void saveAndLeave()}
        onDiscard={() => {
          setLeaveOpen(false)
          setSavedSnap(currentSnap)
          navigate('/admin')
        }}
        onClose={() => setLeaveOpen(false)}
      />
      {confirmDialog}
      <Toaster />
    </div>
  )
}

function IssuesBanner({
  titleMissing,
  questions,
  issues,
  onTitle,
  onSelect,
  onClose,
}: {
  titleMissing: boolean
  questions: DraftQuestion[]
  issues: Map<string, QuestionIssues>
  onTitle: () => void
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const bad = questions.flatMap((q, i) => {
    const v = issues.get(q.id)
    return v ? [{ id: q.id, n: i + 1, what: q.kind === 'slide' ? 'Snímka' : 'Otázka', summary: v.summary.join(', ') }] : []
  })
  const rest = bad.length - MAX_LISTED_ISSUES
  return (
    <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-start gap-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-ans-red" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ans-red">Kvíz sa nedá uložiť – doplň chýbajúce údaje:</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {titleMissing && (
              <li>
                <IssueChip onClick={onTitle}>Názov kvízu</IssueChip>
              </li>
            )}
            {bad.slice(0, MAX_LISTED_ISSUES).map((b) => (
              <li key={b.id}>
                <IssueChip onClick={() => onSelect(b.id)}>
                  {b.what} {b.n}: <span className="font-semibold">{b.summary}</span>
                </IssueChip>
              </li>
            ))}
            {rest > 0 && <li className="self-center text-sm font-semibold text-red-700">a ďalšie ({rest})</li>}
          </ul>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-red-400 transition hover:bg-red-100 hover:text-ans-red"
          aria-label="Skryť upozornenie"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}

function IssueChip({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-red-200 bg-white px-3 py-1 text-left text-sm font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100"
    >
      {children}
    </button>
  )
}

function EmptyQuiz({
  onAdd,
  onImport,
  onTemplate,
  importing,
}: {
  onAdd: () => void
  onImport: () => void
  onTemplate: () => void
  importing: boolean
}) {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex w-full max-w-xl flex-col items-center rounded-3xl border-2 border-dashed border-brand-200 bg-white px-6 py-12 text-center"
      >
        <div className="mb-6 grid grid-cols-2 gap-2">
          {ANSWER_STYLES.map((s, i) => (
            <span
              key={s.letter}
              className={`flex size-14 animate-pop-in items-center justify-center rounded-xl ${s.bg} shadow-[inset_0_-4px_0_rgb(0_0_0/0.2)]`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <AnswerShape shape={s.shape} className="size-7" />
            </span>
          ))}
        </div>
        <h2 className="text-2xl font-black">Pridaj prvú otázku</h2>
        <p className="mt-2 max-w-sm text-gray-600">
          Napíš otázku, pridaj 2 až 4 odpovede a označ tú správnu. Otázky môžeš aj naimportovať z Excelu.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button variant="brand" size="lg" onClick={onAdd} icon={<Plus className="size-5" />}>
            Pridať otázku
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onImport}
            loading={importing}
            icon={<FileSpreadsheet className="size-5" />}
          >
            Importovať z Excelu
          </Button>
        </div>
        <button
          type="button"
          onClick={onTemplate}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline"
        >
          <Download className="size-4" />
          Stiahnuť šablónu (Excel)
        </button>
      </motion.div>
    </div>
  )
}
