import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { X } from 'lucide-react'
import { restoreSession, selectCurrentUser, selectPlan } from '../../../features/auth/authSlice'
import { licenseNotice } from '../../../features/auth/licenseNotice'
import { Alert } from '../../feedback/Alert/Alert'
import './LicenseBanner.css'

// Cada cuánto se vuelve a preguntar el estado de la licencia: si NexCore la cambia (pago,
// suspensión), la pantalla se entera sin recargar. También se actualiza al volver a entrar.
const REFRESH_MS = 30 * 60 * 1000
const DISMISSED_KEY = 'nexsupply.licenseNoticeDismissed'

function readDismissed() {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

/**
 * Aviso de la licencia de NexCore (N2) arriba del contenido: días de prueba, pago pendiente, sin
 * conexión o solo lectura. Los avisos informativos se pueden cerrar (vuelven en otra sesión del
 * navegador); el de solo lectura no, porque explica por qué no se puede registrar nada.
 */
export function LicenseBanner() {
  const dispatch = useDispatch()
  const plan = useSelector(selectPlan)
  const user = useSelector(selectCurrentUser)
  const [dismissed, setDismissed] = useState(readDismissed)
  const notice = licenseNotice(plan?.license, user)
  const enabled = plan?.license?.source === 'nexcore'

  useEffect(() => {
    if (!enabled) return undefined
    const timer = setInterval(() => dispatch(restoreSession()), REFRESH_MS)
    return () => clearInterval(timer)
  }, [dispatch, enabled])

  if (!notice || (notice.dismissible && dismissed === notice.key)) return null

  const dismiss = () => {
    setDismissed(notice.key)
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, notice.key)
    } catch {
      // Sin almacenamiento: vuelve a aparecer al recargar
    }
  }

  return (
    <div className={`license-banner license-banner--${notice.tone}`}>
      <Alert tone={notice.tone} title={notice.title}>
        {notice.message}
      </Alert>
      {notice.dismissible && (
        <button type="button" className="license-banner__close" onClick={dismiss} aria-label="Ocultar este aviso">
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
