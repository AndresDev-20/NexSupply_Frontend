import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Banknote } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { TextAreaField } from '../../../components/ui/TextAreaField/TextAreaField'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { formatCurrency } from '../../../utils/format'
import { MONEY_PATTERN, toApiNumber } from '../../../utils/numberInput'
import { useAddCashMovementMutation } from '../cashApi'
import { MANUAL_MOVEMENTS } from '../cashOptions'
import '../../admin/admin.css'

/**
 * Ingreso adicional o retiro de efectivo (D-CAJA-6): siempre con motivo.
 * type: "deposit" | "withdrawal". expectedCash: efectivo esperado ahora, como referencia del retiro.
 */
export function CashMovementModal({ session, type, onClose, onSaved }) {
  const meta = MANUAL_MOVEMENTS[type]
  const isWithdrawal = type === 'withdrawal'
  const [form, setForm] = useState({ amount: '', reason: '' })
  const [localErrors, setLocalErrors] = useState({})
  const [addMovement, { isLoading, error }] = useAddCashMovementMutation()
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }
  const amount = toApiNumber(form.amount)

  const change = (name) => (event) => {
    const { value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!MONEY_PATTERN.test(amount) || /^0+(\.0+)?$/.test(amount)) errors.amount = 'Escribe un monto mayor que cero (ej. 50.000)'
    if (form.reason.trim().length < 3) errors.reason = 'Escribe el motivo (mínimo 3 caracteres)'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    try {
      await addMovement({ sessionId: session.id, type, amount, reason: form.reason.trim() }).unwrap()
      onSaved(type, amount)
    } catch {
      // Se muestra desde `error`
    }
  }

  const Icon = isWithdrawal ? ArrowUpFromLine : ArrowDownToLine
  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      icon={Icon}
      title={meta.label}
      description={`${session.register?.name ?? 'Caja'}. ${meta.hint}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="cash-movement-form" icon={Icon} variant={isWithdrawal ? 'danger' : 'primary'} isLoading={isLoading}>
            {meta.verb}
          </Button>
        </>
      }
    >
      <form id="cash-movement-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={Banknote} title={isWithdrawal ? 'Efectivo que sale' : 'Efectivo que entra'} columns={1} description={isWithdrawal && session.expectedCash ? `En la caja se esperan ${formatCurrency(session.expectedCash)}.` : undefined}>
          <TextField
            label="Monto"
            icon={Banknote}
            inputMode="decimal"
            placeholder="Ej.: 50.000"
            data-autofocus
            hint={MONEY_PATTERN.test(amount) ? formatCurrency(amount) : undefined}
            value={form.amount}
            onChange={change('amount')}
            error={fieldErrors.amount}
            required
          />
          <TextAreaField label="Motivo" placeholder={isWithdrawal ? 'Ej.: consignación en Bancolombia' : 'Ej.: sencillo para cambio'} maxLength={255} rows={2} value={form.reason} onChange={change('reason')} error={fieldErrors.reason} required />
        </FormSection>
      </form>
    </Modal>
  )
}
