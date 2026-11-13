import { IMAGE_BUCKET, supabase } from '../../lib/supabase'
import { errorMessage, uuid } from './utils'

const MAX_SIDE = 1600
const MAX_BYTES = 5 * 1024 * 1024
const QUALITY = 0.85
const KEEP_AS_IS = ['image/jpeg', 'image/png', 'image/webp']

interface Prepared {
  blob: Blob
  type: string
  ext: string
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Tento obrázok sa nedá načítať. Použi formát JPG, PNG, WebP alebo GIF.'))
    }
    img.src = url
  })
}

function render(img: HTMLImageElement, width: number, height: number, type: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  if (type === 'image/jpeg') {
    // JPEG nemá priehľadnosť – pozadie bude biele, nie čierne
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
}

/** Zmenší obrázok (dlhšia strana ≤ 1600 px) a prekonvertuje na WebP (záložne JPEG). GIF ostáva bez zmeny. */
export async function prepareImage(file: File): Promise<Prepared> {
  if (file.type === 'image/gif') return { blob: file, type: 'image/gif', ext: 'gif' }
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Vybraný súbor nie je obrázok.')
  }
  const img = await loadImage(file)
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) throw new Error('Obrázok je prázdny alebo poškodený.')
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h))
  const width = Math.max(1, Math.round(w * scale))
  const height = Math.max(1, Math.round(h * scale))

  let out: Prepared | null = null
  const webp = await render(img, width, height, 'image/webp')
  if (webp && webp.type === 'image/webp') out = { blob: webp, type: 'image/webp', ext: 'webp' }
  else {
    const jpeg = await render(img, width, height, 'image/jpeg')
    if (jpeg && jpeg.type === 'image/jpeg') out = { blob: jpeg, type: 'image/jpeg', ext: 'jpg' }
  }
  // malý obrázok, ktorý netreba zmenšovať, necháme v pôvodnej podobe, ak je menší
  const original = KEEP_AS_IS.includes(file.type) && scale === 1
  if (original && (!out || file.size <= out.blob.size)) {
    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
    return { blob: file, type: file.type, ext }
  }
  if (!out) throw new Error('Obrázok sa nepodarilo spracovať. Skús iný súbor.')
  return out
}

/** Nahrá obrázok do úložiska a vráti jeho verejnú adresu. */
export async function uploadQuestionImage(quizId: string, file: File): Promise<string> {
  const img = await prepareImage(file)
  if (img.blob.size > MAX_BYTES) {
    throw new Error('Obrázok je príliš veľký ani po zmenšení (max. 5 MB). Skús iný.')
  }
  const path = `${quizId}/${uuid()}.${img.ext}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, img.blob, {
    contentType: img.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(errorMessage(error))
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Verejná https adresa obrázka? (http nie – na mobiloch žiakov by šlo o nešifrovaný obsah; DB ho odmietne) */
export function isImageUrl(s: string): boolean {
  try {
    const u = new URL(s.trim())
    return u.protocol === 'https:'
  } catch {
    return false
  }
}
