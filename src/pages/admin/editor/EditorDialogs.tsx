import { Settings2, TriangleAlert } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Modal } from '../components/Modal'
import { MAX_DESCRIPTION, MAX_TITLE } from '../model'

/** Názov a popis kvízu – zmeny sa prejavia hneď (uložia sa spolu s kvízom). */
export function QuizSettingsDialog({
  open,
  title,
  description,
  onTitle,
  onDescription,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  onTitle: (v: string) => void
  onDescription: (v: string) => void
  onClose: () => void
}) {
  const titleMissing = !title.trim()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nastavenia kvízu"
      icon={
        <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Settings2 className="size-5" />
        </span>
      }
      footer={
        <Button variant="brand" size="sm" onClick={onClose}>
          Hotovo
        </Button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          onClose()
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-gray-700">Názov kvízu</span>
          <input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            maxLength={MAX_TITLE}
            placeholder="Napr. Prírodoveda – 3. ročník"
            className={`h-11 w-full rounded-lg border-2 px-3 font-semibold outline-none transition focus:border-brand-500 ${
              titleMissing ? 'border-red-300' : 'border-gray-200'
            }`}
          />
          {titleMissing && <span className="mt-1 block text-sm font-semibold text-ans-red">Názov kvízu je povinný.</span>}
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between text-sm font-bold text-gray-700">
            Popis <span className="text-xs font-semibold text-gray-400">nepovinný</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => onDescription(e.target.value)}
            maxLength={MAX_DESCRIPTION}
            rows={4}
            placeholder="Pre koho je kvíz, z akého učiva…"
            className="w-full resize-none rounded-lg border-2 border-gray-200 px-3 py-2 outline-none transition focus:border-brand-500"
          />
          <span className="mt-1 block text-xs text-gray-500">Popis vidíš len ty – na karte kvízu v prehľade.</span>
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

/** Upozornenie pri odchode z editora s neuloženými zmenami. */
export function LeaveDialog({
  open,
  saving,
  onSaveAndLeave,
  onDiscard,
  onClose,
}: {
  open: boolean
  saving: boolean
  onSaveAndLeave: () => void
  onDiscard: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={saving}
      size="sm"
      title="Máš neuložené zmeny"
      icon={
        <span className="flex size-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <TriangleAlert className="size-5" />
        </span>
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving} className="mr-auto">
            Zostať
          </Button>
          <Button variant="outline" size="sm" onClick={onDiscard} disabled={saving}>
            <span className="text-ans-red">Zahodiť zmeny</span>
          </Button>
          <Button variant="brand" size="sm" onClick={onSaveAndLeave} loading={saving} data-autofocus>
            Uložiť a odísť
          </Button>
        </>
      }
    >
      <p className="text-[15px] leading-relaxed text-gray-600">
        Ak odídeš bez uloženia, posledné úpravy kvízu sa stratia.
      </p>
    </Modal>
  )
}
