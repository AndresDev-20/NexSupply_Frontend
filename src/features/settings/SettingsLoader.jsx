import { AlertTriangle, RotateCw } from 'lucide-react'
import { StatusMessage } from '../../components/feedback/StatusMessage/StatusMessage'
import { Button } from '../../components/ui/Button/Button'
import { PageSkeleton } from '../../components/ui/Skeleton/Skeleton'
import './settings.css'

/** Estados de carga y error comunes a las pantallas de configuración. */
export function SettingsLoader({ isLoading, error, onRetry, children }) {
  if (isLoading) {
    return (
      <PageSkeleton variant="form" label="Cargando la configuración…" />
    )
  }
  if (error) {
    return (
      <StatusMessage icon={AlertTriangle} tone="danger" title="No se pudo cargar la configuración" description={error.message}>
        <Button icon={RotateCw} onClick={onRetry}>
          Reintentar
        </Button>
      </StatusMessage>
    )
  }
  return children
}
