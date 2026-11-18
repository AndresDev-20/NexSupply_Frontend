import { useState } from 'react'
import { Ban, Gift, Hash, Minus, PackageCheck, Plus, ShieldAlert, TriangleAlert, Undo2, Wallet } from 'lucide-react'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { TextField } from '../../components/ui/TextField/TextField'
import { SelectField } from '../../components/ui/SelectField/SelectField'
import { TextAreaField } from '../../components/ui/TextAreaField/TextAreaField'
import { FormSection } from '../../components/ui/FormSection/FormSection'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import { Alert } from '../../components/feedback/Alert/Alert'
import { useCan } from '../../hooks/usePermissions'
import { splitApiError } from '../../utils/formErrors'
import { toApiNumber, toInputNumber } from '../../utils/numberInput'
import { formatCurrency, formatDateTime, formatQuantity } from '../../utils/format'
import { usePaymentMethodInfo } from '../purchases/detail/paymentHelpers'
import { useGetCashSessionsQuery } from '../cash/cashApi'
import { AuthorizationModal } from '../sales/pos/AuthorizationModal'
import { newSaleKey } from '../sales/saleOptions'
import { useCancelSaleMutation, useCreateSaleReturnMutation, useGetReturnableQuery } from './returnsApi'
import '../admin/admin.css'
import './returns.css'

// Campo de la autorización que pide el servidor → alcance de la clave de supervisor
const SCOPE_BY_FIELD = { returnAuthorization: 'return', returnLateAuthorization: 'return_late', cancelAuthorization: 'cancel' }

/** Valor aproximado de lo que se devuelve: el oficial lo calcula el servidor (cuadra al peso). */
function estimate(line, quantity) {
  const sold = Number(line.quantity)
  if (!sold || !quantity) return 0
  return Math.round((Number(line.total) * quantity) / sold)
}

function QuantityStepper({ label, value, max, onChange }) {
  const number = Number(toApiNumber(value)) || 0
  const step = (delta) => onChange(toInputNumber(String(Math.min(max, Math.max(0, number + delta)))))
  return (
    <span className="return-stepper">
      <button type="button" aria-label={`Quitar 1 a ${label}`} onClick={() => step(-1)} disabled={number <= 0}>
        <Minus aria-hidden="true" />
      </button>
      <input aria-label={`Cantidad a devolver de ${label}`} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} onFocus={(event) => event.target.select()} />
      <button type="button" aria-label={`Sumar 1 a ${label}`} onClick={() => step(1)} disabled={number >= max}>
        <Plus aria-hidden="true" />
      </button>
    </span>
  )
}

/**
 * Devolución de una venta (D-DEV-1 a D-DEV-8): cuánto de cada producto, si vuelve a la venta o va a
 * cuarentena, el motivo y cómo se reintegra (en fiado primero baja la deuda). Si falta el permiso o
 * pasó el plazo, pide la clave de un supervisor y reintenta sola.
 */
export function ReturnModal({ saleId, onClose, onSaved }) {
  const canViewCash = useCan('cash.view')
  const { data, isLoading, error } = useGetReturnableQuery(saleId)
  const { data: sessionsData } = useGetCashSessionsQuery({ status: 'open', pageSize: 50 }, { skip: !canViewCash })
  const sessions = sessionsData?.rows ?? []
  const { methods } = usePaymentMethodInfo('')
  const [quantities, setQuantities] = useState({})
  const [conditions, setConditions] = useState({})
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState('money')
  const [methodId, setMethodId] = useState('')
  const [reference, setReference] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [localError, setLocalError] = useState(null)
  const [authorizations, setAuthorizations] = useState({})
  const [askScope, setAskScope] = useState(null)
  const [idempotencyKey] = useState(newSaleKey)
  const [createReturn, { isLoading: isSaving, error: saveError, reset }] = useCreateSaleReturnMutation()
  const { fieldErrors, formError } = splitApiError(saveError?.code === 'AUTHORIZATION_REQUIRED' ? null : saveError)

  if (isLoading) {
    return (
      <Modal isOpen onClose={onClose} icon={Undo2} title="Devolución">
        <Spinner label="Cargando la venta…" />
      </Modal>
    )
  }
  if (error) {
    return (
      <Modal isOpen onClose={onClose} icon={Undo2} title="Devolución">
        <Alert tone="danger">{error.message}</Alert>
      </Modal>
    )
  }

  const { sale, lines } = data
  const isFinalConsumer = sale.customer?.isFinalConsumer
  const cashMethod = methods.find((item) => item.isCash)
  const refundMethods = methods.filter((item) => !item.isCustomerCredit)
  const chosenMethodId = methodId || (cashMethod ? String(cashMethod.id) : '')
  const chosenMethod = refundMethods.find((item) => String(item.id) === chosenMethodId)
  const chosenSession = sessionId || (sessions.length === 1 ? String(sessions[0].id) : '')
  const refundMode = isFinalConsumer ? 'money' : mode
  const quantityOf = (line) => Number(toApiNumber(quantities[line.saleItemId] ?? '')) || 0
  const selected = lines.filter((line) => quantityOf(line) > 0)
  const total = selected.reduce((sum, line) => sum + estimate(line, quantityOf(line)), 0)
  const isCredit = sale.saleType === 'credit' && sale.receivable && Number(sale.receivable.balance) > 0

  const submit = async (extra = authorizations) => {
    setLocalError(null)
    const body = {
      idempotencyKey,
      saleId: sale.id,
      reason: reason.trim(),
      items: selected.map((line) => ({ saleItemId: line.saleItemId, quantity: toApiNumber(quantities[line.saleItemId]), condition: conditions[line.saleItemId] ?? 'sellable' })),
      refund: refundMode === 'credit' ? { mode: 'credit' } : { mode: 'money', ...(chosenMethod && { paymentMethodId: chosenMethod.id }), ...(chosenMethod?.requiresReference && { paymentReference: reference.trim() }) },
      ...(refundMode === 'money' && chosenSession && { cashSessionId: Number(chosenSession) }),
      ...extra,
    }
    try {
      onSaved(await createReturn(body).unwrap())
    } catch (failure) {
      if (failure.code === 'AUTHORIZATION_REQUIRED') {
        const missing = failure.details?.find((detail) => !extra[detail.field])
        if (missing) setAskScope(SCOPE_BY_FIELD[missing.field])
      }
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (selected.length === 0) return setLocalError('Escribe cuánto devuelve de al menos un producto')
    const over = selected.find((line) => quantityOf(line) > Number(line.returnableQuantity))
    if (over) return setLocalError(`De ${over.productName} solo se pueden devolver ${formatQuantity(over.returnableQuantity)}`)
    if (reason.trim().length < 5) return setLocalError('Escribe el motivo (mínimo 5 caracteres)')
    if (refundMode === 'money' && !isCredit) {
      if (!chosenSession) return setLocalError('El dinero sale de la caja: escoge el turno abierto')
      if (chosenMethod?.requiresReference && !reference.trim()) return setLocalError(`${chosenMethod.name} pide el número de referencia`)
    }
    submit()
    return undefined
  }

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        isBusy={isSaving}
        size="lg"
        icon={Undo2}
        title={`Devolución de la venta ${sale.number}`}
        description={`${sale.customer?.isFinalConsumer ? 'Consumidor final' : sale.customer?.name} · ${formatDateTime(sale.createdAt)} · total ${formatCurrency(sale.total)}`}
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" form="sale-return-form" icon={Undo2} isLoading={isSaving} disabled={selected.length === 0}>
              Devolver {total > 0 ? formatCurrency(String(total)) : ''}
            </Button>
          </>
        }
      >
        <form id="sale-return-form" onSubmit={handleSubmit} noValidate>
          {(formError || localError || fieldErrors['refund.mode'] || fieldErrors.cashSessionId || fieldErrors.items) && (
            <div className="admin-form__alert">
              <Alert tone="danger">{localError ?? fieldErrors['refund.mode'] ?? fieldErrors.cashSessionId ?? fieldErrors.items ?? formError}</Alert>
            </div>
          )}
          {data.isLate && (
            <div className="admin-form__alert">
              <Alert tone="warning" title={`La venta tiene ${data.daysSinceSale} días`}>
                El plazo para devolver es de {data.maxDays} días: se pedirá la clave de un supervisor.
              </Alert>
            </div>
          )}

          <FormSection icon={PackageCheck} title="¿Qué devuelve?">
            <ul className="return-lines form-section__full">
              {lines.map((line) => {
                const max = Number(line.returnableQuantity)
                const quantity = quantityOf(line)
                const condition = conditions[line.saleItemId] ?? 'sellable'
                return (
                  <li key={line.saleItemId} className={`return-line${quantity > 0 ? ' return-line--on' : ''}${max <= 0 ? ' return-line--done' : ''}`}>
                    <span className="return-line__info">
                      <strong>{line.productName}</strong>
                      <small>
                        Vendido {formatQuantity(line.quantity)} {line.presentationName ?? line.unitSymbol}
                        {Number(line.returnedQuantity) > 0 && ` · ya devuelto ${formatQuantity(line.returnedQuantity)}`}
                        {max <= 0 && ' · ya se devolvió todo'}
                      </small>
                    </span>
                    {max > 0 && (
                      <>
                        <QuantityStepper label={line.productName} value={quantities[line.saleItemId] ?? ''} max={max} onChange={(value) => setQuantities((current) => ({ ...current, [line.saleItemId]: value }))} />
                        <span className="return-line__value">{quantity > 0 ? formatCurrency(String(estimate(line, quantity))) : '—'}</span>
                        {quantity > 0 && (
                          <span className="return-condition" role="radiogroup" aria-label={`Estado de ${line.productName}`}>
                            <button type="button" role="radio" aria-checked={condition === 'sellable'} className={condition === 'sellable' ? 'is-active' : undefined} onClick={() => setConditions((current) => ({ ...current, [line.saleItemId]: 'sellable' }))}>
                              <PackageCheck aria-hidden="true" /> Vuelve a la venta
                            </button>
                            <button type="button" role="radio" aria-checked={condition === 'quarantine'} className={condition === 'quarantine' ? 'is-active is-quarantine' : undefined} onClick={() => setConditions((current) => ({ ...current, [line.saleItemId]: 'quarantine' }))}>
                              <ShieldAlert aria-hidden="true" /> Cuarentena
                            </button>
                          </span>
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="form-section__full return-hint">
              <TriangleAlert aria-hidden="true" /> «Cuarentena»: vencido, dañado o abierto. No vuelve a la venta hasta que alguien lo revise.
            </p>
          </FormSection>

          <FormSection icon={Wallet} title={total > 0 ? `Reintegro: ${formatCurrency(String(total))} aprox.` : 'Reintegro'}>
            {isCredit && (
              <div className="form-section__full">
                <Alert tone="info">Es una venta fiada: primero baja lo que debe ({formatCurrency(sale.receivable.balance)}). Si sobra, se reintegra como escojas abajo.</Alert>
              </div>
            )}
            <div className="form-section__full return-modes" role="radiogroup" aria-label="Cómo se reintegra">
              <button type="button" role="radio" aria-checked={refundMode === 'money'} className={`return-mode${refundMode === 'money' ? ' is-active' : ''}`} onClick={() => setMode('money')}>
                <Wallet aria-hidden="true" />
                <span>
                  <strong>Devolver el dinero</strong>
                  <small>Sale de la caja</small>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={refundMode === 'credit'}
                className={`return-mode${refundMode === 'credit' ? ' is-active' : ''}`}
                onClick={() => setMode('credit')}
                disabled={isFinalConsumer}
                title={isFinalConsumer ? 'A Consumidor final solo se le devuelve dinero' : undefined}
              >
                <Gift aria-hidden="true" />
                <span>
                  <strong>Saldo a favor</strong>
                  <small>{isFinalConsumer ? 'Solo con cliente registrado' : 'Para un cambio o una compra después'}</small>
                </span>
              </button>
            </div>
            {refundMode === 'money' && (
              <>
                <SelectField label="Se devuelve en" options={refundMethods.map((item) => ({ value: String(item.id), label: item.name }))} value={chosenMethodId} onChange={(event) => setMethodId(event.target.value)} />
                {chosenMethod?.requiresReference && <TextField label="Referencia" icon={Hash} maxLength={60} value={reference} onChange={(event) => setReference(event.target.value)} />}
                {sessions.length === 0 ? (
                  <div className="form-section__full">
                    <Alert tone="warning">No hay ninguna caja abierta: abre un turno para devolver dinero, o deja el valor como saldo a favor.</Alert>
                  </div>
                ) : (
                  <SelectField
                    label="Sale de la caja"
                    placeholder="Selecciona el turno…"
                    options={sessions.map((session) => ({ value: String(session.id), label: `${session.register?.name} · abierta ${formatDateTime(session.openedAt)}` }))}
                    value={chosenSession}
                    onChange={(event) => setSessionId(event.target.value)}
                  />
                )}
              </>
            )}
          </FormSection>

          <FormSection icon={TriangleAlert} title="Motivo">
            <TextAreaField className="form-section__full" label="¿Por qué devuelve?" rows={2} maxLength={255} required placeholder="Ej.: se equivocó de referencia" value={reason} onChange={(event) => setReason(event.target.value)} error={fieldErrors.reason} />
          </FormSection>
        </form>
      </Modal>
      {askScope && (
        <AuthorizationModal
          scope={askScope}
          onClose={() => {
            setAskScope(null)
            reset()
          }}
          onAuthorized={(result) => {
            const field = Object.keys(SCOPE_BY_FIELD).find((key) => SCOPE_BY_FIELD[key] === result.scope)
            const next = { ...authorizations, [field]: result.token }
            setAuthorizations(next)
            setAskScope(null)
            reset()
            submit(next)
          }}
        />
      )}
    </>
  )
}

/** Anular una venta (D-DEV-2): solo con su turno abierto. Pide la clave si falta el permiso. */
export function CancelSaleModal({ sale, onClose, onSaved }) {
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState(null)
  const [askScope, setAskScope] = useState(false)
  const [cancelSale, { isLoading, error, reset }] = useCancelSaleMutation()
  const { fieldErrors, formError } = splitApiError(error?.code === 'AUTHORIZATION_REQUIRED' ? null : error)

  const submit = async (cancelAuthorization) => {
    try {
      onSaved(await cancelSale({ id: sale.id, reason: reason.trim(), ...(cancelAuthorization && { cancelAuthorization }) }).unwrap())
    } catch (failure) {
      if (failure.code === 'AUTHORIZATION_REQUIRED' && !cancelAuthorization) setAskScope(true)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (reason.trim().length < 5) return setLocalError('Escribe el motivo (mínimo 5 caracteres)')
    setLocalError(null)
    submit()
    return undefined
  }

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        isBusy={isLoading}
        icon={Ban}
        title={`Anular la venta ${sale.number}`}
        description={`Total ${formatCurrency(sale.total)}. Todo vuelve al inventario y cada pago se devuelve por su medio (lo de la caja sale del mismo turno).`}
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={isLoading}>
              Volver
            </Button>
            <Button type="submit" form="sale-cancel-form" variant="danger" icon={Ban} isLoading={isLoading}>
              Anular venta
            </Button>
          </>
        }
      >
        <form id="sale-cancel-form" onSubmit={handleSubmit} noValidate>
          {(formError || localError) && (
            <div className="admin-form__alert">
              <Alert tone="danger">{localError ?? formError}</Alert>
            </div>
          )}
          <p className="return-hint">Solo se anula mientras el turno de la venta sigue abierto. Después, se hace una devolución.</p>
          <TextAreaField label="Motivo" rows={2} maxLength={255} required placeholder="Ej.: se registró dos veces" value={reason} onChange={(event) => setReason(event.target.value)} error={fieldErrors.reason} />
        </form>
      </Modal>
      {askScope && (
        <AuthorizationModal
          scope="cancel"
          onClose={() => {
            setAskScope(false)
            reset()
          }}
          onAuthorized={(result) => {
            setAskScope(false)
            reset()
            submit(result.token)
          }}
        />
      )}
    </>
  )
}
