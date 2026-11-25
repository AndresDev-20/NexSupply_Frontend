import { useState } from 'react'
import { Banknote, UserRound } from 'lucide-react'
import { useCreatePorterMutation, useUpdatePorterMutation } from './portersApi'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { MONEY_PATTERN, toApiNumber, toInputMoney } from '../../../utils/numberInput'
import '../../admin/admin.css'

/** Registrar o editar un conductor (D-FLE-1): nombre, documento, celular y el flete que se le propone. */
export function PorterFormModal({ porter, onClose, onSaved }) {
  const isEdit = Boolean(porter)
  const [form, setForm] = useState({ name: porter?.name ?? '', documentNumber: porter?.documentNumber ?? '', phone: porter?.phone ?? '', tripRate: Number(porter?.tripRate ?? 0) > 0 ? toInputMoney(porter.tripRate) : '', notes: porter?.notes ?? '' })
  const [localErrors, setLocalErrors] = useState({})
  const [createPorter, createState] = useCreatePorterMutation()
  const [updatePorter, updateState] = useUpdatePorterMutation()
  const { isLoading, error } = isEdit ? updateState : createState
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }
  const bind = (name) => ({ value: form[name], error: fieldErrors[name], onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })) })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const rate = toApiNumber(form.tripRate)
    const errors = {}
    if (form.name.trim().length < 2) errors.name = 'Escribe el nombre del conductor'
    if (rate && !MONEY_PATTERN.test(rate)) errors.tripRate = 'Escribe el valor del flete (ej. 10.000)'
    setLocalErrors(errors)
    if (Object.keys(errors).length) return
    const body = { name: form.name.trim(), documentNumber: form.documentNumber.trim() || null, phone: form.phone.trim() || null, tripRate: rate || '0', notes: form.notes.trim() || null }
    try {
      onSaved(isEdit ? await updatePorter({ id: porter.id, ...body }).unwrap() : await createPorter(body).unwrap(), isEdit)
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      icon={UserRound}
      title={isEdit ? 'Editar conductor' : 'Nuevo conductor'}
      description="Quien lleva la mercancía en el carro de línea de la vereda. No es empleado: se le paga el flete en cada venta."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="porter-form" isLoading={isLoading}>
            {isEdit ? 'Guardar cambios' : 'Registrar conductor'}
          </Button>
        </>
      }
    >
      <form id="porter-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={UserRound} title="Datos">
          <TextField label="Nombre" data-autofocus maxLength={150} placeholder="Ej.: Don Jairo (carro de La Luisa)" required {...bind('name')} />
          <TextField label="Cédula" maxLength={20} {...bind('documentNumber')} />
          <TextField label="Celular" inputMode="tel" maxLength={20} {...bind('phone')} />
          <TextField
            label="Flete que se propone"
            icon={Banknote}
            inputMode="decimal"
            placeholder="Ej.: 10.000"
            hint="Se propone al agregar el flete en la venta; ahí se puede cambiar."
            {...bind('tripRate')}
            onBlur={() => setForm((current) => ({ ...current, tripRate: toApiNumber(current.tripRate) ? toInputMoney(toApiNumber(current.tripRate)) : '' }))}
          />
          <TextField className="form-section__full" label="Notas" maxLength={255} placeholder="Ej.: ruta, vereda o placa del carro" {...bind('notes')} />
        </FormSection>
      </form>
    </Modal>
  )
}
