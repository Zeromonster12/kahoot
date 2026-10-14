import { useLayoutEffect, useState } from 'react'

// 1 rem = 16 px pri 1920 × 1080; menšie okno (notebook 1366 × 768, projektor 4:3)
// zmenší celé rozhranie rovnomerne, takže sa nič neposúva a nič nepretečie.
const ROOT_FONT_SIZE = 'clamp(9px, min(1.4815vh, 1vw), 40px)'

/**
 * Škáluje rozhranie hosta podľa veľkosti okna (nastaví font-size na <html>,
 * pri odchode zo stránky ho vráti). Vracia aktuálnu veľkosť 1 rem v px.
 */
export function useProjectorScale(): number {
  const [rem, setRem] = useState(16)

  useLayoutEffect(() => {
    const root = document.documentElement
    const previous = root.style.fontSize
    root.style.fontSize = ROOT_FONT_SIZE
    const measure = () => setRem(parseFloat(getComputedStyle(root).fontSize) || 16)
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      root.style.fontSize = previous
    }
  }, [])

  return rem
}
