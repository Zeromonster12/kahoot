import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence } from 'motion/react'
import { Download, FileSpreadsheet, Plus } from 'lucide-react'
import { AnswerShape } from '../../components/AnswerShape'
import { Button } from '../../components/Button'
import { createGame } from '../../lib/api'
import { ANSWER_STYLES, pluralQuestions } from '../../lib/theme'
import { AdminHeader } from './components/AdminHeader'
import { useConfirm } from './components/ConfirmDialog'
import { ImportDialog } from './components/ImportDialog'
import { QuizCard, QuizCardSkeleton } from './components/QuizCard'
import { RecentGames, isRunning } from './components/RecentGames'
import { ErrorState, InlineError } from './components/States'
import { Toaster, toast } from './components/Toast'
import {
  createQuiz,
  deleteGame,
  deleteQuiz,
  duplicateQuiz,
  getQuestions,
  listQuizzes,
  listRecentGames,
  type GameSummary,
  type QuizSummary,
} from './data'
import {
  ACCEPTED_FILES,
  downloadTemplate,
  exportQuizToXlsx,
  parseQuestionsFile,
  titleFromFileName,
  type ParseResult,
} from './excel'
import { fromQuestion } from './model'
import { errorMessage } from './utils'

interface ImportState {
  fileName: string
  result: ParseResult
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [confirm, confirmDialog] = useConfirm()

  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null)
  const [quizError, setQuizError] = useState<string | null>(null)
  const [games, setGames] = useState<GameSummary[] | null>(null)
  const [gamesError, setGamesError] = useState<string | null>(null)
  const [gamesLoading, setGamesLoading] = useState(false)

  const [creating, setCreating] = useState(false)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [busyQuizId, setBusyQuizId] = useState<string | null>(null)
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null)
  const [templateBusy, setTemplateBusy] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [importState, setImportState] = useState<ImportState | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadQuizzes = useCallback(async () => {
    setQuizError(null)
    try {
      setQuizzes(await listQuizzes())
    } catch (e) {
      setQuizError(errorMessage(e))
    }
  }, [])

  const loadGames = useCallback(async () => {
    setGamesError(null)
    setGamesLoading(true)
    try {
      setGames(await listRecentGames(15))
    } catch (e) {
      setGamesError(errorMessage(e))
    } finally {
      setGamesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadQuizzes()
    void loadGames()
  }, [loadQuizzes, loadGames])

  async function onCreate() {
    setCreating(true)
    try {
      const id = await createQuiz('Nový kvíz')
      navigate(`/admin/quiz/${id}`, { state: { isNew: true } })
    } catch (e) {
      toast.error(`Kvíz sa nepodarilo vytvoriť. ${errorMessage(e)}`)
      setCreating(false)
    }
  }

  async function onStart(quiz: QuizSummary) {
    setStartingId(quiz.id)
    try {
      const gameId = await createGame(quiz.id)
      navigate(`/host/${gameId}`)
    } catch (e) {
      toast.error(`Hru sa nepodarilo spustiť. ${errorMessage(e)}`)
      setStartingId(null)
    }
  }

  async function onDuplicate(quiz: QuizSummary) {
    setBusyQuizId(quiz.id)
    try {
      await duplicateQuiz(quiz.id)
      await loadQuizzes()
      toast.success(`Kópia kvízu „${quiz.title}“ je hotová.`)
    } catch (e) {
      toast.error(`Kvíz sa nepodarilo skopírovať. ${errorMessage(e)}`)
    } finally {
      setBusyQuizId(null)
    }
  }

  async function onExport(quiz: QuizSummary) {
    setBusyQuizId(quiz.id)
    try {
      const questions = await getQuestions(quiz.id)
      if (!questions.length) {
        toast.info('Kvíz nemá žiadne otázky na export.')
        return
      }
      await exportQuizToXlsx(quiz.title, questions.map(fromQuestion))
    } catch (e) {
      toast.error(`Export sa nepodaril. ${errorMessage(e)}`)
    } finally {
      setBusyQuizId(null)
    }
  }

  async function onDelete(quiz: QuizSummary) {
    const ok = await confirm({
      title: `Zmazať kvíz „${quiz.title}“?`,
      message: (
        <>
          {quiz.questionCount > 0
            ? `Kvíz a jeho ${pluralQuestions(quiz.questionCount)} sa natrvalo odstránia.`
            : 'Kvíz sa natrvalo odstráni.'}{' '}
          Výsledky už odohraných hier zostanú zachované.
        </>
      ),
      confirmLabel: 'Zmazať kvíz',
      danger: true,
    })
    if (!ok) return
    setBusyQuizId(quiz.id)
    try {
      await deleteQuiz(quiz.id)
      setQuizzes((list) => list?.filter((q) => q.id !== quiz.id) ?? null)
      toast.success('Kvíz bol zmazaný.')
    } catch (e) {
      toast.error(`Kvíz sa nepodarilo zmazať. ${errorMessage(e)}`)
    } finally {
      setBusyQuizId(null)
    }
  }

  async function onDeleteGame(game: GameSummary) {
    const running = game.status !== 'finished'
    const ok = await confirm({
      title: 'Zmazať hru?',
      message: (
        <>
          Hra <b className="text-ink">{game.quiz_title}</b> (PIN {game.pin}) sa zmaže aj s tímami a ich odpoveďami.
          {running && (
            <span className="mt-2 block font-semibold text-ans-red">
              Hra ešte {isRunning(game.status) ? 'prebieha' : 'čaká na tímy'} – pripojené tímy budú odpojené.
            </span>
          )}
        </>
      ),
      confirmLabel: 'Zmazať hru',
      danger: true,
    })
    if (!ok) return
    setDeletingGameId(game.id)
    try {
      await deleteGame(game.id)
      setGames((list) => list?.filter((g) => g.id !== game.id) ?? null)
      toast.success('Hra bola zmazaná.')
    } catch (e) {
      toast.error(`Hru sa nepodarilo zmazať. ${errorMessage(e)}`)
    } finally {
      setDeletingGameId(null)
    }
  }

  async function onTemplate() {
    setTemplateBusy(true)
    try {
      await downloadTemplate()
    } catch (e) {
      toast.error(`Šablónu sa nepodarilo vytvoriť. ${errorMessage(e)}`)
    } finally {
      setTemplateBusy(false)
    }
  }

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

  async function onImportConfirm({ title }: { title: string }) {
    if (!importState) return
    setImportBusy(true)
    try {
      const n = importState.result.questions.length
      const id = await createQuiz(title, '', importState.result.questions)
      toast.success(`Kvíz „${title}“ bol vytvorený (${pluralQuestions(n)}).`)
      navigate(`/admin/quiz/${id}`)
    } catch (e) {
      toast.error(`Import sa nepodaril. ${errorMessage(e)}`)
      setImportBusy(false)
    }
  }

  const importFile = () => fileRef.current?.click()

  return (
    <div className="min-h-dvh bg-gray-50">
      <AdminHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Moje kvízy</h1>
            <p className="mt-1 text-gray-500">
              {quizzes && quizzes.length > 0
                ? `${quizzes.length} ${quizzes.length === 1 ? 'kvíz' : quizzes.length < 5 ? 'kvízy' : 'kvízov'} – vyber, ktorý chceš upraviť alebo spustiť.`
                : 'Priprav si kvíz a spusti ho na projektore.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={onTemplate}
              loading={templateBusy}
              icon={<Download className="size-5" />}
              title="Excel so vzorovými otázkami a návodom"
            >
              Stiahnuť šablónu
            </Button>
            <Button variant="outline" onClick={importFile} loading={parsing} icon={<FileSpreadsheet className="size-5" />}>
              Importovať z Excelu
            </Button>
            <Button variant="brand" onClick={onCreate} loading={creating} icon={<Plus className="size-5" />}>
              Nový kvíz
            </Button>
          </div>
        </div>

        <section aria-label="Zoznam kvízov" className="mt-6">
          {quizError && quizzes && <InlineError message={quizError} onRetry={loadQuizzes} />}
          {quizError && !quizzes ? (
            <ErrorState message={quizError} onRetry={loadQuizzes} />
          ) : !quizzes ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <QuizCardSkeleton key={i} />
              ))}
            </div>
          ) : quizzes.length === 0 ? (
            <EmptyQuizzes onCreate={onCreate} onImport={importFile} onTemplate={onTemplate} creating={creating} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence initial={false}>
                {quizzes.map((q) => (
                  <QuizCard
                    key={q.id}
                    quiz={q}
                    starting={startingId === q.id}
                    busy={busyQuizId === q.id}
                    onStart={() => onStart(q)}
                    onDuplicate={() => onDuplicate(q)}
                    onExport={() => onExport(q)}
                    onDelete={() => onDelete(q)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        <RecentGames
          games={games}
          error={gamesError}
          loading={gamesLoading}
          deletingId={deletingGameId}
          onRetry={loadGames}
          onDelete={onDeleteGame}
        />
      </main>

      <input ref={fileRef} type="file" accept={ACCEPTED_FILES} className="hidden" onChange={onFile} />
      <ImportDialog
        open={importOpen}
        fileName={importState?.fileName ?? ''}
        result={importState?.result ?? null}
        target="create"
        initialTitle={importState ? titleFromFileName(importState.fileName) : ''}
        busy={importBusy}
        onConfirm={onImportConfirm}
        onClose={() => setImportOpen(false)}
      />
      {confirmDialog}
      <Toaster />
    </div>
  )
}

function EmptyQuizzes({
  onCreate,
  onImport,
  onTemplate,
  creating,
}: {
  onCreate: () => void
  onImport: () => void
  onTemplate: () => void
  creating: boolean
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-brand-200 bg-white px-6 py-14 text-center">
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
      <h2 className="text-2xl font-black">Zatiaľ nemáš žiadny kvíz</h2>
      <p className="mt-2 max-w-md text-gray-600">
        Vytvor prvý kvíz priamo tu, alebo si stiahni šablónu, vyplň otázky v Exceli a naimportuj ich.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button variant="brand" size="lg" onClick={onCreate} loading={creating} icon={<Plus className="size-5" />}>
          Vytvoriť kvíz
        </Button>
        <Button variant="outline" size="lg" onClick={onImport} icon={<FileSpreadsheet className="size-5" />}>
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
    </div>
  )
}
