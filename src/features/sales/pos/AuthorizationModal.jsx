import { useState } from 'react'
import { KeyRound, ShieldCheck, UserRound } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { PasswordField } from '../../../components/ui/PasswordField/PasswordField'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { useAuthorizeSaleMutation } from '../salesApi'

const TEXTS = {
  discount: { title: 'Autorizar descuento', description: 'El descuento pasa tu tope o deja un producto por debajo del costo. Quien tenga permiso escribe aquí su usuario y su contraseña.' },
  expired: { title: 'Autorizar producto vencido', description: 'La venta incluye producto de un lote vencido. Quien tenga permiso escribe aquí su usuario y su contraseña.' },
  // Fase 11 (D-DEV-3, D-DEV-7)
  return: { title: 'Autorizar devolución', description: 'No tienes permiso para recibir devoluciones. Quien tenga permiso escribe aquí su usuario y su contraseña.' },
  return_late: { title: 'Devolución fuera del plazo', description: 'La venta pasó el plazo para devoluciones. Un supervisor con permiso escribe aquí su usuario y su contraseña.' },
  cancel: { title: 'Autorizar anulación', description: 'No tienes permiso para anular ventas. Quien tenga permiso escribe aquí su usuario y su contraseña.' },
}

/**
 * Clave de supervisor en la caja (D20, D-VEN-3, D-VEN-7). La contraseña viaja una sola vez
 * al servidor y no se guarda; el servidor devuelve un código de un solo uso (5 minutos).
 */
export function AuthorizationModal({ scope, onClose, onAuthorized }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authorize, { isLoading, error }] = useAuthorizeSaleMutation()
  const { fieldErrors, formError } = splitApiError(error)
  const texts = TEXTS[scope]

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      const result = await authorize({ username: username.trim(), password, scope }).unwrap()
      setPassword('')
      onAuthorized(result)
    } catch {
      setPassword('')
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="sm"
      icon={ShieldCheck}
      title={texts.title}
      description={texts.description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="sale-authorization-form" icon={KeyRound} isLoading={isLoading} disabled={!username.trim() || !password}>
            Autorizar
          </Button>
        </>
      }
    >
      <form id="sale-authorization-form" onSubmit={handleSubmit} noValidate autoComplete="off">
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <div className="pos-authorization">
          <TextField label="Usuario de quien autoriza" icon={UserRound} autoComplete="off" data-autofocus value={username} onChange={(event) => setUsername(event.target.value)} error={fieldErrors.username} />
          <PasswordField label="Contraseña" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} error={fieldErrors.password} />
        </div>
      </form>
    </Modal>
  )
}
