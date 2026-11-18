import { useRouteError } from 'react-router-dom'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { Button } from '../../../components/ui/Button/Button'
import { NexoonCredit } from '../../../components/brand/NexoonCredit/NexoonCredit'
import { env } from '../../../config/env'
import './RouteErrorPage.css'

/**
 * Se muestra si una pantalla falla al dibujarse (error de programación).
 * Evita la pantalla en blanco: el usuario ve qué pasó y puede recargar.
 */
export default function RouteErrorPage() {
  const error = useRouteError()

  // El detalle técnico solo se registra en desarrollo
  if (env.isDevelopment) console.error(error)

  return (
    <div className="route-error-page">
      <StatusMessage
        icon={TriangleAlert}
        tone="danger"
        title="Algo salió mal"
        description="Ocurrió un error inesperado al mostrar esta pantalla. Recarga la página; si el problema continúa, contacta al administrador."
      >
        <Button icon={RefreshCw} onClick={() => window.location.reload()}>
          Recargar la página
        </Button>
      </StatusMessage>
      <div className="route-error-page__credit">
        <NexoonCredit />
      </div>
    </div>
  )
}
