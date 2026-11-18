import { useState } from 'react'
import { Hash, ListOrdered } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { FormWithPreview } from '../../../components/layout/FormWithPreview/FormWithPreview'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { useUpdateSequenceMutation } from '../settingsApi'
import { formatSequence } from './formatSequence'
import { SequenceTicket } from './SequenceTicket'

const PREFIX_PATTERN = /^[A-Z0-9]{0,10}$/
const MAX_NUMBER = 999999999

/** Cambia el prefijo o continúa la numeración de un consecutivo (D-CFG-3). */
export function SequenceFormModal({ sequence, onClose, onSaved }) {
  const [form, setForm] = useState({ prefix: sequence.prefix, nextNumber: String(sequence.nextNumber) })
  const [localErrors, setLocalErrors] = useState({})
  const [updateSequence, { isLoading, error }] = useUpdateSequenceMutation()
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }

  const number = Number(form.nextNumber)
  const validNumber = Number.isInteger(number) && number >= 1

  const setField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!PREFIX_PATTERN.test(form.prefix)) errors.prefix = 'Hasta 10 letras o números, sin espacios ni guiones'
    if (!validNumber || number > MAX_NUMBER) errors.nextNumber = 'Escribe un número entero mayor que cero'
    else if (number < sequence.nextNumber) errors.nextNumber = `Solo puede aumentar: ya se va en el ${sequence.nextNumber}`
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return

    try {
      const saved = await updateSequence({ id: sequence.id, prefix: form.prefix, nextNumber: number }).unwrap()
      onSaved(saved)
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="xl"
      icon={ListOrdered}
      title={`Consecutivo de ${sequence.documentName.toLowerCase()}`}
      description={sequence.branch ? `Sucursal ${sequence.branch.name}.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="sequence-form" isLoading={isLoading}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <FormWithPreview
        previewLabel="Próximo documento"
        preview={
          <SequenceTicket
            documentName={sequence.documentName}
            number={formatSequence(form.prefix, validNumber ? number : sequence.nextNumber)}
          />
        }
      >
        <form id="sequence-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="admin-form__alert">
              <Alert tone="danger">{formError}</Alert>
            </div>
          )}

          <FormSection icon={Hash} title="Numeración" description="Ejemplo: prefijo FV y número 1250 → FV-001250.">
            <TextField
              label="Prefijo"
              data-autofocus
              placeholder="Ej.: V"
              value={form.prefix}
              onChange={(event) => setField('prefix', event.target.value.toUpperCase().replace(/\s/g, ''))}
              error={fieldErrors.prefix}
              hint="Opcional. Letras y números en mayúscula."
              maxLength={10}
            />
            <TextField
              label="Próximo número"
              type="number"
              inputMode="numeric"
              min={sequence.nextNumber}
              value={form.nextNumber}
              onChange={(event) => setField('nextNumber', event.target.value)}
              error={fieldErrors.nextNumber}
              hint={`Mínimo ${sequence.nextNumber}.`}
              required
            />
          </FormSection>

          <div className="settings-form__after">
            <Alert tone="warning" title="El número solo puede aumentar">
              Sirve para continuar donde iba un talonario o un sistema anterior. Bajarlo repetiría números de documentos ya entregados.
            </Alert>
          </div>
        </form>
      </FormWithPreview>
    </Modal>
  )
}
