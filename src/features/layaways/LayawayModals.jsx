import { useState } from 'react'
import { Ban, Banknote, CalendarPlus, Gift, HandCoins, Hash, PackageCheck, Undo2, Wallet } from 'lucide-react'
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
import { previewSubtract, previewSum } from '../../utils/moneyPreview'
import { formatCurrency, formatDateTime, formatQuantity } from '../../utils/format'
import { formatDay, todayIso } from '../purchases/purchaseOptions'
import { usePaymentMethodInfo } from '../purchases/detail/paymentHelpers'
import { useGetCashSessionsQuery } from '../cash/cashApi'
import { AuthorizationModal } from '../sales/pos/AuthorizationModal'
import { useCancelLayawayMutation, useDeliverLayawayMutation, useExtendLayawayMutation, usePayLayawayMutation } from './layawaysApi'
import '../admin/admin.css'

/** Turnos de caja abiertos (el que hay, si es uno solo). */
function useOpenSessions() {
  const canViewCash = useCan('cash.view')
  const { data } = useGetCashSessionsQuery({ status: 'open', pageSize: 50 }, { skip: !canViewCash })
  const sessions = data?.rows ?? []
  return { canViewCash, sessions, only: sessions.length === 1 ? String(sessions[0].id) : '' }
}

function SessionField({ sessions, value, onChange, error, label = 'Caja (turno abierto)', required = true }) {
  if (sessions.length === 0) {
    return (
      <div className="form-section__full">
        <Alert tone="warning">No hay ninguna caja abierta. Abre un turno en «Mis cajas de hoy».</Alert>
      </div>
    )
  }
  return (
    <SelectField
      label={label}
      placeholder="Selecciona el turno…"
      options={sessions.map((session) => ({ value: String(session.id), label: `${session.register?.name} · abierta ${formatDateTime(session.openedAt)}` }))}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      required={required}
    />
  )
}

/** Abono a un apartado: entra a la caja (D-CLI-4). Al completar el total queda listo para entregar. */
export function LayawayPaymentModal({ layaway, onClose, onSaved }) {
  const { sessions, only } = useOpenSessions()
  const [form, setForm] = useState({ amount: '', paymentMethodId: '', paymentReference: '', cashSessionId: '', notes: '' })
  const [localErrors, setLocalErrors] = useState({})
  const { methods, method } = usePaymentMethodInfo(form.paymentMethodId, { creditBalance: layaway.customer?.creditBalance })
  const [pay, { isLoading, error }] = usePayLayawayMutation()
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }
  const sessionId = form.cashSessionId || only
  const usesCash = Boolean(method && !method.isCustomerCredit)

  const set = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }
  const bind = (name) => ({ value: form[name], error: fieldErrors[name], onChange: (event) => set(name, event.target.value) })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const amount = toApiNumber(form.amount)
    const errors = {}
    if (!MONEY_PATTERN.test(amount) || Number(amount) <= 0) errors.amount = 'Escribe el valor del abono (ej. 50.000)'
    else if (Number(amount) > Number(layaway.balance)) errors.amount = `No puede pasar de lo que falta (${formatCurrency(layaway.balance)})`
    if (!method) errors.paymentMethodId = 'Selecciona el método de pago'
    else {
      if (method.requiresReference && !form.paymentReference.trim()) errors.paymentReference = `${method.name} pide el número de referencia`
      if (method.isCash && !sessionId) errors.cashSessionId = 'El efectivo entra a la caja: escoge el turno abierto'
    }
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    try {
      const saved = await pay({
        id: layaway.id,
        amount,
        paymentMethodId: Number(form.paymentMethodId),
        ...(method.requiresReference && { paymentReference: form.paymentReference.trim() }),
        ...(usesCash && sessionId && { cashSessionId: Number(sessionId) }),
        ...(form.notes.trim() && { notes: form.notes.trim() }),
      }).unwrap()
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
      icon={HandCoins}
      title={`Abonar al apartado ${layaway.number}`}
      description={`${layaway.customer.name} lleva ${formatCurrency(layaway.amountPaid)} de ${formatCurrency(layaway.total)}. Falta ${formatCurrency(layaway.balance)}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="layaway-payment-form" icon={HandCoins} isLoading={isLoading}>
            Registrar abono
          </Button>
        </>
      }
    >
      <form id="layaway-payment-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={Wallet} title="Abono">
          <TextField
            label="Valor"
            icon={Banknote}
            inputMode="decimal"
            placeholder="Ej.: 50.000"
            data-autofocus
            required
            hint={`Falta ${formatCurrency(layaway.balance)}`}
            {...bind('amount')}
            onBlur={() => set('amount', toInputMoney(toApiNumber(form.amount)))}
          />
          <div className="payment-quick">
            <Button size="sm" variant="ghost" onClick={() => set('amount', toInputMoney(layaway.balance))}>
              Todo lo que falta
            </Button>
          </div>
          <SelectField
            label="Método de pago"
            placeholder="Selecciona…"
            options={methods.map((item) => ({ value: String(item.id), label: item.isCustomerCredit ? `${item.name} (tiene ${formatCurrency(layaway.customer.creditBalance)})` : item.name }))}
            required
            {...bind('paymentMethodId')}
          />
          {method?.requiresReference && <TextField label="Referencia" icon={Hash} maxLength={60} required {...bind('paymentReference')} />}
          {usesCash && <SessionField sessions={sessions} value={sessionId} onChange={(value) => set('cashSessionId', value)} error={fieldErrors.cashSessionId} required={method.isCash} label="Entra a la caja" />}
          <TextAreaField className="form-section__full" label="Nota" rows={1} maxLength={255} hint="Opcional." {...bind('notes')} />
        </FormSection>
      </form>
    </Modal>
  )
}

/** Entrega (D-APA-6): genera la venta y saca el producto del inventario. La caja no se mueve. */
export function DeliverModal({ layaway, onClose, onDelivered }) {
  const { sessions, only } = useOpenSessions()
  const [sessionId, setSessionId] = useState('')
  const [localError, setLocalError] = useState(null)
  const [askExpired, setAskExpired] = useState(false)
  const [deliver, { isLoading, error, reset }] = useDeliverLayawayMutation()
  const { formError, fieldErrors } = splitApiError(error?.code === 'AUTHORIZATION_REQUIRED' ? null : error)
  const chosen = sessionId || only

  const submit = async (expiredAuthorization) => {
    setLocalError(null)
    if (!chosen) return setLocalError('Escoge la caja donde se entrega')
    try {
      const result = await deliver({ id: layaway.id, cashSessionId: Number(chosen), ...(expiredAuthorization && { expiredAuthorization }) }).unwrap()
      onDelivered(result)
    } catch (deliverError) {
      if (deliverError.code === 'AUTHORIZATION_REQUIRED') setAskExpired(true)
    }
    return undefined
  }

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        isBusy={isLoading}
        icon={PackageCheck}
        title={`Entregar el apartado ${layaway.number}`}
        description={`${layaway.customer.name} pagó ${formatCurrency(layaway.total)}. Al entregar sale del inventario y queda la venta con su comprobante.`}
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button icon={PackageCheck} isLoading={isLoading} onClick={() => submit()}>
              Entregar
            </Button>
          </>
        }
      >
        {(formError || localError || fieldErrors.items) && (
          <div className="admin-form__alert">
            <Alert tone="danger">{localError ?? fieldErrors.items ?? formError}</Alert>
          </div>
        )}
        <ul className="layaway-deliver__items">
          {layaway.items.map((item) => (
            <li key={item.id}>
              <PackageCheck aria-hidden="true" />
              <span>
                <strong>{formatQuantity(item.quantity)} {item.presentationName ?? item.unitSymbol}</strong> {item.productName}
              </span>
            </li>
          ))}
        </ul>
        <FormSection icon={Wallet} title="Caja">
          <SessionField sessions={sessions} value={chosen} onChange={setSessionId} error={fieldErrors.cashSessionId} />
          <p className="form-section__full layaway-hint">La venta queda en este turno. No entra dinero: ya se pagó con los abonos.</p>
        </FormSection>
      </Modal>
      {askExpired && (
        <AuthorizationModal
          scope="expired"
          onClose={() => {
            setAskExpired(false)
            reset()
          }}
          onAuthorized={(result) => {
            setAskExpired(false)
            reset()
            submit(result.token)
          }}
        />
      )}
    </>
  )
}

/** Ampliar la fecha límite (D-APA-3). */
export function ExtendModal({ layaway, onClose, onSaved }) {
  const [dueDate, setDueDate] = useState(layaway.dueDate < todayIso() ? todayIso() : layaway.dueDate)
  const [reason, setReason] = useState('')
  const [extend, { isLoading, error }] = useExtendLayawayMutation()
  const { fieldErrors, formError } = splitApiError(error)

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      onSaved(await extend({ id: layaway.id, dueDate, ...(reason.trim() && { reason: reason.trim() }) }).unwrap())
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      icon={CalendarPlus}
      title={`Ampliar el plazo de ${layaway.number}`}
      description={`Fecha límite actual: ${formatDay(layaway.dueDate)}. Lo que falta: ${formatCurrency(layaway.balance)}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="layaway-extend-form" icon={CalendarPlus} isLoading={isLoading}>
            Guardar fecha
          </Button>
        </>
      }
    >
      <form id="layaway-extend-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={CalendarPlus} title="Nueva fecha">
          <TextField label="Pagar antes del" type="date" min={todayIso()} value={dueDate} onChange={(event) => setDueDate(event.target.value)} error={fieldErrors.dueDate} required />
          <TextAreaField className="form-section__full" label="Motivo" rows={2} maxLength={255} hint="Opcional. Queda en la auditoría." value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormSection>
      </form>
    </Modal>
  )
}

/**
 * Cancelar (D7b, D-APA-5): lo abonado se reparte entre lo que se queda el negocio, lo que se le
 * devuelve (sale de la caja) y lo que queda como saldo a favor. Debe sumar lo abonado.
 */
export function CancelModal({ layaway, onClose, onSaved }) {
  const { sessions, only } = useOpenSessions()
  const { methods } = usePaymentMethodInfo('')
  const cashMethod = methods.find((item) => item.isCash)
  const paid = layaway.amountPaid
  const [form, setForm] = useState({ retained: '', refund: '', credit: Number(paid) > 0 ? toInputMoney(paid) : '', reason: '', cashSessionId: '', refundPaymentMethodId: '', refundReference: '' })
  const [localError, setLocalError] = useState(null)
  const [cancel, { isLoading, error }] = useCancelLayawayMutation()
  const { fieldErrors, formError } = splitApiError(error)
  const set = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalError(null)
  }

  const retained = toApiNumber(form.retained) || '0'
  const refund = toApiNumber(form.refund) || '0'
  const credit = toApiNumber(form.credit) || '0'
  const missing = previewSubtract(paid, previewSum([retained, refund, credit]))
  const refundMethodId = form.refundPaymentMethodId || (cashMethod ? String(cashMethod.id) : '')
  const refundMethod = methods.find((item) => String(item.id) === refundMethodId)
  const sessionId = form.cashSessionId || only

  const preset = (values) => setForm((current) => ({ ...current, retained: '', refund: '', credit: '', ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, toInputMoney(value)])) }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (form.reason.trim().length < 5) return setLocalError('Escribe el motivo (mínimo 5 caracteres)')
    if (Number(missing) !== 0) return setLocalError(Number(missing) > 0 ? `Falta repartir ${formatCurrency(missing)}` : `Se repartió ${formatCurrency(missing.replace('-', ''))} de más`)
    if (Number(refund) > 0) {
      if (!sessionId) return setLocalError('Para devolver dinero, escoge la caja de donde sale')
      if (refundMethod?.requiresReference && !form.refundReference.trim()) return setLocalError(`${refundMethod.name} pide el número de referencia`)
    }
    try {
      const saved = await cancel({
        id: layaway.id,
        reason: form.reason.trim(),
        retainedAmount: retained,
        refundAmount: refund,
        creditAmount: credit,
        ...(Number(refund) > 0 && { cashSessionId: Number(sessionId), refundPaymentMethodId: Number(refundMethodId), ...(form.refundReference.trim() && { refundReference: form.refundReference.trim() }) }),
      }).unwrap()
      onSaved(saved)
    } catch {
      // Se muestra desde `error`
    }
    return undefined
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="lg"
      icon={Ban}
      title={`Cancelar el apartado ${layaway.number}`}
      description={`El producto vuelve a quedar disponible para la venta. ${layaway.customer.name} abonó ${formatCurrency(paid)}: decide qué pasa con ese dinero.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Volver
          </Button>
          <Button type="submit" form="layaway-cancel-form" variant="danger" icon={Ban} isLoading={isLoading}>
            Cancelar apartado
          </Button>
        </>
      }
    >
      <form id="layaway-cancel-form" onSubmit={handleSubmit} noValidate>
        {(formError || localError || fieldErrors.retainedAmount || fieldErrors.creditAmount) && (
          <div className="admin-form__alert">
            <Alert tone="danger">{localError ?? fieldErrors.retainedAmount ?? fieldErrors.creditAmount ?? formError}</Alert>
          </div>
        )}
        {Number(paid) > 0 && (
          <FormSection icon={Wallet} title={`Lo abonado: ${formatCurrency(paid)}`}>
            <div className="form-section__full payment-quick">
              <Button size="sm" variant="ghost" icon={Gift} onClick={() => preset({ credit: paid })}>
                Todo a favor
              </Button>
              <Button size="sm" variant="ghost" icon={Undo2} onClick={() => preset({ refund: paid })}>
                Devolver todo
              </Button>
              <Button size="sm" variant="ghost" icon={Wallet} onClick={() => preset({ retained: paid })}>
                Retener todo
              </Button>
            </div>
            <TextField label="Saldo a favor" icon={Gift} inputMode="decimal" placeholder="0" hint="Para pagar compras o fiados después." value={form.credit} onChange={(event) => set('credit', event.target.value)} onBlur={() => set('credit', toInputMoney(toApiNumber(form.credit)))} />
            <TextField label="Se le devuelve" icon={Undo2} inputMode="decimal" placeholder="0" hint="Sale de la caja." value={form.refund} onChange={(event) => set('refund', event.target.value)} onBlur={() => set('refund', toInputMoney(toApiNumber(form.refund)))} />
            <TextField label="Se retiene" icon={Wallet} inputMode="decimal" placeholder="0" hint="Se lo queda el negocio." value={form.retained} onChange={(event) => set('retained', event.target.value)} onBlur={() => set('retained', toInputMoney(toApiNumber(form.retained)))} />
            <p className={`form-section__full layaway-split${Number(missing) === 0 ? ' layaway-split--ok' : ''}`}>
              {Number(missing) === 0 ? '¡Repartido completo!' : Number(missing) > 0 ? `Falta repartir ${formatCurrency(missing)}` : `Sobran ${formatCurrency(missing.replace('-', ''))}`}
            </p>
            {Number(refund) > 0 && (
              <>
                <SessionField sessions={sessions} value={sessionId} onChange={(value) => set('cashSessionId', value)} error={fieldErrors.cashSessionId} label="Sale de la caja" />
                <SelectField label="Se devuelve en" options={methods.filter((item) => !item.isCustomerCredit).map((item) => ({ value: String(item.id), label: item.name }))} value={refundMethodId} onChange={(event) => set('refundPaymentMethodId', event.target.value)} />
                {refundMethod?.requiresReference && <TextField label="Referencia" icon={Hash} maxLength={60} value={form.refundReference} onChange={(event) => set('refundReference', event.target.value)} />}
              </>
            )}
          </FormSection>
        )}
        <FormSection icon={Ban} title="Motivo">
          <TextAreaField className="form-section__full" label="¿Por qué se cancela?" rows={2} maxLength={200} required placeholder="Ej.: el cliente desistió de la compra" value={form.reason} onChange={(event) => set('reason', event.target.value)} error={fieldErrors.reason} />
        </FormSection>
      </form>
    </Modal>
  )
}
