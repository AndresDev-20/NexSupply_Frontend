import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { welcomeFinished } from '../../../features/auth/authSlice'
import { NexoonCredit } from '../../brand/NexoonCredit/NexoonCredit'
import './WelcomeOverlay.css'

// Duraciones (ms). Con "reducir movimiento" la bienvenida es breve y sin animación.
const HOLD_MS = 1700
const HOLD_REDUCED_MS = 700
const EXIT_MS = 450

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

/**
 * Animación de bienvenida tras un inicio de sesión exitoso.
 * Se dibuja ENCIMA de la aplicación: la navegación ocurre de inmediato por debajo,
 * así la animación no retrasa la carga del sistema.
 */
export function WelcomeOverlay() {
  const dispatch = useDispatch()
  const welcome = useSelector((state) => state.auth.welcome)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (!welcome) return undefined
    const hold = prefersReducedMotion() ? HOLD_REDUCED_MS : HOLD_MS
    const exitTimer = setTimeout(() => setIsExiting(true), hold)
    const endTimer = setTimeout(() => {
      setIsExiting(false)
      dispatch(welcomeFinished())
    }, hold + EXIT_MS)
    return () => {
      clearTimeout(exitTimer)
      clearTimeout(endTimer)
    }
  }, [welcome, dispatch])

  if (!welcome) return null

  const firstName = welcome.fullName.trim().split(/\s+/)[0]

  return (
    <div className={`welcome-overlay${isExiting ? ' welcome-overlay--exiting' : ''}`} role="status" aria-live="polite">
      <div className="welcome-overlay__content">
        <div className="welcome-overlay__badge" aria-hidden="true">
          <span className="welcome-overlay__ring welcome-overlay__ring--1" />
          <span className="welcome-overlay__ring welcome-overlay__ring--2" />
          <span className="welcome-overlay__ring welcome-overlay__ring--3" />
          <svg className="welcome-overlay__check" viewBox="0 0 52 52">
            <circle className="welcome-overlay__check-circle" cx="26" cy="26" r="24" />
            <path className="welcome-overlay__check-mark" d="M15 27 l7 7 l15 -16" />
          </svg>
        </div>
        <p className="welcome-overlay__title">¡Bienvenido, {firstName}!</p>
        <p className="welcome-overlay__subtitle">Preparando tu espacio de trabajo…</p>
      </div>
      <div className="welcome-overlay__credit">
        <NexoonCredit tone="inverse" />
      </div>
    </div>
  )
}
