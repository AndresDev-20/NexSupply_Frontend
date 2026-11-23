import { forwardRef, useEffect, useState } from 'react'
import { Archive, Banknote, CheckCircle2, CreditCard, Eraser, FileText, Gift, Stethoscope, HandCoins, Landmark, Layers, Plus, Smartphone, Trash2, Wallet } from 'lucide-react'
import { Button } from '../../../components/ui/Button/Button'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { useCan } from '../../../hooks/usePermissions'
import { splitApiError } from '../../../utils/formErrors'
import { MONEY_PATTERN, toApiNumber, toInputMoney } from '../../../utils/numberInput'
import { previewSubtract, previewSum } from '../../../utils/moneyPreview'
import { formatCurrency } from '../../../utils/format'
import { addDays, formatDay, todayIso } from '../../purchases/purchaseOptions'
import { usePaymentMethodInfo } from '../../purchases/detail/paymentHelpers'
import { FREQUENCIES } from '../../customers/customerOptions'
import { useCreateLayawayMutation, useGetLayawayTermsQuery } from '../../layaways/layawaysApi'
import { useCreateSaleMutation } from '../salesApi'
import { useCreateQuoteMutation } from '../../quotes/quotesApi'
import { newSaleKey } from '../saleOptions'
import { AuthorizationModal } from './AuthorizationModal'
import { useAnimatedNumber } from './useAnimatedNumber'

/** Ícono de un método de pago según su nombre (los métodos son configurables). */
function methodIcon(method) {
  if (method.isCash) return Banknote
  if (method.isCustomerCredit) return Gift
  const name = method.name.toLowerCase()
  if (name.includes('nequi') || name.includes('daviplata')) return Smartphone
  if (name.includes('tarjeta') || name.includes('datáfono')) return CreditCard
  if (name.includes('transfer') || name.includes('banco')) return Landmark
  return Wallet
}

/** Billetes sugeridos para pagar en efectivo: el valor exacto y los redondos de arriba. */
function quickAmounts(total) {
  const value = Number(total)
  if (!value) return []
  const options = [value]
  for (const step of [10000, 20000, 50000, 100000]) {
    // Si el total ya es redondo, se propone el billete siguiente
    let rounded = Math.ceil(value / step) * step
    if (rounded === value) rounded += step
    if (!options.includes(rounded)) options.push(rounded)
  }
  return options.slice(0, 4)
}

// "200000.00" → "200000": lo que se envía y se muestra en los campos
const plain = (value) => String(value ?? '0').replace(/\.00$/, '')

function MethodTiles({ methods, value, onChange, label, creditBalance }) {
  return (
    <div className="pay-methods" role="radiogroup" aria-label={label}>
      {methods.map((method) => {
        const Icon = methodIcon(method)
        const active = String(value) === String(method.id)
        return (
          <button
            key={method.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`pay-method${active ? ' pay-method--active' : ''}${method.isCustomerCredit ? ' pay-method--credit' : ''}`}
            onClick={() => onChange(method)}
          >
            {active && <CheckCircle2 className="pay-method__check" aria-hidden="true" />}
            <Icon aria-hidden="true" />
            <span>{method.name}</span>
            {method.isCustomerCredit && <small className="pay-method__hint">Tiene {formatCurrency(creditBalance)}</small>}
          </button>
        )
      })}
    </div>
  )
}

/** Cómo se paga lo que falta (D7b): abonos libres con fecha límite o cuotas. Lo usan el fiado y el apartado. */
function PlanFields({ plan, onChange, defaultDueHint }) {
  const set = (changes) => onChange((current) => ({ ...current, ...changes }))
  return (
    <>
      <div className="pay-mode pay-mode--small" role="radiogroup" aria-label="Cómo paga el resto">
        {[
          { value: 'free', label: 'Abonos libres' },
          { value: 'installments', label: 'Cuotas' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={plan.paymentMode === option.value}
            className={`pay-mode__option${plan.paymentMode === option.value ? ' pay-mode__option--active' : ''}`}
            onClick={() => set({ paymentMode: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>
      {plan.paymentMode === 'free' ? (
        <label className="pay-field">
          <span className="pay-field__label">Pagar antes del</span>
          <span className="pay-field__control">
            <input type="date" min={todayIso()} value={plan.dueDate} onChange={(event) => set({ dueDate: event.target.value })} />
          </span>
          <span className="pay-field__hint">{defaultDueHint}</span>
        </label>
      ) : (
        <div className="pay-plan">
          <label className="pay-field">
            <span className="pay-field__label">Cuotas</span>
            <span className="pay-field__control">
              <input inputMode="numeric" value={plan.count} onChange={(event) => set({ count: event.target.value })} />
            </span>
          </label>
          <label className="pay-field">
            <span className="pay-field__label">Cada</span>
            <span className="pay-field__control">
              <select value={plan.frequency} onChange={(event) => set({ frequency: event.target.value })}>
                {FREQUENCIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="pay-field">
            <span className="pay-field__label">Primera</span>
            <span className="pay-field__control">
              <input type="date" min={todayIso()} value={plan.firstDueDate} onChange={(event) => set({ firstDueDate: event.target.value })} />
            </span>
          </label>
        </div>
      )}
    </>
  )
}

/** Plan de pago tal como lo espera la API (fiado y apartado). */
const planBody = (plan) =>
  plan.paymentMode === 'free'
    ? { paymentMode: 'free', ...(plan.dueDate && { dueDate: plan.dueDate }) }
    : {
        paymentMode: 'installments',
        plan: {
          count: Number(plan.count),
          frequency: plan.frequency,
          firstDueDate: plan.firstDueDate,
        },
      }

function MoneyInput({ id, label, value, onChange, hint, disabled }) {
  return (
    <label className="pay-field" htmlFor={id}>
      <span className="pay-field__label">{label}</span>
      <span className="pay-field__control">
        <span aria-hidden="true">$</span>
        <input
          id={id}
          inputMode="decimal"
          placeholder="0"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => onChange(toInputMoney(toApiNumber(value)))}
          onFocus={(event) => event.target.select()}
        />
      </span>
      {hint && <span className="pay-field__hint">{hint}</span>}
    </label>
  )
}

/** Cambio grande y animado: lo primero que mira el cajero. */
function ChangeDisplay({ change }) {
  const animated = useAnimatedNumber(change ?? 0)
  if (change === null) return null
  const missing = Number(change) < 0
  return (
    <div className={`pay-change${missing ? ' pay-change--missing' : ''}`} aria-live="polite">
      <span>{missing ? 'Faltan' : 'Cambio'}</span>
      <strong>{formatCurrency(String(Math.abs(animated)))}</strong>
    </div>
  )
}

/**
 * Sección "Pago" de la venta (D-VEN-5, D-VEN-6): contado con un método (o mixto) o fiado con
 * pago parcial. La clave de idempotencia se crea al montar y se conserva en los reintentos
 * (D-VEN-8); el padre lo vuelve a montar después de cada venta. Si el servidor pide
 * autorización, se pide la clave del supervisor y se reintenta solo.
 */
export const CheckoutPanel = forwardRef(function CheckoutPanel({ total, request, customer, disabled, onClear, onCompleted, onModeChange, prescriptionProducts = [], quoteOnly = false }, formRef) {
  const canSellOnCredit = useCan('sales.credit')
  const canLayaway = useCan('layaways.create')
  const canQuote = useCan('quotes.create')
  // "Saldo a favor" solo aparece si el cliente escogido tiene saldo (D-APA-4)
  const { methods } = usePaymentMethodInfo('', {
    creditBalance: customer?.creditBalance,
  })
  const cashMethod = methods.find((method) => method.isCash)
  // Sin caja abierta solo se cotiza (D-COT-1)
  const [mode, setMode] = useState(quoteOnly ? 'quote' : 'cash')
  const [methodId, setMethodId] = useState('')
  const [mixed, setMixed] = useState(false)
  const [rows, setRows] = useState([])
  const [received, setReceived] = useState('')
  const [reference, setReference] = useState('')
  const [paidNow, setPaidNow] = useState('')
  const [notes, setNotes] = useState('')
  const [credit, setCredit] = useState({
    paymentMode: 'free',
    dueDate: '',
    count: '2',
    frequency: 'biweekly',
    firstDueDate: addDays(todayIso(), 15),
  })
  const [authorizations, setAuthorizations] = useState({})
  const [askScope, setAskScope] = useState(null)
  const [localError, setLocalError] = useState(null)
  const [idempotencyKey] = useState(newSaleKey)
  const [createSale, saleState] = useCreateSaleMutation()
  const [createLayaway, layawayState] = useCreateLayawayMutation()
  const [createQuote, quoteState] = useCreateQuoteMutation()
  const isLayaway = mode === 'layaway'
  // Cotizar (D-COT-1): no cobra, no aparta y no exige existencia
  const isQuote = mode === 'quote'
  const [quoteFor, setQuoteFor] = useState({ name: '', phone: '', days: '' })
  // Fórmula veterinaria (D-VET-1): solo si la venta lleva productos que la requieren
  const [prescription, setPrescription] = useState({
    number: '',
    veterinarianName: '',
    veterinarianLicense: '',
    date: '',
    patient: '',
  })
  const needsPrescription = prescriptionProducts.length > 0 && (mode === 'cash' || mode === 'credit')
  const hasPrescription = Boolean(prescription.number.trim() || prescription.veterinarianName.trim())
  const setRx = (name) => (event) => setPrescription((current) => ({ ...current, [name]: event.target.value }))
  const { isLoading, error, reset } = isQuote ? quoteState : isLayaway ? layawayState : saleState

  // El punto de venta pide la vista previa sin exigir existencia mientras se cotiza
  useEffect(() => {
    onModeChange?.(mode)
  }, [mode, onModeChange])
  const { formError, fieldErrors } = splitApiError(error?.code === 'AUTHORIZATION_REQUIRED' ? null : error)

  const totalPlain = plain(total)
  // Abono inicial mínimo y fecha propuesta del apartado (D-APA-1, D-APA-2)
  const { data: terms } = useGetLayawayTermsQuery(totalPlain, {
    skip: !isLayaway || !Number(totalPlain),
  })
  const animatedTotal = useAnimatedNumber(totalPlain)
  const selectedId = methodId || (cashMethod ? String(cashMethod.id) : '')
  const selected = methods.find((method) => String(method.id) === selectedId)
  const methodOf = (id) => methods.find((method) => String(method.id) === String(id))

  const chooseMethod = (method) => {
    setMethodId(String(method.id))
    setLocalError(null)
    // Efectivo: el cursor va a "Recibido"
    if (method.isCash) setTimeout(() => document.getElementById('pay-received')?.focus(), 30)
  }

  // Pagos que se envían según el modo
  const payments = (() => {
    if (mode === 'cash' && mixed)
      return rows
        .filter((row) => toApiNumber(row.amount))
        .map((row) => ({
          method: methodOf(row.paymentMethodId),
          amount: toApiNumber(row.amount),
          reference: row.paymentReference,
        }))
    const amount = mode === 'cash' ? totalPlain : toApiNumber(paidNow)
    return amount && Number(amount) > 0
      ? [
          {
            method: selected,
            amount,
            received: selected?.isCash ? toApiNumber(received) : '',
            reference,
          },
        ]
      : []
  })()
  const paid = previewSum(payments.map((payment) => payment.amount))
  const pending = previewSubtract(totalPlain, paid)
  const cashPayment = payments.find((payment) => payment.method?.isCash && !mixed)
  const change = cashPayment && MONEY_PATTERN.test(cashPayment.received || '') ? previewSubtract(cashPayment.received, cashPayment.amount) : null

  const submit = async (extra = authorizations) => {
    setLocalError(null)
    if (isQuote) {
      const body = {
        idempotencyKey,
        ...(customer
          ? { customerId: customer.id }
          : {
              customerName: quoteFor.name.trim() || null,
              customerPhone: quoteFor.phone.trim() || null,
            }),
        ...(request.priceListId !== undefined && {
          priceListId: request.priceListId,
        }),
        items: request.items,
        ...(request.globalDiscount && {
          globalDiscount: request.globalDiscount,
        }),
        ...(Number(quoteFor.days) > 0 && { validDays: Number(quoteFor.days) }),
        ...(notes.trim() && { notes: notes.trim() }),
        ...(extra.discountAuthorization && {
          discountAuthorization: extra.discountAuthorization,
        }),
      }
      try {
        onCompleted(await createQuote(body).unwrap(), { kind: 'quote' })
      } catch (saveError) {
        if (saveError.code === 'AUTHORIZATION_REQUIRED' && !extra.discountAuthorization) setAskScope('discount')
      }
      return
    }
    if (isLayaway) {
      // Apartado: el abono inicial entra a la caja; el resto queda en la cartera (D7b)
      const body = {
        idempotencyKey,
        cashSessionId: request.cashSessionId,
        customerId: customer.id,
        ...(request.priceListId !== undefined && {
          priceListId: request.priceListId,
        }),
        items: request.items,
        ...(request.globalDiscount && {
          globalDiscount: request.globalDiscount,
        }),
        payments: payments.map((payment) => ({
          paymentMethodId: Number(payment.method.id),
          amount: payment.amount,
          ...(payment.method.requiresReference && {
            paymentReference: (payment.reference ?? '').trim(),
          }),
        })),
        ...planBody(credit),
        ...(notes.trim() && { notes: notes.trim() }),
        ...(extra.discountAuthorization && {
          discountAuthorization: extra.discountAuthorization,
        }),
      }
      try {
        onCompleted(await createLayaway(body).unwrap(), { kind: 'layaway' })
      } catch (saveError) {
        if (saveError.code === 'AUTHORIZATION_REQUIRED' && !extra.discountAuthorization) setAskScope('discount')
      }
      return
    }
    const body = {
      ...request,
      idempotencyKey,
      payments: payments.map((payment) => ({
        paymentMethodId: Number(payment.method.id),
        amount: payment.amount,
        ...(payment.method.isCash && payment.received && { received: payment.received }),
        ...(payment.method.requiresReference && {
          paymentReference: (payment.reference ?? '').trim(),
        }),
      })),
      ...(mode === 'credit' && { credit: planBody(credit) }),
      ...(notes.trim() && { notes: notes.trim() }),
      ...(needsPrescription &&
        hasPrescription && {
          prescription: {
            number: prescription.number.trim(),
            veterinarianName: prescription.veterinarianName.trim(),
            ...(prescription.veterinarianLicense.trim() && {
              veterinarianLicense: prescription.veterinarianLicense.trim(),
            }),
            ...(prescription.date && { date: prescription.date }),
            ...(prescription.patient.trim() && {
              patient: prescription.patient.trim(),
            }),
          },
        }),
      ...extra,
    }
    try {
      onCompleted(await createSale(body).unwrap(), { change })
    } catch (saveError) {
      if (saveError.code === 'AUTHORIZATION_REQUIRED') {
        const missing = saveError.details?.find((detail) => !extra[detail.field])
        if (missing) setAskScope(missing.message === 'expired' ? 'expired' : 'discount')
      }
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (disabled || isLoading) return
    if (isQuote) {
      if (quoteFor.days && !(Number(quoteFor.days) >= 1 && Number(quoteFor.days) <= 120)) return setLocalError('La vigencia es de 1 a 120 días')
      return submit()
    }
    if (payments.some((payment) => !payment.method)) return setLocalError('Escoge el método de cada pago')
    if (payments.some((payment) => payment.method.requiresReference && !(payment.reference ?? '').trim())) return setLocalError('Escribe la referencia del pago')
    if (mode === 'cash' && Number(pending) !== 0)
      return setLocalError(Number(pending) > 0 ? `Faltan ${formatCurrency(pending)} por pagar` : `Los pagos pasan el total por ${formatCurrency(pending.replace('-', ''))}`)
    if (change !== null && Number(change) < 0) return setLocalError('Lo recibido en efectivo no alcanza')
    if (needsPrescription && hasPrescription && (!prescription.number.trim() || prescription.veterinarianName.trim().length < 3)) {
      return setLocalError('De la fórmula, escribe al menos el número y el nombre del veterinario (o deja todo vacío para vender sin fórmula)')
    }
    if (mode === 'credit') {
      if (!customer) return setLocalError('Para fiar, escoge el cliente arriba')
      if (Number(pending) <= 0) return setLocalError('Si paga todo, no es fiado: cámbialo a contado')
    }
    if (isLayaway) {
      if (!customer) return setLocalError('Para apartar, escoge el cliente arriba')
      if (terms && Number(paid) < Number(terms.minDownPayment)) return setLocalError(`El abono inicial mínimo es ${formatCurrency(terms.minDownPayment)} (${terms.minDownPaymentPercent} %)`)
      if (Number(pending) < 0) return setLocalError('El abono inicial no puede pasar del total')
    }
    submit()
  }

  const handleAuthorized = (result) => {
    const next = {
      ...authorizations,
      [result.scope === 'expired' ? 'expiredAuthorization' : 'discountAuthorization']: result.token,
    }
    setAuthorizations(next)
    setAskScope(null)
    reset()
    submit(next)
  }

  // Contado siempre; fiado y apartado según los permisos
  const modeOptions = quoteOnly
    ? [{ value: 'quote', label: 'Cotizar', icon: FileText }]
    : [
        { value: 'cash', label: 'Contado', icon: Banknote },
        ...(canSellOnCredit ? [{ value: 'credit', label: 'Fiado', icon: HandCoins }] : []),
        ...(canLayaway ? [{ value: 'layaway', label: 'Apartar', icon: Archive }] : []),
        ...(canQuote ? [{ value: 'quote', label: 'Cotizar', icon: FileText }] : []),
      ]

  const startMixed = () => {
    setMixed(true)
    setRows([
      {
        key: 'a',
        paymentMethodId: selectedId,
        amount: '',
        paymentReference: '',
      },
      { key: 'b', paymentMethodId: '', amount: '', paymentReference: '' },
    ])
  }
  const setRow = (key, changes) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)))

  return (
    <>
      <form ref={formRef} className="pay" onSubmit={handleSubmit} noValidate aria-label="Cobro">
        <div className="pay__head">
          <span className="pay__title">
            <Wallet aria-hidden="true" /> Pago
          </span>
          {modeOptions.length > 1 && (
            <div className="pay-mode" role="radiogroup" aria-label="¿Cómo paga?">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === option.value}
                  className={`pay-mode__option${mode === option.value ? ' pay-mode__option--active' : ''}`}
                  onClick={() => {
                    setMode(option.value)
                    setMixed(false)
                    setLocalError(null)
                  }}
                >
                  <option.icon aria-hidden="true" /> {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {(formError || localError || fieldErrors.payments) && <Alert tone="danger">{localError ?? fieldErrors.payments ?? formError}</Alert>}

        {mode === 'cash' && !mixed && (
          <div className="pay__section" key="cash">
            <MethodTiles methods={methods} value={selectedId} onChange={chooseMethod} label="Método de pago" creditBalance={customer?.creditBalance} />
            {selected?.isCash && (
              <div className="pay-cash">
                <MoneyInput id="pay-received" label="Recibido" value={received} onChange={setReceived} hint="Con cuánto paga el cliente" />
                <div className="pay-quick" role="group" aria-label="Valores rápidos">
                  {quickAmounts(totalPlain).map((amount, index) => (
                    <button key={amount} type="button" className="pay-quick__chip" onClick={() => setReceived(toInputMoney(String(amount)))}>
                      {index === 0 ? 'Exacto' : formatCurrency(String(amount))}
                    </button>
                  ))}
                </div>
                <ChangeDisplay change={change} />
              </div>
            )}
            {selected?.requiresReference && (
              <label className="pay-field">
                <span className="pay-field__label">Referencia</span>
                <span className="pay-field__control">
                  <input value={reference} maxLength={60} placeholder={`Número de la ${selected.name.toLowerCase()}`} onChange={(event) => setReference(event.target.value)} />
                </span>
              </label>
            )}
            <button type="button" className="pay__link" onClick={startMixed}>
              <Layers aria-hidden="true" /> Pagar con varios métodos
            </button>
          </div>
        )}

        {mode === 'cash' && mixed && (
          <div className="pay__section" key="mixed">
            {rows.map((row, index) => {
              const method = methodOf(row.paymentMethodId)
              return (
                <div key={row.key} className="pay-row">
                  <select aria-label={`Método del pago ${index + 1}`} value={row.paymentMethodId} onChange={(event) => setRow(row.key, { paymentMethodId: event.target.value })}>
                    <option value="">Método…</option>
                    {methods.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Valor del pago ${index + 1}`}
                    inputMode="decimal"
                    placeholder="$ 0"
                    value={row.amount}
                    onChange={(event) => setRow(row.key, { amount: event.target.value })}
                    onBlur={() =>
                      setRow(row.key, {
                        amount: toInputMoney(toApiNumber(row.amount)),
                      })
                    }
                  />
                  {method?.requiresReference && (
                    <input
                      aria-label={`Referencia del pago ${index + 1}`}
                      placeholder="Referencia"
                      value={row.paymentReference}
                      onChange={(event) =>
                        setRow(row.key, {
                          paymentReference: event.target.value,
                        })
                      }
                    />
                  )}
                  {rows.length > 1 && (
                    <button type="button" className="pay-row__remove" aria-label={`Quitar el pago ${index + 1}`} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>
                      <Trash2 aria-hidden="true" />
                    </button>
                  )}
                </div>
              )
            })}
            <p className={`pay-pending${Number(pending) === 0 ? ' pay-pending--ok' : ''}`}>
              {Number(pending) === 0 ? '¡Pagos completos!' : Number(pending) > 0 ? `Faltan ${formatCurrency(pending)}` : `Sobran ${formatCurrency(pending.replace('-', ''))}`}
            </p>
            <div className="pay__links">
              <button
                type="button"
                className="pay__link"
                onClick={() =>
                  setRows((current) => [
                    ...current,
                    {
                      key: Math.random().toString(36).slice(2),
                      paymentMethodId: '',
                      amount: Number(pending) > 0 ? toInputMoney(pending) : '',
                      paymentReference: '',
                    },
                  ])
                }
              >
                <Plus aria-hidden="true" /> Otro método
              </button>
              <button type="button" className="pay__link" onClick={() => setMixed(false)}>
                Un solo método
              </button>
            </div>
          </div>
        )}

        {mode === 'credit' && (
          <div className="pay__section" key="credit">
            {!customer && <Alert tone="warning">Para fiar, escoge el cliente arriba (con celular).</Alert>}
            <MoneyInput id="pay-now" label="¿Paga algo ahora?" value={paidNow} onChange={setPaidNow} hint="Opcional. Vacío = se lleva todo fiado." />
            {Number(toApiNumber(paidNow)) > 0 && (
              <>
                <MethodTiles methods={methods} value={selectedId} onChange={(method) => setMethodId(String(method.id))} label="Método del pago de ahora" creditBalance={customer?.creditBalance} />
                {selected?.requiresReference && (
                  <label className="pay-field">
                    <span className="pay-field__label">Referencia</span>
                    <span className="pay-field__control">
                      <input value={reference} maxLength={60} onChange={(event) => setReference(event.target.value)} />
                    </span>
                  </label>
                )}
              </>
            )}
            <div className="pay-credit">
              <span className="pay-credit__owed">
                Queda debiendo <strong>{formatCurrency(Number(pending) > 0 ? pending : '0')}</strong>
              </span>
              <PlanFields plan={credit} onChange={setCredit} defaultDueHint="Vacía = el plazo configurado (30 días)." />
            </div>
          </div>
        )}

        {isLayaway && (
          <div className="pay__section" key="layaway">
            {!customer && <Alert tone="warning">Para apartar, escoge el cliente arriba (con celular).</Alert>}
            <p className="pay-layaway__note">
              <Archive aria-hidden="true" /> El producto queda reservado con este precio y se entrega cuando pague todo.
            </p>
            <MoneyInput
              id="pay-down"
              label="Abono inicial"
              value={paidNow}
              onChange={setPaidNow}
              hint={
                terms
                  ? Number(terms.minDownPayment) > 0
                    ? `Mínimo ${formatCurrency(terms.minDownPayment)} (${terms.minDownPaymentPercent} % del total)`
                    : 'Sin abono mínimo'
                  : 'Calculando el mínimo…'
              }
            />
            {terms && Number(terms.minDownPayment) > 0 && (
              <div className="pay-quick" aria-label="Valores rápidos del abono">
                <button type="button" className="pay-quick__chip" onClick={() => setPaidNow(toInputMoney(terms.minDownPayment))}>
                  El mínimo
                </button>
                <button type="button" className="pay-quick__chip" onClick={() => setPaidNow(toInputMoney(totalPlain))}>
                  Todo
                </button>
              </div>
            )}
            {Number(toApiNumber(paidNow)) > 0 && (
              <>
                <MethodTiles methods={methods} value={selectedId} onChange={(method) => setMethodId(String(method.id))} label="Método del abono inicial" creditBalance={customer?.creditBalance} />
                {selected?.requiresReference && (
                  <label className="pay-field">
                    <span className="pay-field__label">Referencia</span>
                    <span className="pay-field__control">
                      <input value={reference} maxLength={60} onChange={(event) => setReference(event.target.value)} />
                    </span>
                  </label>
                )}
              </>
            )}
            <div className="pay-credit">
              <span className="pay-credit__owed">
                Falta por pagar <strong>{formatCurrency(Number(pending) > 0 ? pending : '0')}</strong>
              </span>
              <PlanFields plan={credit} onChange={setCredit} defaultDueHint={terms ? `Vacía = ${formatDay(terms.defaultDueDate)} (plazo configurado).` : 'Vacía = el plazo configurado.'} />
            </div>
          </div>
        )}

        {needsPrescription && (
          <div className="pay__section pay-rx" key="prescription">
            <p className="pay-layaway__note">
              <Stethoscope aria-hidden="true" /> {prescriptionProducts.join(', ')} {prescriptionProducts.length === 1 ? 'requiere' : 'requieren'} fórmula veterinaria. Escribe sus datos; si no la trae,
              se puede vender y queda «Sin fórmula» en el libro.
            </p>
            <label className="pay-field">
              <span className="pay-field__label">Número de la fórmula</span>
              <span className="pay-field__control">
                <input value={prescription.number} maxLength={40} onChange={setRx('number')} />
              </span>
            </label>
            <label className="pay-field">
              <span className="pay-field__label">Médico veterinario</span>
              <span className="pay-field__control">
                <input value={prescription.veterinarianName} maxLength={150} onChange={setRx('veterinarianName')} />
              </span>
            </label>
            <label className="pay-field">
              <span className="pay-field__label">Tarjeta profesional</span>
              <span className="pay-field__control">
                <input value={prescription.veterinarianLicense} maxLength={40} placeholder="Opcional" onChange={setRx('veterinarianLicense')} />
              </span>
            </label>
            <label className="pay-field">
              <span className="pay-field__label">Fecha de la fórmula</span>
              <span className="pay-field__control">
                <input type="date" value={prescription.date} max={todayIso()} onChange={setRx('date')} />
              </span>
            </label>
            <label className="pay-field">
              <span className="pay-field__label">Para qué animal o finca</span>
              <span className="pay-field__control">
                <input value={prescription.patient} maxLength={150} placeholder="Opcional" onChange={setRx('patient')} />
              </span>
            </label>
            {!hasPrescription && <Alert tone="warning">Sin datos, la venta queda como «Sin fórmula» en el libro de fórmulas.</Alert>}
          </div>
        )}

        {isQuote && (
          <div className="pay__section" key="quote">
            <p className="pay-layaway__note">
              <FileText aria-hidden="true" /> Solo es un precio: no cobra, no aparta mercancía y no necesita existencia. Mientras esté vigente, al venderla se respetan estos precios.
            </p>
            {!customer && (
              <>
                <label className="pay-field">
                  <span className="pay-field__label">¿Para quién?</span>
                  <span className="pay-field__control">
                    <input
                      value={quoteFor.name}
                      maxLength={150}
                      placeholder="Nombre (o escoge el cliente arriba)"
                      onChange={(event) =>
                        setQuoteFor((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </span>
                </label>
                <label className="pay-field">
                  <span className="pay-field__label">Celular</span>
                  <span className="pay-field__control">
                    <input
                      inputMode="tel"
                      value={quoteFor.phone}
                      maxLength={20}
                      placeholder="Opcional, para enviarla por WhatsApp"
                      onChange={(event) =>
                        setQuoteFor((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </span>
                </label>
              </>
            )}
            <label className="pay-field">
              <span className="pay-field__label">Vale por (días)</span>
              <span className="pay-field__control">
                <input
                  inputMode="numeric"
                  value={quoteFor.days}
                  maxLength={3}
                  placeholder="Vacío = lo configurado (15 días)"
                  onChange={(event) =>
                    setQuoteFor((current) => ({
                      ...current,
                      days: event.target.value.replace(/\D/g, ''),
                    }))
                  }
                />
              </span>
            </label>
          </div>
        )}

        <label className="pay-field">
          <span className="pay-field__label">Notas</span>
          <textarea className="pay-notes" rows={2} maxLength={255} placeholder="Opcional" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>

        <div className="pay__actions">
          <button type="button" className="pay__clear" onClick={onClear} disabled={isLoading}>
            <Eraser aria-hidden="true" /> Limpiar
          </button>
          <Button type="submit" size="lg" className="pay__confirm" icon={CheckCircle2} isLoading={isLoading} disabled={disabled}>
            {mode === 'credit' ? 'Registrar fiado' : isLayaway ? 'Apartar' : isQuote ? 'Cotizar' : 'Cobrar'} {formatCurrency(String(animatedTotal))} <kbd>F2</kbd>
          </Button>
        </div>
      </form>

      {/* Fuera del formulario: el envío de la clave no debe enviar también la venta */}
      {askScope && (
        <AuthorizationModal
          scope={askScope}
          onClose={() => {
            setAskScope(null)
            reset()
          }}
          onAuthorized={handleAuthorized}
        />
      )}
    </>
  )
})
