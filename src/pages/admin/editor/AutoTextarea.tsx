import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

function fit(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/** Textové pole, ktoré rastie podľa obsahu (bez posuvníka). */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AutoTextarea({ value, className = '', rows = 1, ...rest }, ref) {
    const inner = useRef<HTMLTextAreaElement>(null)
    useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement)

    useLayoutEffect(() => {
      if (inner.current) fit(inner.current)
    }, [value])

    // pri zmene šírky (napr. otočenie tabletu) prepočítaj výšku
    useLayoutEffect(() => {
      const el = inner.current
      if (!el) return
      let width = el.clientWidth
      const ro = new ResizeObserver(() => {
        if (el.clientWidth !== width) {
          width = el.clientWidth
          fit(el)
        }
      })
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    return <textarea ref={inner} value={value} rows={rows} className={`resize-none overflow-hidden ${className}`} {...rest} />
  },
)
