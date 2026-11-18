import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Banknote, CalendarClock, Clock, PiggyBank, Store, Zap } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextField } from '../../../components/ui/TextField/TextField'
import { Switch } from '../../../components/ui/Switch/Switch'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { selectCurrentUser } from '../../auth/authSlice'
import { splitApiError } from '../../../utils/formErrors'
import { formatCurrency } from '../../../utils/format'
import { MONEY_PATTERN, toApiNumber, toInputMoney } from '../../../utils/numberInput'
import { useCreateCashRegisterMutation, useUpdateCashRegisterMutation } from '../cashApi'
import '../../admin/admin.css'

/**
 * Crear o editar una caja (D-CAJA-9): nombre, sucursal, base fija del día, horario y el
 * interruptor "Automática" (se abre y se cierra sola a sus horas).
 */
export function CashRegisterFormModal({ register, onClose, onSaved }) {
  const isEdit = Boolean(register)
  const branch = useSelector(selectCurrentUser)?.branch
  const [form, setForm] = useState({
    name: register?.name ?? '',
    baseAmount: register ? toInputMoney(register.baseAmount) : '',
    openingTime: register?.openingTime ?? '',
    closingTime: register?.closingTime ?? '',
    automatic: register?.automatic ?? false,
  })
  const [localErrors, setLocalErrors] = useState({})
  const [createRegister, createState] = useCreateCashRegisterMutation()
  const [updateRegister, updateState] = useUpdateCashRegisterMutation()
  const { isLoading, error } = isEdit ? updateState : createState
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }
  const base = toApiNumber(form.baseAmount)

  const set = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    const name = form.name.trim()
    if (name.length < 2) errors.name = 'Escribe el nombre de la caja (ej. Caja principal)'
    if (!MONEY_PATTERN.test(base)) errors.baseAmount = 'Escribe la base con que arranca cada día (ej. 200.000; puede ser 0)'
    if (form.automatic && !form.openingTime) errors.openingTime = 'Para abrirse sola necesita la hora de apertura'
    if (form.automatic && !form.closingTime) errors.closingTime = 'Para cerrarse sola necesita la hora de cierre'
    // Las horas "HH:MM" se comparan bien como texto
    if (form.openingTime && form.closingTime && form.openingTime >= form.closingTime) errors.closingTime = 'La hora de cierre debe ser posterior a la de apertura'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    const body = { name, baseAmount: base, openingTime: form.openingTime || null, closingTime: form.closingTime || null, automatic: form.automatic }
    try {
      const saved = isEdit ? await updateRegister({ id: register.id, ...body }).unwrap() : await createRegister(body).unwrap()
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
      icon={Banknote}
      title={isEdit ? `Editar ${register.name}` : 'Nueva caja'}
      description="Cada caja tiene su base del día, su horario y sus turnos."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="cash-register-form" isLoading={isLoading}>
            {isEdit ? 'Guardar cambios' : 'Crear caja'}
          </Button>
        </>
      }
    >
      <form id="cash-register-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={Banknote} title="Caja">
          <TextField label="Nombre" placeholder="Ej.: Caja principal" maxLength={60} data-autofocus value={form.name} onChange={(event) => set('name', event.target.value)} error={fieldErrors.name} required />
          <TextField label="Sucursal" icon={Store} value={branch?.name ?? 'Sucursal principal'} readOnly hint="La caja queda en tu sucursal." />
          <TextField
            className="form-section__full"
            label="Base del día"
            icon={PiggyBank}
            inputMode="decimal"
            placeholder="Ej.: 200.000"
            hint={MONEY_PATTERN.test(base) ? `Cada día arranca con ${formatCurrency(base)}. Al contar, la base se queda en el cajón y se entrega el resto.` : 'Con cuánto arranca la caja cada día.'}
            value={form.baseAmount}
            onChange={(event) => set('baseAmount', event.target.value)}
            error={fieldErrors.baseAmount}
            required
          />
        </FormSection>

        <FormSection icon={CalendarClock} title="Horario" description="En la hora del negocio.">
          <TextField label="Hora de apertura" icon={Clock} type="time" value={form.openingTime} onChange={(event) => set('openingTime', event.target.value)} error={fieldErrors.openingTime} />
          <TextField label="Hora de cierre" icon={Clock} type="time" value={form.closingTime} onChange={(event) => set('closingTime', event.target.value)} error={fieldErrors.closingTime} />
          <div className="form-section__full">
            <Switch
              label="Automática"
              description="Se abre sola todos los días a la hora de apertura y se cierra sola a la hora de cierre (queda pendiente por contar). Igual se puede cerrar a mano cuando quieras. Los días sin abrir no se abre."
              checked={form.automatic}
              onChange={(value) => set('automatic', value)}
            />
          </div>
          {form.automatic && (
            <p className="register-form__auto form-section__full">
              <Zap aria-hidden="true" /> {form.openingTime && form.closingTime ? `Abre a las ${form.openingTime} y cierra a las ${form.closingTime}.` : 'Escribe las dos horas.'}
            </p>
          )}
        </FormSection>
      </form>
    </Modal>
  )
}
