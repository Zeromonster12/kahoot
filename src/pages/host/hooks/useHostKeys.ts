import { useEffect, useRef } from 'react'

interface Handlers {
  /** hlavná akcia aktuálnej obrazovky (Spustiť / Ďalej), null ak žiadna nie je */
  primary: (() => void) | null
  fullscreen: () => void
}

/**
 * Klávesové skratky pre projektor / prezentér:
 * medzerník, Enter, šípka doprava, PageDown = hlavná akcia; F = celá obrazovka.
 */
export function useHostKeys(handlers: Handlers) {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return
      if (document.querySelector('[aria-modal="true"]')) return
      const el = e.target instanceof HTMLElement ? e.target : null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return

      const activation = e.key === ' ' || e.key === 'Enter'
      // tlačidlo s fokusom (ovládanie klávesnicou) sa aktivuje samo
      if (activation && el?.closest('button, a, [role="button"]')) return

      if (activation || e.key === 'ArrowRight' || e.key === 'PageDown') {
        const action = ref.current.primary
        if (action) {
          e.preventDefault()
          action()
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        ref.current.fullscreen()
      }
    }

    // po kliknutí myšou zruš fokus tlačidla, aby medzerník ďalej ovládal hru
    const onClick = (e: MouseEvent) => {
      if (e.detail === 0 || !(e.target instanceof Element)) return
      const button = e.target.closest('button')
      if (button && document.activeElement === button) button.blur()
    }

    window.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
    }
  }, [])
}
