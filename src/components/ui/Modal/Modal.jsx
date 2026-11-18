import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './Modal.css'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Ventana modal accesible.
 * - Se dibuja en document.body (por encima de todo).
 * - El foco queda atrapado dentro mientras está abierta y vuelve al botón que la abrió al cerrarse.
 * - Escape o clic fuera la cierran, salvo mientras `isBusy` (ej. guardando).
 * size: sm | md | lg | xl (xl: formulario con vista previa al lado)
 * icon: ícono del encabezado (ej. UserPlus)
 */
export function Modal({ isOpen, onClose, title, description, children, footer, size = 'md', isBusy = false, icon: Icon }) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const isBusyRef = useRef(isBusy)

  useEffect(() => {
    onCloseRef.current = onClose
    isBusyRef.current = isBusy
  })

  useEffect(() => {
    if (!isOpen) return undefined
    const previouslyFocused = document.activeElement
    const dialog = dialogRef.current

    // Enfoca el primer campo; si no hay, el propio diálogo
    const first = dialog?.querySelector('[data-autofocus]') || dialog?.querySelector(FOCUSABLE)
    ;(first || dialog)?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isBusyRef.current) {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll(FOCUSABLE)]
      if (focusable.length === 0) return
      const firstEl = focusable[0]
      const lastEl = focusable.at(-1)
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault()
        lastEl.focus()
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="modal" onMouseDown={(event) => event.target === event.currentTarget && !isBusy && onClose()}>
      <div
        ref={dialogRef}
        className={`modal__dialog modal__dialog--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="modal__header">
          {Icon && (
            <span className="modal__icon" aria-hidden="true">
              <Icon />
            </span>
          )}
          <div className="modal__heading">
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
            {description && (
              <p className="modal__description" id={descriptionId}>
                {description}
              </p>
            )}
          </div>
          <button type="button" className="modal__close" onClick={onClose} disabled={isBusy} aria-label="Cerrar">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
