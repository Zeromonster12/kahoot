import { useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from 'react'
import { ImagePlus, Link2, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Spinner } from '../../../components/Spinner'
import { isImageUrl, uploadQuestionImage } from '../image'
import { toast } from '../components/Toast'
import { errorMessage } from '../utils'

interface Props {
  quizId: string
  value: string | null
  onChange: (url: string | null) => void
}

/** Obrázok k otázke: nahratie (klik / pretiahnutie / vloženie zo schránky) alebo odkaz. */
export function ImagePicker({ quizId, value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)

  async function upload(file: File) {
    if (uploading) return
    setUploading(true)
    try {
      const publicUrl = await uploadQuestionImage(quizId, file)
      setBroken(false)
      onChange(publicUrl)
    } catch (e) {
      // chyby z image.ts sú už po slovensky
      toast.error(`Obrázok sa nepodarilo nahrať. ${e instanceof Error && e.name === 'Error' ? e.message : errorMessage(e)}`)
    } finally {
      setUploading(false)
    }
  }

  function applyUrl(raw: string) {
    const v = raw.trim()
    if (!isImageUrl(v)) {
      setUrlError('Zadaj celú adresu obrázka začínajúcu na https://')
      return
    }
    setUrlError(null)
    setBroken(false)
    setUrl('')
    onChange(v)
  }

  function onSubmitUrl(e: FormEvent) {
    e.preventDefault()
    applyUrl(url)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'))
    if (file) return void upload(file)
    if (e.dataTransfer.files.length) {
      toast.error('Pretiahnutý súbor nie je obrázok.')
      return
    }
    // obrázok pretiahnutý z inej webovej stránky
    const link = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (link) applyUrl(link.split('\n')[0])
  }

  function onDragOver(e: DragEvent) {
    const types = [...e.dataTransfer.types]
    if (types.includes('Files') || types.includes('text/uri-list')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDragOver(true)
    }
  }

  function onPaste(e: ClipboardEvent) {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'))
    if (file) {
      e.preventDefault()
      void upload(file)
    }
  }

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif,image/*"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) void upload(file)
      }}
    />
  )

  if (value) {
    return (
      <div
        className={`group relative mx-auto flex w-full max-w-xl items-center justify-center overflow-hidden rounded-2xl border-2 bg-gray-100 ${
          dragOver ? 'border-brand-500' : 'border-transparent'
        }`}
        onDragOver={onDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onPaste={onPaste}
      >
        {fileInput}
        {broken ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center text-sm font-semibold text-amber-700">
            <TriangleAlert className="size-8" />
            Obrázok sa nepodarilo načítať – skontroluj adresu alebo nahraj iný.
            <span className="max-w-full truncate text-xs font-normal text-gray-500">{value}</span>
          </div>
        ) : (
          <img
            src={value}
            alt="Obrázok k otázke"
            onError={() => setBroken(true)}
            className="max-h-72 w-full object-contain"
          />
        )}
        {uploading && <UploadingOverlay />}
        <div className="absolute right-3 bottom-3 flex gap-2">
          <Button
            variant="white"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            icon={<RefreshCw className="size-4" />}
          >
            Zmeniť
          </Button>
          <Button
            variant="white"
            size="sm"
            onClick={() => {
              setBroken(false)
              onChange(null)
            }}
            disabled={uploading}
            icon={<Trash2 className="size-4 text-ans-red" />}
          >
            <span className="text-ans-red">Odstrániť</span>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      {fileInput}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fileRef.current?.click()
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onPaste={onPaste}
        aria-label="Pridať obrázok – klikni, pretiahni sem súbor alebo vlož zo schránky"
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-7 text-center transition outline-none focus-visible:ring-4 focus-visible:ring-brand-200 ${
          dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-300 bg-white/70 hover:border-brand-300 hover:bg-brand-50/50'
        }`}
      >
        <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <ImagePlus className="size-6" />
        </span>
        <span className="font-bold">Pridať obrázok</span>
        <span className="mt-0.5 text-sm text-gray-500">
          Klikni alebo sem pretiahni súbor (JPG, PNG, WebP, GIF). Môžeš ho aj vložiť cez Ctrl+V.
        </span>
        {uploading && <UploadingOverlay />}
      </div>
      <form onSubmit={onSubmitUrl} className="mt-2 flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Adresa obrázka</span>
          <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setUrlError(null)
            }}
            placeholder="alebo vlož odkaz na obrázok (https://…)"
            className={`h-10 w-full rounded-lg border-2 bg-white pr-3 pl-9 text-sm outline-none transition focus:border-brand-500 ${
              urlError ? 'border-red-300' : 'border-gray-200'
            }`}
          />
        </label>
        <Button type="submit" variant="outline" size="sm" disabled={!url.trim()}>
          Použiť
        </Button>
      </form>
      {urlError && <p className="mt-1 text-sm font-semibold text-ans-red">{urlError}</p>}
    </div>
  )
}

function UploadingOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/85 font-bold text-brand-700">
      <Spinner className="size-8" />
      Nahrávam obrázok…
    </div>
  )
}
