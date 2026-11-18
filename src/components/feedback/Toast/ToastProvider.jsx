import { useCallback, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { ToastContext } from './toastContext'
import './Toast.css'

const ICONS = { success: CircleCheck, danger: CircleAlert, info: Info }
const DURATION_MS = 4500

/**
 * Mensajes breves de confirmación ("Usuario creado"). Se apilan arriba a la derecha
 * (abajo en celular) y desaparecen solos. Los lectores de pantalla los anuncian.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

  const show = useCallback(
    (message, tone = 'success') => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-3), { id, message, tone }])
      setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss],
  )

  const api = useMemo(
    () => ({
      success: (message) => show(message, 'success'),
      error: (message) => show(message, 'danger'),
      info: (message) => show(message, 'info'),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone]
          return (
            <div key={toast.id} className={`toast toast--${toast.tone}`}>
              <Icon className="toast__icon" aria-hidden="true" />
              <p className="toast__message">{toast.message}</p>
              <button type="button" className="toast__close" onClick={() => dismiss(toast.id)} aria-label="Cerrar mensaje">
                <X aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
