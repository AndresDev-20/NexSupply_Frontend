import { useState } from 'react'
import { Banknote, HandCoins, Hash, Wallet } from 'lucide-react'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { TextField } from '../../components/ui/TextField/TextField'
import { SelectField } from '../../components/ui/SelectField/SelectField'
import { TextAreaField } from '../../components/ui/TextAreaField/TextAreaField'
import { FormSection } from '../../components/ui/FormSection/FormSection'
import { Alert } from '../../components/feedback/Alert/Alert'
import { useCan } from '../../hooks/usePermissions'
import { splitApiError } from '../../utils/formErrors'
import { MONEY_PATTERN, toApiNumber, toInputMoney } from '../../utils/numberInput'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { formatDay } from '../purchases/purchaseOptions'
import { usePaymentMethodInfo } from '../purchases/detail/paymentHelpers'
import { useGetCashSessionsQuery } from '../cash/cashApi'
import { useCreateCustomerPaymentMutation, useGetReceivablesQuery } from './customersApi'
import '../admin/admin.css'
import { newIdempotencyKey } from '../../utils/idempotencyKey'

/**
 * Recibir un abono (D-CLI-4, D-CLI-6). Se aplica a lo que vence primero o a la deuda escogida,
 * sin pasar de lo que se debe. En efectivo entra a un turno de caja abierto.
 */
export function PaymentModal({ customer, onClose, onSaved }) {
  const canViewCash = useCan('cash.view')
  const [form, setForm] = useState({ amount: '', paymentMethodId: '', paymentReference: '', cashSessionId: '', receivableId: '', notes: '' })
  const [localErrors, setLocalErrors] = useState({})
  // Con saldo a favor, el cliente puede abonar con él (D-APA-4)
  const { methods, method } = usePaymentMethodInfo(form.paymentMethodId, { creditBalance: customer.creditBalance })
  const { data: openReceivables } = useGetReceivablesQuery({ customerId: customer.id, status: 'open', pageSize: 50 })
  const { data: sessionsData } = useGetCashSessionsQuery({ status: 'open', pageSize: 50 }, { skip: !canViewCash })
  const sessions = sessionsData?.rows ?? []
  const [createPayment, { isLoading, error }] = useCreateCustomerPaymentMutation()
  // Una clave por formulario abierto: un doble clic o un reintento no duplica el abono (D-AUD-3)
  const [idempotencyKey] = useState(newIdempotencyKey)
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }

  const receivables = openReceivables?.rows ?? []
  const chosen = receivables.find((row) => String(row.id) === form.receivableId)
  const maxAmount = chosen ? chosen.balance : customer.balance

  const set = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }
  const bind = (name) => ({ value: form[name], error: fieldErrors[name], onChange: (event) => set(name, event.target.value) })

  // Con un solo turno abierto se escoge solo
  const sessionId = form.cashSessionId || (method?.isCash && sessions.length === 1 ? String(sessions[0].id) : '')

  const handleSubmit = async (event) => {
    event.preventDefault()
    const amount = toApiNumber(form.amount)
    const errors = {}
    if (!MONEY_PATTERN.test(amount) || Number(amount) <= 0) errors.amount = 'Escribe el valor del abono (ej. 50.000)'
    else if (Number(amount) > Number(maxAmount)) errors.amount = `No puede pasar de lo que se debe (${formatCurrency(maxAmount)})`
    if (!method) errors.paymentMethodId = 'Selecciona el método de pago'
    else {
      if (method.requiresReference && !form.paymentReference.trim()) errors.paymentReference = `${method.name} pide el número de referencia`
      if (method.isCash && !sessionId) errors.cashSessionId = 'Un abono en efectivo entra a la caja: escoge el turno abierto'
    }
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    try {
      const saved = await createPayment({
        idempotencyKey,
        customerId: customer.id,
        amount,
        paymentMethodId: Number(form.paymentMethodId),
        ...(method.requiresReference && { paymentReference: form.paymentReference.trim() }),
        ...(method.isCash && { cashSessionId: Number(sessionId) }),
        ...(chosen && { receivableId: chosen.id }),
        notes: form.notes.trim() || null,
      }).unwrap()
      onSaved(saved)
    } catch {
      // Se muestra desde `error`
    }
  }

  const overdue = Number(customer.overdueBalance) > 0 ? customer.overdueBalance : null
  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      icon={HandCoins}
      title="Recibir abono"
      description={`${customer.name} debe ${formatCurrency(customer.balance)}${overdue ? ` (${formatCurrency(overdue)} vencido)` : ''}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="payment-form" icon={HandCoins} isLoading={isLoading}>
            Registrar abono
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
        <FormSection icon={Wallet} title="Abono">
          <SelectField
            className="form-section__full"
            label="Abonar a"
            options={[
              { value: '', label: 'Lo que vence primero (automático)' },
              ...receivables.map((row) => ({ value: String(row.id), label: `${row.number} · ${row.description} · debe ${formatCurrency(row.balance)} · vence ${formatDay(row.nextDue?.dueDate ?? row.dueDate)}` })),
            ]}
            {...bind('receivableId')}
          />
          <TextField
            label="Valor"
            icon={Banknote}
            inputMode="decimal"
            placeholder="Ej.: 50.000"
            data-autofocus
            required
            hint={`Máximo ${formatCurrency(maxAmount)}`}
            {...bind('amount')}
            onBlur={() => set('amount', toInputMoney(toApiNumber(form.amount)))}
          />
          <div className="payment-quick">
            {overdue && !chosen && (
              <Button size="sm" variant="ghost" onClick={() => set('amount', toInputMoney(overdue))}>
                Lo vencido
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => set('amount', toInputMoney(maxAmount))}>
              Todo ({formatCurrency(maxAmount)})
            </Button>
          </div>
        </FormSection>
        <FormSection icon={HandCoins} title="Pago">
          <SelectField label="Método de pago" placeholder="Selecciona…" options={methods.map((item) => ({ value: String(item.id), label: item.isCustomerCredit ? `${item.name} (tiene ${formatCurrency(customer.creditBalance)})` : item.name }))} required {...bind('paymentMethodId')} />
          {method?.requiresReference && <TextField label="Referencia" icon={Hash} placeholder="Ej.: número de la transferencia" maxLength={60} required {...bind('paymentReference')} />}
          {method?.isCash &&
            (!canViewCash ? (
              <div className="form-section__full">
                <Alert tone="info">Para recibir efectivo necesitas el permiso de ver la caja. Elige otro método o pide ayuda al administrador.</Alert>
              </div>
            ) : sessions.length === 0 ? (
              <div className="form-section__full">
                <Alert tone="warning">No hay ninguna caja abierta. El efectivo de los abonos entra a la caja: abre un turno, o elige otro método.</Alert>
              </div>
            ) : (
              <SelectField
                label="Entra a la caja"
                placeholder="Selecciona el turno…"
                options={sessions.map((session) => ({ value: String(session.id), label: `${session.register?.name} · abierta ${formatDateTime(session.openedAt)}` }))}
                value={sessionId}
                onChange={(event) => set('cashSessionId', event.target.value)}
                error={fieldErrors.cashSessionId}
                required
              />
            ))}
          <TextAreaField className="form-section__full" label="Nota" rows={1} maxLength={255} hint="Opcional." {...bind('notes')} />
        </FormSection>
      </form>
    </Modal>
  )
}
