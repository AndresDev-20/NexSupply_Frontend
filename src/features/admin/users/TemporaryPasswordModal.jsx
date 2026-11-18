import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { SecretValue } from '../../../components/ui/SecretValue/SecretValue'

/**
 * Muestra la contraseña temporal UNA sola vez (decisión D-ADM-3). Al cerrar,
 * ya no se puede volver a consultar: si se pierde, se restablece otra.
 */
export function TemporaryPasswordModal({ result, onClose }) {
  return (
    <Modal
      isOpen={Boolean(result)}
      onClose={onClose}
      title="Contraseña temporal"
      description={result ? `Para ${result.user.fullName} (usuario: ${result.user.username})` : undefined}
      size="sm"
      footer={
        <Button onClick={onClose} data-autofocus>
          Ya la entregué
        </Button>
      }
    >
      {result && (
        <div className="temporary-password">
          <SecretValue value={result.temporaryPassword} label="Contraseña temporal" />
          <Alert tone="warning" title="Solo se muestra esta vez">
            Entrégala personalmente. Al ingresar, el sistema le pedirá crear su propia contraseña.
          </Alert>
        </div>
      )}
    </Modal>
  )
}
