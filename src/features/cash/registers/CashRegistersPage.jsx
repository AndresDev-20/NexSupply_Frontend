import { useState } from 'react'
import { Banknote, CalendarClock, CalendarOff, CalendarPlus, Pencil, PiggyBank, Plus, Power, Trash2, Zap } from 'lucide-react'
import { useAddClosedDayMutation, useGetCashRegistersQuery, useGetClosedDaysQuery, useRemoveClosedDayMutation, useSetCashRegisterActiveMutation } from '../cashApi'
import { scheduleLabel, sessionState } from '../cashOptions'
import { CashRegisterFormModal } from './CashRegisterFormModal'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Switch } from '../../../components/ui/Switch/Switch'
import { TextField } from '../../../components/ui/TextField/TextField'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { splitApiError } from '../../../utils/formErrors'
import { formatCurrency } from '../../../utils/format'
import { BUSINESS_LOCALE, BUSINESS_TIMEZONE } from '../../../config/env'
import '../../admin/admin.css'
import '../cash.css'

const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE }).format(new Date())
const weekday = new Intl.DateTimeFormat(BUSINESS_LOCALE, { timeZone: 'UTC', weekday: 'long' })
const monthShort = new Intl.DateTimeFormat(BUSINESS_LOCALE, { timeZone: 'UTC', month: 'short' })

/** Días sin abrir (D-CAJA-11): festivos o días en que la agropecuaria no abre. */
function ClosedDays() {
  const toast = useToast()
  const { data: days = [], isLoading } = useGetClosedDaysQuery()
  const [addDay, addState] = useAddClosedDayMutation()
  const [removeDay] = useRemoveClosedDayMutation()
  const [form, setForm] = useState({ date: '', reason: '' })
  const [localErrors, setLocalErrors] = useState({})
  const { fieldErrors: serverErrors, formError } = splitApiError(addState.error)
  const fieldErrors = { ...serverErrors, ...localErrors }

  const set = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
    if (addState.error) addState.reset()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!form.date) errors.date = 'Elige el día'
    if (form.reason.trim().length < 3) errors.reason = 'Escribe el motivo (ej. Festivo)'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    try {
      await addDay({ date: form.date, reason: form.reason.trim() }).unwrap()
      toast.success('Día sin abrir guardado')
      setForm({ date: '', reason: '' })
    } catch {
      // Se muestra desde `addState.error`
    }
  }

  const handleRemove = async (day) => {
    try {
      await removeDay(day.id).unwrap()
      toast.success('Día sin abrir quitado')
    } catch (removeError) {
      toast.error(removeError.message)
    }
  }

  return (
    <section className="cash-panel closed-days" aria-labelledby="closed-days-title">
      <div className="closed-days__intro">
        <span className="closed-days__icon" aria-hidden="true">
          <CalendarOff />
        </span>
        <div>
          <h3 className="closed-days__title" id="closed-days-title">
            Días sin abrir
          </h3>
          <p className="closed-days__description">Festivos o días en que no se abre. Ese día ninguna caja se abre sola, y abrirla a mano pide confirmación.</p>
        </div>
      </div>

      <form className="closed-days__form" onSubmit={handleSubmit} noValidate>
        <TextField label="Día" type="date" min={todayIso()} value={form.date} onChange={(event) => set('date', event.target.value)} error={fieldErrors.date} required />
        <TextField label="Motivo" placeholder="Ej.: Festivo de Reyes" maxLength={120} value={form.reason} onChange={(event) => set('reason', event.target.value)} error={fieldErrors.reason ?? formError} required />
        <Button type="submit" icon={CalendarPlus} isLoading={addState.isLoading}>
          Marcar día
        </Button>
      </form>

      {isLoading ? (
        <Spinner label="Cargando días…" />
      ) : days.length === 0 ? (
        <p className="cash-panel__empty">No hay días sin abrir marcados.</p>
      ) : (
        <ul className="closed-days__list">
          {days.map((day, index) => {
            const date = new Date(`${day.date}T12:00:00Z`)
            return (
              <li key={day.id} className={`closed-day${day.date === todayIso() ? ' closed-day--today' : ''}`} style={{ '--delay': `${index * 50}ms` }}>
                <span className="closed-day__date" aria-hidden="true">
                  <span className="closed-day__month">{monthShort.format(date).replace('.', '')}</span>
                  <span className="closed-day__number">{day.date.slice(8, 10)}</span>
                </span>
                <span className="closed-day__text">
                  <span className="closed-day__reason">{day.reason}</span>
                  <span className="closed-day__weekday">{day.date === todayIso() ? 'Hoy' : weekday.format(date)}</span>
                </span>
                <IconButton icon={Trash2} tone="danger" label={`Quitar ${day.reason} (${day.date})`} onClick={() => handleRemove(day)} />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Cajas de la sucursal: nombre, base del día, horario y si es automática (cash.manage). */
export default function CashRegistersPage() {
  const toast = useToast()
  const [showInactive, setShowInactive] = useState(false)
  const { data: registers = [], isLoading } = useGetCashRegistersQuery({ includeInactive: showInactive })
  const [setActive, toggleState] = useSetCashRegisterActiveMutation()
  const [editing, setEditing] = useState(null)
  const [toToggle, setToToggle] = useState(null)

  const handleToggle = async () => {
    try {
      const updated = await setActive({ id: toToggle.id, active: !toToggle.isActive }).unwrap()
      toast.success(updated.isActive ? `${updated.name} fue activada` : `${updated.name} fue desactivada`)
    } catch (toggleError) {
      toast.error(toggleError.message)
    }
    setToToggle(null)
  }

  return (
    <>
      <PageHeader
        description="Tus cajas con su base del día y su horario. Marca también los días en que no se abre."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Nueva caja
          </Button>
        }
      />

      <div className="cash-toolbar">
        <Switch label="Mostrar inactivas" checked={showInactive} onChange={setShowInactive} />
      </div>

      {isLoading ? (
        <div className="cash-page__state">
          <Spinner size="lg" label="Cargando cajas…" />
        </div>
      ) : registers.length === 0 ? (
        <StatusMessage icon={Banknote} title="Aún no hay cajas" description='Crea la primera con "Nueva caja": nombre, base del día y horario.'>
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Nueva caja
          </Button>
        </StatusMessage>
      ) : (
        <ul className="register-grid register-grid--admin" aria-label="Cajas">
          {registers.map((register, index) => {
            const state = sessionState(register.currentSession)
            return (
              <li key={register.id} className={`register-card register-card--admin${register.isActive ? '' : ' register-card--inactive'}`} style={{ '--delay': `${index * 70}ms` }}>
                <div className="register-card__head">
                  <span className="register-card__icon" aria-hidden="true">
                    <Banknote />
                  </span>
                  <div className="register-card__title">
                    <span className={`status-pill status-pill--${register.isActive ? state.tone : 'neutral'}`}>
                      <span className="status-pill__dot" aria-hidden="true" />
                      {register.isActive ? state.label : 'Inactiva'}
                    </span>
                    <h2 className="register-card__name">{register.name}</h2>
                  </div>
                  <div className="register-card__tools">
                    <IconButton icon={Pencil} label={`Editar ${register.name}`} onClick={() => setEditing(register)} />
                    <IconButton icon={Power} tone={register.isActive ? 'danger' : 'success'} label={register.isActive ? `Desactivar ${register.name}` : `Activar ${register.name}`} onClick={() => setToToggle(register)} />
                  </div>
                </div>
                <dl className="register-card__facts">
                  <div>
                    <dt>
                      <PiggyBank aria-hidden="true" /> Base del día
                    </dt>
                    <dd className="register-card__base">{formatCurrency(register.baseAmount)}</dd>
                  </div>
                  <div>
                    <dt>
                      <CalendarClock aria-hidden="true" /> Horario
                    </dt>
                    <dd>{scheduleLabel(register)}</dd>
                  </div>
                  <div>
                    <dt>
                      <Zap aria-hidden="true" /> Automática
                    </dt>
                    <dd>{register.automatic ? 'Se abre y se cierra sola' : 'No'}</dd>
                  </div>
                </dl>
              </li>
            )
          })}
        </ul>
      )}

      <ClosedDays />

      {editing && (
        <CashRegisterFormModal
          register={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isEdit) => {
            setEditing(null)
            toast.success(isEdit ? `${saved.name} actualizada` : `${saved.name} creada`)
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(toToggle)}
        tone={toToggle?.isActive ? 'danger' : 'primary'}
        title={toToggle?.isActive ? 'Desactivar caja' : 'Activar caja'}
        message={toToggle?.isActive ? `${toToggle.name} no se podrá abrir. No se puede desactivar si tiene un turno sin contar.` : `${toToggle?.name} se podrá abrir de nuevo.`}
        confirmLabel={toToggle?.isActive ? 'Desactivar' : 'Activar'}
        isLoading={toggleState.isLoading}
        onConfirm={handleToggle}
        onCancel={() => setToToggle(null)}
      />
    </>
  )
}
