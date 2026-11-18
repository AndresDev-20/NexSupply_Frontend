import { useState } from 'react'
import { CalendarClock, CheckCircle2, CreditCard, HandCoins, Wallet } from 'lucide-react'
import { useConfirmPurchaseMutation } from '../purchasesApi'
import { addDays, supplierName } from '../purchaseOptions'
import { PaymentFields } from './PaymentFields'
import { paymentBody, usePaymentMethodInfo, validatePayment } from './paymentHelpers'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { Switch } from '../../../components/ui/Switch/Switch'
import { OptionCards } from '../../../components/ui/OptionCards/OptionCards'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { formatCurrency } from '../../../utils/format'
import { MONEY_PATTERN, toApiNumber } from '../../../utils/numberInput'
import { previewSubtract } from '../../../utils/moneyPreview'
import '../../admin/admin.css'

const PAYMENT_TYPES = [
  { value: 'cash', label: 'De contado', description: 'Se paga todo ahora.', icon: Wallet },
  { value: 'credit', label: 'A crédito', description: 'Queda en cuentas por pagar con su vencimiento.', icon: CalendarClock },
]

/** Mensajes de las líneas con error ("Línea 2: …") para mostrarlos juntos en el modal. */
function lineMessages(error) {
  return (error?.details ?? []).filter((detail) => detail.message).map((detail) => {
    const match = /^items\[(\d+)\]/.exec(detail.field ?? '')
    return match ? `Línea ${Number(match[1]) + 1}: ${detail.message}` : detail.message
  })
}

/**
 * Confirmar una compra (D-COMP-1, D-COMP-7): entra al inventario, toma su consecutivo y se
 * registra el pago (contado) o la cuenta por pagar (crédito, con abono inicial opcional).
 * Si trae lotes vencidos, el servidor pide confirmarlo (D-COMP-5).
 */
export function ConfirmPurchaseModal({ purchase, onClose, onConfirmed }) {
  const term = purchase.supplier?.paymentTermDays ?? 0
  const [paymentType, setPaymentType] = useState(term > 0 ? 'credit' : 'cash')
  const [dueDate, setDueDate] = useState(addDays(purchase.invoiceDate, term))
  const [payment, setPayment] = useState({ paymentMethodId: '', paymentReference: '' })
  const [withAdvance, setWithAdvance] = useState(false)
  const [advance, setAdvance] = useState('')
  const [localErrors, setLocalErrors] = useState({})
  const [confirmPurchase, { isLoading, error }] = useConfirmPurchaseMutation()
  const { method } = usePaymentMethodInfo(payment.paymentMethodId)
  const expiredLots = error?.code === 'CONFIRMATION_REQUIRED' ? lineMessages(error) : null
  const serverMessages = error && !expiredLots ? lineMessages(error) : []
  const needsPayment = paymentType === 'cash' || withAdvance
  const advanceAmount = toApiNumber(advance)
  const remaining = withAdvance && MONEY_PATTERN.test(advanceAmount) ? previewSubtract(purchase.payableTotal, advanceAmount) : null

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = needsPayment ? validatePayment(payment, method) : {}
    if (paymentType === 'credit' && !dueDate) errors.dueDate = 'Escribe la fecha de vencimiento'
    if (withAdvance && paymentType === 'credit') {
      if (!MONEY_PATTERN.test(advanceAmount) || /^0+(\.0+)?$/.test(advanceAmount)) errors.advance = 'Escribe el valor del abono'
      else if (remaining?.startsWith('-')) errors.advance = 'El abono no puede ser mayor que lo que se debe'
    }
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    try {
      const result = await confirmPurchase({
        id: purchase.id,
        paymentType,
        ...(paymentType === 'credit' && { dueDate }),
        ...(needsPayment && { payment: { ...paymentBody(payment, method), ...(paymentType === 'credit' && { amount: advanceAmount }) } }),
        ...(expiredLots && { confirmExpiredLots: true }),
      }).unwrap()
      onConfirmed(result)
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      icon={CheckCircle2}
      title="Confirmar compra"
      description={`${supplierName(purchase.supplier)}${purchase.supplierInvoiceNumber ? ` · factura ${purchase.supplierInvoiceNumber}` : ''}. Al confirmar, los productos entran al inventario y la compra ya no se puede editar.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Volver
          </Button>
          <Button type="submit" form="confirm-purchase-form" icon={CheckCircle2} variant={expiredLots ? 'accent' : 'primary'} isLoading={isLoading}>
            {expiredLots ? 'Recibir de todas formas' : 'Confirmar compra'}
          </Button>
        </>
      }
    >
      <form id="confirm-purchase-form" onSubmit={handleSubmit} noValidate>
        {expiredLots && (
          <div className="admin-form__alert">
            <Alert tone="warning" title="La compra trae lotes vencidos">
              {expiredLots.join(' · ')}. Confirma solo si de verdad los recibes.
            </Alert>
          </div>
        )}
        {serverMessages.length > 0 && (
          <div className="admin-form__alert">
            <Alert tone="danger">{serverMessages.join(' · ')}</Alert>
          </div>
        )}

        <div className="receive-amount">
          <span className="receive-amount__label">Total a pagar al proveedor</span>
          <span className="receive-amount__value">{formatCurrency(purchase.payableTotal)}</span>
          <span className="receive-amount__detail">
            {purchase.items.length} {purchase.items.length === 1 ? 'producto' : 'productos'} · IVA {formatCurrency(purchase.taxTotal)}
            {Number(purchase.freight) > 0 && ` · flete ${formatCurrency(purchase.freight)}`}
          </span>
        </div>

        <div className="purchase-confirm__type">
          <OptionCards legend="¿Cómo se paga?" name="paymentType" options={PAYMENT_TYPES} value={paymentType} onChange={setPaymentType} />
        </div>

        {paymentType === 'credit' && (
          <FormSection icon={CalendarClock} title="Cuenta por pagar" description={term > 0 ? `El proveedor da ${term} días de plazo.` : 'El proveedor no tiene plazo registrado: escribe el vencimiento.'}>
            <TextField label="Vence" type="date" value={dueDate} min={purchase.invoiceDate} onChange={(event) => setDueDate(event.target.value)} error={localErrors.dueDate} required />
            <div className="purchase-confirm__switch">
              <Switch label="Dar un abono ahora" checked={withAdvance} onChange={setWithAdvance} />
            </div>
            {withAdvance && (
              <TextField
                className="form-section__full"
                label="Abono"
                icon={HandCoins}
                inputMode="decimal"
                placeholder="Ej.: 500.000"
                value={advance}
                onChange={(event) => setAdvance(event.target.value)}
                error={localErrors.advance}
                hint={remaining && !remaining.startsWith('-') ? `Quedan por pagar ${formatCurrency(remaining)}` : undefined}
                required
              />
            )}
          </FormSection>
        )}

        {needsPayment && (
          <FormSection icon={CreditCard} title={paymentType === 'cash' ? 'Pago' : 'Pago del abono'}>
            <PaymentFields value={payment} onChange={setPayment} errors={localErrors} />
          </FormSection>
        )}
      </form>
    </Modal>
  )
}
