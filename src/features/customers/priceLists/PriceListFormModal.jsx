import { useState } from 'react'
import { BadgePercent, Calculator, NotebookPen, Tag } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { TextAreaField } from '../../../components/ui/TextAreaField/TextAreaField'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { formatCurrency } from '../../../utils/format'
import { toApiNumber, toInputNumber } from '../../../utils/numberInput'
import { useCreatePriceListMutation, useUpdatePriceListMutation } from './priceListsApi'
import { previewListPrice } from './priceListOptions'

const PERCENT_PATTERN = /^\d{1,2}(\.\d{1,2})?$/
const EXAMPLES = ['2345', '87500', '100000']

/** Crear o editar una lista de precios: nombre, % menos que el precio normal y notas. */
export function PriceListFormModal({ priceList, onClose, onSaved }) {
  const isEdit = Boolean(priceList)
  const [form, setForm] = useState({
    name: priceList?.name ?? '',
    discountPercent: priceList ? toInputNumber(priceList.discountPercent) : '',
    notes: priceList?.notes ?? '',
  })
  const [localErrors, setLocalErrors] = useState({})
  const [createList, createState] = useCreatePriceListMutation()
  const [updateList, updateState] = useUpdatePriceListMutation()
  const { isLoading, error } = isEdit ? updateState : createState
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }
  const percent = toApiNumber(form.discountPercent) || '0'

  const setField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (form.name.trim().length < 2) errors.name = 'Escribe el nombre de la lista (ej. Mayorista)'
    if (!PERCENT_PATTERN.test(percent) || Number(percent) > 90) errors.discountPercent = 'Un porcentaje entre 0 y 90'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    const body = { name: form.name.trim(), discountPercent: percent, notes: form.notes.trim() || null }
    try {
      const saved = isEdit ? await updateList({ id: priceList.id, ...body }).unwrap() : await createList(body).unwrap()
      onSaved(saved, isEdit)
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      icon={BadgePercent}
      title={isEdit ? 'Editar lista de precios' : 'Nueva lista de precios'}
      description="Los campos con * son obligatorios."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="price-list-form" isLoading={isLoading}>
            {isEdit ? 'Guardar cambios' : 'Crear lista'}
          </Button>
        </>
      }
    >
      <form id="price-list-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={Tag} title="Lista" description="Por ejemplo: Mayorista, Distribuidor o Granjas.">
          <TextField label="Nombre" icon={Tag} placeholder="Ej.: Mayorista" data-autofocus value={form.name} onChange={(event) => setField('name', event.target.value)} error={fieldErrors.name} maxLength={80} required />
          <TextField
            label="% menos que el precio normal"
            icon={BadgePercent}
            inputMode="decimal"
            placeholder="Ej.: 8"
            hint="0 si la lista solo tiene precios especiales por producto."
            value={form.discountPercent}
            onChange={(event) => setField('discountPercent', event.target.value)}
            error={fieldErrors.discountPercent}
          />
        </FormSection>

        <FormSection icon={Calculator} title="Así quedan los precios" description="Se redondea hacia arriba a la centena y nunca pasa del precio normal." columns={1}>
          <ul className="price-list-examples" aria-label="Ejemplos de precios">
            {EXAMPLES.map((regular) => {
              const listed = PERCENT_PATTERN.test(percent) && Number(percent) <= 90 ? previewListPrice(regular, percent) : null
              return (
                <li key={regular}>
                  <span>{formatCurrency(regular)}</span>
                  <span aria-hidden="true">→</span>
                  <strong>{listed ? formatCurrency(listed) : '—'}</strong>
                </li>
              )
            })}
          </ul>
        </FormSection>

        <FormSection icon={NotebookPen} title="Notas" columns={1}>
          <TextAreaField label="Notas" placeholder="Ej.: para clientes que compran más de 20 bultos al mes" value={form.notes} onChange={(event) => setField('notes', event.target.value)} error={fieldErrors.notes} maxLength={255} rows={2} />
        </FormSection>
      </form>
    </Modal>
  )
}
