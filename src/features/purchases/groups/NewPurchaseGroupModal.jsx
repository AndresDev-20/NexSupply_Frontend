import { useState } from 'react'
import { Layers, Tag } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { useCreatePurchaseGroupMutation } from '../purchasesApi'

/** "Nueva compra" (D-COMP-9): la crea vacía; los productos se le agregan desde Nuevo producto. */
export function NewPurchaseGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [createGroup, { isLoading, error }] = useCreatePurchaseGroupMutation()
  const { fieldErrors, formError } = splitApiError(error)

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      onCreated(await createGroup({ ...(name.trim() && { name: name.trim() }) }).unwrap())
    } catch {
      // Se muestra en el formulario
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      icon={Layers}
      title="Nueva compra"
      description="Puede tener productos de varios proveedores. Los agregas desde Nuevo producto."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="purchase-group-form" isLoading={isLoading}>
            Crear compra
          </Button>
        </>
      }
    >
      <form id="purchase-group-form" onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <TextField
          label="Nombre"
          icon={Tag}
          placeholder="Ej.: Viaje a Ibagué"
          hint="Opcional. Si lo dejas vacío se llama «Compra del» y la fecha de hoy."
          maxLength={120}
          data-autofocus
          value={name}
          error={fieldErrors.name}
          onChange={(event) => setName(event.target.value)}
        />
      </form>
    </Modal>
  )
}
