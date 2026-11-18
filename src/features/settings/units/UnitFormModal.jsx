import { useState } from 'react'
import { Ruler, Scale, Type } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { OptionCards } from '../../../components/ui/OptionCards/OptionCards'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { FormWithPreview } from '../../../components/layout/FormWithPreview/FormWithPreview'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { useCreateUnitMutation, useUpdateUnitMutation } from '../settingsApi'
import { UnitPreview } from './UnitPreview'

// Igual que el backend: letras (con tildes y µ), números y . % / -
const SYMBOL_PATTERN = /^[\p{L}\p{N}.%/²³-]{1,10}$/u

const DECIMAL_OPTIONS = [
  { value: true, label: 'Admite decimales', description: 'Se vende por fracciones: 1,5 kg · 0,25 L' },
  { value: false, label: 'Solo enteros', description: 'Se vende completo: 3 unidades' },
]

/** Crear o editar una unidad de medida (D11, D-CFG-5). */
export function UnitFormModal({ unit, onClose, onSaved }) {
  const isEdit = Boolean(unit)
  const [form, setForm] = useState({ name: unit?.name ?? '', symbol: unit?.symbol ?? '', allowsDecimals: unit?.allowsDecimals ?? true })
  const [localErrors, setLocalErrors] = useState({})
  const [createUnit, createState] = useCreateUnitMutation()
  const [updateUnit, updateState] = useUpdateUnitMutation()
  const { isLoading, error } = isEdit ? updateState : createState
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }

  const setField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (form.name.trim().length < 2) errors.name = 'Escribe el nombre de la unidad'
    if (!SYMBOL_PATTERN.test(form.symbol.trim())) errors.symbol = 'De 1 a 10 caracteres, sin espacios (ej. kg, mL, und)'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return

    const body = { name: form.name.trim(), symbol: form.symbol.trim(), allowsDecimals: form.allowsDecimals }
    try {
      const saved = isEdit ? await updateUnit({ id: unit.id, ...body }).unwrap() : await createUnit(body).unwrap()
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
      size="xl"
      icon={Ruler}
      title={isEdit ? 'Editar unidad de medida' : 'Nueva unidad de medida'}
      description="Los campos con * son obligatorios."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="unit-form" isLoading={isLoading}>
            {isEdit ? 'Guardar cambios' : 'Crear unidad'}
          </Button>
        </>
      }
    >
      <FormWithPreview previewLabel="Así se verá en una venta" preview={<UnitPreview {...form} />}>
        <form id="unit-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="admin-form__alert">
              <Alert tone="danger">{formError}</Alert>
            </div>
          )}

          <FormSection icon={Ruler} title="Unidad" description="La existencia de cada producto se guarda en su unidad base.">
            <TextField
              label="Nombre"
              icon={Type}
              placeholder="Ej.: Dosis"
              data-autofocus
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              error={fieldErrors.name}
              maxLength={40}
              required
            />
            <TextField
              label="Abreviatura"
              placeholder="Ej.: dosis"
              value={form.symbol}
              onChange={(event) => setField('symbol', event.target.value)}
              error={fieldErrors.symbol}
              hint="Se muestra junto a las cantidades."
              maxLength={10}
              required
            />
          </FormSection>

          <FormSection icon={Scale} title="Cantidades" columns={1}>
            <OptionCards
              legend="¿Se puede vender por fracciones?"
              name="allows_decimals"
              options={DECIMAL_OPTIONS}
              value={form.allowsDecimals}
              onChange={(value) => setField('allowsDecimals', value)}
            />
          </FormSection>
        </form>
      </FormWithPreview>
    </Modal>
  )
}
