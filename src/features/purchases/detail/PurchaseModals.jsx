import { useState } from 'react'
import { Ban, HandCoins } from 'lucide-react'
import { useAddPurchasePaymentMutation } from '../purchasesApi'
import { supplierName } from '../purchaseOptions'
import { PaymentFields } from './PaymentFields'
import { paymentBody, usePaymentMethodInfo, validatePayment } from './paymentHelpers'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { TextAreaField } from '../../../components/ui/TextAreaField/TextAreaField'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { formatCurrency } from '../../../utils/format'
import { MONEY_PATTERN, toApiNumber, toInputMoney } from '../../../utils/numberInput'
import { previewSubtract } from '../../../utils/moneyPreview'
import '../../admin/admin.css'

/** Pago o abono a una compra confirmada (D-COMP-7). */
export function PaymentModal({ purchase, onClose, onSaved }) {
  const [amount, setAmount] = useState('')
  const [payment, setPayment] = useState({ paymentMethodId: '', paymentReference: '' })
  const [notes, setNotes] = useState('')
  const [localErrors, setLocalErrors] = useState({})
  const [addPayment, { isLoading, error }] = useAddPurchasePaymentMutation()
  const { method } = usePaymentMethodInfo(payment.paymentMethodId)
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const errors = { ...serverErrors, ...localErrors }
  const value = toApiNumber(amount)
  const remaining = MONEY_PATTERN.test(value) ? previewSubtract(purchase.balance, value) : null

  const handleSubmit = async (event) => {
    event.preventDefault()
    const found = validatePayment(payment, method)
    if (!MONEY_PATTERN.test(value) || /^0+(\.0+)?$/.test(value)) found.amount = 'Escribe el valor del pago'
    else if (remaining?.startsWith('-')) found.amount = `El pago supera lo que se debe (${formatCurrency(purchase.balance)})`
    setLocalErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      const saved = await addPayment({ id: purchase.id, amount: value, ...paymentBody(payment, method), notes: notes.trim() || null }).unwrap()
      onSaved(saved, value)
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      icon={HandCoins}
      title="Registrar pago"
      description={`${purchase.number} · ${supplierName(purchase.supplier)}. Se debe ${formatCurrency(purchase.balance)}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="payment-form" icon={HandCoins} isLoading={isLoading}>
            Registrar pago
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={HandCoins} title="Pago">
          <TextField
            label="Valor"
            inputMode="decimal"
            placeholder="Ej.: 500.000"
            data-autofocus
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value)
              setLocalErrors((current) => ({ ...current, amount: undefined }))
            }}
            error={errors.amount}
            hint={remaining && !remaining.startsWith('-') ? (/^0+(\.0+)?$/.test(remaining) ? 'Queda pagada' : `Quedan ${formatCurrency(remaining)}`) : undefined}
            required
          />
          <div className="purchase-confirm__switch">
            <Button size="sm" variant="secondary" onClick={() => setAmount(toInputMoney(purchase.balance))}>
              Pagar todo
            </Button>
          </div>
          <PaymentFields value={payment} onChange={setPayment} errors={errors} />
          <TextAreaField className="form-section__full" label="Nota" rows={1} maxLength={255} value={notes} onChange={(event) => setNotes(event.target.value)} hint="Opcional." />
        </FormSection>
      </form>
    </Modal>
  )
}

/** Pide el motivo de una anulación (compra o pago). Nada se borra: queda la trazabilidad. */
export function ReasonModal({ title, description, confirmLabel, isLoading, error, onClose, onConfirm, placeholder = 'Ej.: la factura se registró dos veces' }) {
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState(null)
  const { fieldErrors, formError } = splitApiError(error)

  const handleSubmit = (event) => {
    event.preventDefault()
    if (reason.trim().length < 5) {
      setLocalError('Escribe el motivo (mínimo 5 caracteres)')
      return
    }
    onConfirm(reason.trim())
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      icon={Ban}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Volver
          </Button>
          <Button type="submit" form="reason-form" variant="danger" icon={Ban} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id="reason-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <TextAreaField
          label="Motivo"
          placeholder={placeholder}
          rows={3}
          maxLength={255}
          data-autofocus
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
            setLocalError(null)
          }}
          error={localError ?? fieldErrors.reason}
          required
        />
      </form>
    </Modal>
  )
}
