import { useSelector } from 'react-redux'
import { selectCurrentUser } from '../auth/authSlice'
import { useCan } from '../../hooks/usePermissions'

/**
 * Qué puede hacer el usuario con un turno (D-CAJA-10). Solo adapta la interfaz:
 * el backend vuelve a verificar cada acción.
 * - Cerrar y contar: quien responde por el turno con cash.close, u otra persona con cash.close_others.
 * - Recibir: cash.receive, cuando el turno ya se contó.
 */
export function useSessionPermissions() {
  const currentUser = useSelector(selectCurrentUser)
  const canClose = useCan('cash.close')
  const canCloseOthers = useCan('cash.close_others')
  const canReceive = useCan('cash.receive')
  // Responde por el turno quien lo abrió (o confirmó la base); si lo abrió el sistema sin confirmar, cualquiera
  const isMine = (session) => session.responsibleId === null || session.responsibleId === undefined || session.responsibleId === currentUser?.id
  const canHandle = (session) => canClose && (isMine(session) || canCloseOthers)
  return {
    canCut: (session) => session.status === 'open' && canHandle(session),
    canCount: (session) => (session.status === 'open' || session.status === 'pending_count') && canHandle(session),
    canReceive: (session) => session.status === 'counted' && canReceive,
    isMine,
  }
}
