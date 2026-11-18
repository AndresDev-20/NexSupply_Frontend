import { Outlet, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { ArrowLeft, Lock } from 'lucide-react'
import { selectPermissions, selectPlan } from '../features/auth/authSlice'
import { canAccess } from '../hooks/usePermissions'
import { StatusMessage } from '../components/feedback/StatusMessage/StatusMessage'
import { Button } from '../components/ui/Button/Button'
import { ROUTES } from './paths'

/**
 * Protege una pantalla por permiso y funcionalidad del plan. Si alguien escribe
 * la URL sin tener acceso, ve un aviso claro (y el backend igual rechazaría los datos).
 */
export function RequirePermission({ permission, feature }) {
  const permissions = useSelector(selectPermissions)
  const plan = useSelector(selectPlan)
  const navigate = useNavigate()

  if (canAccess({ permission, feature }, { permissions, plan })) return <Outlet />

  const outsidePlan = feature && !plan?.features?.includes(feature)
  return (
    <StatusMessage
      icon={Lock}
      title={outsidePlan ? 'No incluido en tu plan' : 'No tienes acceso a esta sección'}
      description={
        outsidePlan
          ? 'Esta funcionalidad no está incluida en el plan contratado.'
          : 'Si necesitas usarla, pide al administrador que te asigne el permiso.'
      }
    >
      <Button icon={ArrowLeft} onClick={() => navigate(ROUTES.home)}>
        Volver al inicio
      </Button>
    </StatusMessage>
  )
}
