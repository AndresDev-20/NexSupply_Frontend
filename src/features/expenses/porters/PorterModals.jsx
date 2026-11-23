import { useState } from 'react'
import { Banknote, HandCoins, Truck, UserRound } from 'lucide-react'
import { useAddPorterTripMutation, useCreatePorterMutation, useGetPortersQuery, usePayPorterMutation, useUpdatePorterMutation } from './portersApi'
import { useGetCashSessionsQuery } from '../../cash/cashApi'
import { usePaymentMethodInfo } from '../../purchases/detail/paymentHelpers'
import { newSaleKey } from '../../sales/saleOptions'
import { useCan } from '../../../hooks/usePermissions'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { Switch } from '../../../components/ui/Switch/Switch'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { formatCurrency, formatDateTime } from '../../../utils/format'
import { MONEY_PATTERN, toApiNumber, toInputMoney } from '../../../utils/numberInput'
import '../../admin/admin.css'

/** Registrar o editar un cotero: nombre, documento, celular y tarifa por viaje. */
export function PorterFormModal({ porter, onClose, onSaved }) {
  const isEdit = Boolean(porter)
  const [form, setForm] = useState({ name: porter?.name ?? '', documentNumber: porter?.documentNumber ?? '', phone: porter?.phone ?? '', tripRate: toInputMoney(porter?.tripRate), notes: porter?.notes ?? '' })
  const [localErrors, setLocalErrors] = useState({})
  const [createPorter, createState] = useCreatePorterMutation()
  const [updatePorter, updateState] = useUpdatePorterMutation()
  const { isLoading, error } = isEdit ? updateState : createState
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }
  const bind = (name) => ({ value: form[name], error: fieldErrors[name], onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })) })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const rate = toApiNumber(form.tripRate)
    const errors = {}
    if (form.name.trim().length < 2) errors.name = 'Escribe el nombre del cotero'
    if (!MONEY_PATTERN.test(rate)) errors.tripRate = 'Escribe cuánto se le paga por viaje (ej. 3.000)'
    setLocalErrors(errors)
    if (Object.keys(errors).length) return
    const body = { name: form.name.trim(), documentNumber: form.documentNumber.trim() || null, phone: form.phone.trim() || null, tripRate: rate, notes: form.notes.trim() || null }
    try {
      onSaved(isEdit ? await updatePorter({ id: porter.id, ...body }).unwrap() : await createPorter(body).unwrap(), isEdit)
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      icon={UserRound}
      title={isEdit ? 'Editar cotero' : 'Nuevo cotero'}
      description="Quien lleva la mercancía al carro de línea de la vereda."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="porter-form" isLoading={isLoading}>
            {isEdit ? 'Guardar cambios' : 'Registrar cotero'}
          </Button>
        </>
      }
    >
      <form id="porter-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={UserRound} title="Datos">
          <TextField label="Nombre" data-autofocus maxLength={150} required {...bind('name')} />
          <TextField label="Cédula" maxLength={20} {...bind('documentNumber')} />
          <TextField label="Celular" inputMode="tel" maxLength={20} {...bind('phone')} />
          <TextField
            label="Valor por viaje"
            icon={Banknote}
            inputMode="decimal"
            placeholder="Ej.: 3.000"
            hint="Se propone al anotar cada viaje; se puede cambiar en el viaje."
            required
            {...bind('tripRate')}
            onBlur={() => setForm((current) => ({ ...current, tripRate: toInputMoney(toApiNumber(current.tripRate)) }))}
          />
          <TextField className="form-section__full" label="Notas" maxLength={255} {...bind('notes')} />
        </FormSection>
      </form>
    </Modal>
  )
}

/**
 * Anotar un viaje al carro de línea. Con `porter` fijo (desde su ficha) o escogiéndolo (desde una
 * venta: saleId y el cliente en la descripción).
 */
export function TripModal({ porter: fixedPorter = null, saleId = null, saleLabel = null, onClose, onSaved }) {
  const { data: porters = [] } = useGetPortersQuery({ isActive: 'true' }, { skip: Boolean(fixedPorter) })
  const [porterId, setPorterId] = useState(fixedPorter ? String(fixedPorter.id) : '')
  const porter = fixedPorter ?? porters.find((row) => String(row.id) === porterId) ?? null
  const [amount, setAmount] = useState(fixedPorter ? toInputMoney(fixedPorter.tripRate) : '')
  const [description, setDescription] = useState(saleLabel ?? '')
  const [localError, setLocalError] = useState(null)
  const [addTrip, state] = useAddPorterTripMutation()
  const { fieldErrors, formError } = splitApiError(state.error)

  const choose = (id) => {
    setPorterId(id)
    const chosen = porters.find((row) => String(row.id) === id)
    if (chosen) setAmount(toInputMoney(chosen.tripRate))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const value = toApiNumber(amount)
    if (!porter) return setLocalError('Escoge el cotero')
    if (!MONEY_PATTERN.test(value) || Number(value) <= 0) return setLocalError('Escribe cuánto se le paga por este viaje')
    try {
      onSaved(await addTrip({ porterId: porter.id, amount: value, ...(saleId && { saleId }), ...(description.trim() && { description: description.trim() }) }).unwrap())
    } catch {
      // Se muestra desde state.error
    }
    return undefined
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={state.isLoading}
      icon={Truck}
      title="Anotar viaje al carro de línea"
      description={saleLabel ? `Lleva la mercancía de ${saleLabel}. Suma a lo que se le debe al cotero.` : 'Suma a lo que se le debe al cotero.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={state.isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="trip-form" isLoading={state.isLoading}>
            Anotar viaje
          </Button>
        </>
      }
    >
      <form id="trip-form" onSubmit={handleSubmit} noValidate>
        {(formError || localError) && (
          <div className="admin-form__alert">
            <Alert tone="danger">{localError ?? formError}</Alert>
          </div>
        )}
        {!fixedPorter &&
          (porters.length === 0 ? (
            <Alert tone="warning">No hay coteros registrados: regístralos en Gastos → Coteros.</Alert>
          ) : (
            <SelectField label="Cotero" placeholder="Escoge…" options={porters.map((row) => ({ value: String(row.id), label: row.name }))} value={porterId} onChange={(event) => choose(event.target.value)} required />
          ))}
        <TextField label="Valor del viaje" icon={Banknote} inputMode="decimal" data-autofocus={Boolean(fixedPorter) || undefined} value={amount} onChange={(event) => setAmount(event.target.value)} error={fieldErrors.amount} required />
        <TextField label="Detalle" placeholder="Ej.: 4 bultos al carro de la vereda El Tambo" maxLength={255} value={description} onChange={(event) => setDescription(event.target.value)} />
      </form>
    </Modal>
  )
}

/** Pagar los viajes pendientes de un cotero. Queda como gasto (y, si sale del cajón, del turno). */
export function PayPorterModal({ porter, onClose, onSaved }) {
  const canViewCash = useCan('cash.view')
  const [form, setForm] = useState({ paymentMethodId: '', paymentReference: '', fromCash: true, cashSessionId: '' })
  const [idempotencyKey] = useState(newSaleKey)
  const [localError, setLocalError] = useState(null)
  const { methods, method } = usePaymentMethodInfo(form.paymentMethodId)
  const { data: sessionsData } = useGetCashSessionsQuery({ status: 'open', pageSize: 50 }, { skip: !canViewCash })
  const sessions = sessionsData?.rows ?? []
  const sessionId = form.cashSessionId || (sessions.length === 1 ? String(sessions[0].id) : '')
  const [pay, state] = usePayPorterMutation()
  const { formError } = splitApiError(state.error)
  const fromCash = Boolean(form.fromCash && method?.isCash)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!method) return setLocalError('Escoge el método de pago')
    if (method.requiresReference && !form.paymentReference.trim()) return setLocalError(`${method.name} pide el número de referencia`)
    if (fromCash && !sessionId) return setLocalError('Escoge el turno de caja de donde sale el dinero')
    try {
      onSaved(
        await pay({
          porterId: porter.id,
          idempotencyKey,
          paymentMethodId: Number(method.id),
          ...(method.requiresReference && { paymentReference: form.paymentReference.trim() }),
          fromCash,
          ...(fromCash && { cashSessionId: Number(sessionId) }),
        }).unwrap(),
      )
    } catch {
      // Se muestra desde state.error
    }
    return undefined
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={state.isLoading}
      icon={HandCoins}
      title={`Pagarle a ${porter.name}`}
      description={`${porter.pendingTrips} ${porter.pendingTrips === 1 ? 'viaje pendiente' : 'viajes pendientes'} por ${formatCurrency(porter.pendingAmount)}. Queda como gasto en la categoría Coteros.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={state.isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="pay-porter-form" isLoading={state.isLoading}>
            Pagar {formatCurrency(porter.pendingAmount)}
          </Button>
        </>
      }
    >
      <form id="pay-porter-form" onSubmit={handleSubmit} noValidate>
        {(formError || localError) && (
          <div className="admin-form__alert">
            <Alert tone="danger">{localError ?? formError}</Alert>
          </div>
        )}
        <SelectField
          label="Método de pago"
          placeholder="Escoge…"
          options={methods.map((row) => ({ value: String(row.id), label: row.name }))}
          value={form.paymentMethodId}
          onChange={(event) => setForm((current) => ({ ...current, paymentMethodId: event.target.value }))}
          required
        />
        {method?.requiresReference && <TextField label="Referencia" maxLength={60} value={form.paymentReference} onChange={(event) => setForm((current) => ({ ...current, paymentReference: event.target.value }))} required />}
        {method?.isCash && (
          <>
            <Switch label="Salió de la caja" description="El dinero se saca del cajón: baja el efectivo del turno y cuadra el arqueo." checked={form.fromCash} onChange={(checked) => setForm((current) => ({ ...current, fromCash: checked }))} />
            {form.fromCash &&
              (sessions.length === 0 ? (
                <Alert tone="warning">No hay ningún turno abierto. Apaga «Salió de la caja» si el dinero no sale del cajón.</Alert>
              ) : (
                <SelectField
                  label="Turno de caja"
                  options={sessions.map((row) => ({ value: String(row.id), label: `${row.register?.name} · abierta ${formatDateTime(row.openedAt)}` }))}
                  value={sessionId}
                  onChange={(event) => setForm((current) => ({ ...current, cashSessionId: event.target.value }))}
                />
              ))}
          </>
        )}
      </form>
    </Modal>
  )
}
