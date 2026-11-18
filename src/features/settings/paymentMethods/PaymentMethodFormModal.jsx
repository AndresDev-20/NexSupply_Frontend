import { useState } from 'react'
import { ArrowUpDown, CreditCard, Settings2, Wallet } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { Switch } from '../../../components/ui/Switch/Switch'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { FormWithPreview } from '../../../components/layout/FormWithPreview/FormWithPreview'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { useCreatePaymentMethodMutation, useUpdatePaymentMethodMutation } from '../settingsApi'
import { PaymentMethodsPreview } from './PaymentMethodsPreview'

/** Crear o editar un método de pago, con la vista de cómo queda en el punto de venta. */
export function PaymentMethodFormModal({ method, allMethods, onClose, onSaved }) {
  const isEdit = Boolean(method)
  const isCash = Boolean(method?.isCash)
  const [form, setForm] = useState({
    name: method?.name ?? '',
    // Uno nuevo queda de último: el mayor orden actual + 1
    sortOrder: String(method?.sortOrder ?? Math.min(999, Math.max(0, ...(allMethods ?? []).map((item) => item.sortOrder)) + 1)),
    requiresReference: method?.requiresReference ?? false,
  })
  const [localErrors, setLocalErrors] = useState({})
  const [createMethod, createState] = useCreatePaymentMethodMutation()
  const [updateMethod, updateState] = useUpdatePaymentMethodMutation()
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
    if (form.name.trim().length < 2) errors.name = 'Escribe el nombre del método de pago'
    const order = Number(form.sortOrder)
    if (!Number.isInteger(order) || order < 0 || order > 999) errors.sortOrder = 'Un número entre 0 y 999'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return

    const body = { name: form.name.trim(), sortOrder: order, ...(!isCash && { requiresReference: form.requiresReference }) }
    try {
      const saved = isEdit ? await updateMethod({ id: method.id, ...body }).unwrap() : await createMethod(body).unwrap()
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
      icon={isCash ? Wallet : CreditCard}
      title={isEdit ? 'Editar método de pago' : 'Nuevo método de pago'}
      description="Los campos con * son obligatorios."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="payment-method-form" isLoading={isLoading}>
            {isEdit ? 'Guardar cambios' : 'Crear método'}
          </Button>
        </>
      }
    >
      <FormWithPreview
        previewLabel="Así se verá al cobrar"
        preview={<PaymentMethodsPreview methods={allMethods} editing={{ id: method?.id ?? 'new', isCash, ...form }} />}
      >
        <form id="payment-method-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="admin-form__alert">
              <Alert tone="danger">{formError}</Alert>
            </div>
          )}

          <FormSection icon={CreditCard} title="Método de pago" description="Cómo lo verá el cajero en el punto de venta.">
            <TextField
              label="Nombre"
              icon={CreditCard}
              placeholder="Ej.: Bancolombia QR"
              data-autofocus
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              error={fieldErrors.name}
              maxLength={60}
              required
            />
            <TextField
              label="Orden"
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              icon={ArrowUpDown}
              value={form.sortOrder}
              onChange={(event) => setField('sortOrder', event.target.value)}
              error={fieldErrors.sortOrder}
              hint="Los de menor número aparecen primero."
            />
          </FormSection>

          <FormSection icon={Settings2} title="Al cobrar" columns={1}>
            <Switch
              label="Pedir número de referencia"
              description={
                isCash
                  ? 'El efectivo no tiene número de referencia.'
                  : 'El cajero escribe el número de la transacción (ej. el de Nequi). Ayuda a cuadrar contra el banco.'
              }
              checked={!isCash && form.requiresReference}
              onChange={(checked) => setField('requiresReference', checked)}
              disabled={isCash}
            />
            {!isCash && (
              <p className="settings-note">
                <Wallet aria-hidden="true" />
                <span>Este método no suma al efectivo del cajón: en el cierre de caja se informa aparte.</span>
              </p>
            )}
          </FormSection>
        </form>
      </FormWithPreview>
    </Modal>
  )
}
