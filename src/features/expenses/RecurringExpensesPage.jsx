import { useState } from 'react'
import { BellRing, CalendarClock, CheckCircle2, Pencil, Plus, Receipt, Repeat } from 'lucide-react'
import { useCreateRecurringExpenseMutation, useGetExpenseCategoriesQuery, useGetRecurringExpensesQuery, useUpdateRecurringExpenseMutation } from './expensesApi'
import { categoryTone, periodLabel } from './expenseOptions'
import { ExpenseFormModal } from './ExpenseFormModal'
import { useCan } from '../../hooks/usePermissions'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../components/layout/PageHeader/PageHeader'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { TextField } from '../../components/ui/TextField/TextField'
import { SelectField } from '../../components/ui/SelectField/SelectField'
import { Switch } from '../../components/ui/Switch/Switch'
import { FormSection } from '../../components/ui/FormSection/FormSection'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import { Alert } from '../../components/feedback/Alert/Alert'
import { StatusMessage } from '../../components/feedback/StatusMessage/StatusMessage'
import { splitApiError } from '../../utils/formErrors'
import { MONEY_PATTERN, toApiNumber, toInputMoney } from '../../utils/numberInput'
import { formatCurrency } from '../../utils/format'
import '../admin/admin.css'
import './expenses.css'

const DAYS = Array.from({ length: 28 }, (_, index) => ({ value: String(index + 1), label: `Día ${index + 1}` }))

/** Crear o editar un gasto fijo (D-GAS-4). */
function RecurringFormModal({ recurring = null, onClose, onSaved }) {
  const { data: categories = [] } = useGetExpenseCategoriesQuery()
  const [form, setForm] = useState({
    name: recurring?.name ?? '',
    categoryId: String(recurring?.category?.id ?? ''),
    estimatedAmount: toInputMoney(recurring?.estimatedAmount ?? ''),
    dayOfMonth: String(recurring?.dayOfMonth ?? '5'),
    payee: recurring?.payee ?? '',
  })
  const [localErrors, setLocalErrors] = useState({})
  const [create, createState] = useCreateRecurringExpenseMutation()
  const [update, updateState] = useUpdateRecurringExpenseMutation()
  const isSaving = createState.isLoading || updateState.isLoading
  const { fieldErrors: serverErrors, formError } = splitApiError(recurring ? updateState.error : createState.error)
  const fieldErrors = { ...serverErrors, ...localErrors }
  const bind = (name) => ({
    value: form[name],
    error: fieldErrors[name],
    onChange: (event) => {
      setForm((current) => ({ ...current, [name]: event.target.value }))
      setLocalErrors((current) => ({ ...current, [name]: undefined }))
    },
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const amount = toApiNumber(form.estimatedAmount)
    const errors = {}
    if (form.name.trim().length < 2) errors.name = 'Escribe el nombre (ej. Arriendo del local)'
    if (!form.categoryId) errors.categoryId = 'Escoge la categoría'
    if (!MONEY_PATTERN.test(amount) || Number(amount) <= 0) errors.estimatedAmount = 'Escribe el valor aproximado'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    const body = { name: form.name.trim(), categoryId: Number(form.categoryId), estimatedAmount: amount, dayOfMonth: Number(form.dayOfMonth), payee: form.payee.trim() || null }
    try {
      await (recurring ? update({ id: recurring.id, ...body }) : create(body)).unwrap()
      onSaved(recurring ? 'Gasto fijo actualizado' : 'Gasto fijo creado')
    } catch {
      // Se muestra desde el error
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isSaving}
      icon={Repeat}
      title={recurring ? `Editar ${recurring.name}` : 'Nuevo gasto fijo'}
      description="Cada mes, desde el día escogido, llega un aviso hasta que se registre el gasto. Nada se registra solo."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" form="recurring-form" icon={Repeat} isLoading={isSaving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="recurring-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={Repeat} title="Gasto fijo">
          <TextField className="form-section__full" label="Nombre" placeholder="Ej.: Arriendo del local" maxLength={120} required data-autofocus {...bind('name')} />
          <SelectField label="Categoría" placeholder="Escoge…" options={categories.map((row) => ({ value: String(row.id), label: row.name }))} required {...bind('categoryId')} />
          <TextField label="Valor aproximado" inputMode="decimal" placeholder="Ej.: 1.500.000" required {...bind('estimatedAmount')} onBlur={() => setForm((current) => ({ ...current, estimatedAmount: toInputMoney(toApiNumber(current.estimatedAmount)) }))} />
          <SelectField label="Se paga el" options={DAYS} hint="De 1 a 28: existe en todos los meses." {...bind('dayOfMonth')} />
          <TextField label="Beneficiario" placeholder="Opcional" maxLength={120} {...bind('payee')} />
        </FormSection>
      </form>
    </Modal>
  )
}

/**
 * Gastos fijos (D-GAS-4): arriendo, servicios, nómina… Muestra si el gasto del mes ya se registró
 * o si ya toca pagarlo; "Registrar pago" abre el formulario del gasto con los datos llenos.
 */
export default function RecurringExpensesPage() {
  const toast = useToast()
  const canCreate = useCan('expenses.create')
  const canManage = useCan('expenses.manage')
  const [modal, setModal] = useState(null) // 'new' | { edit } | { pay }
  const { data: items = [], isLoading, error } = useGetRecurringExpensesQuery({ includeInactive: 'true' })
  const [update] = useUpdateRecurringExpenseMutation()

  const toggle = async (item, isActive) => {
    try {
      await update({ id: item.id, isActive }).unwrap()
      toast.success(isActive ? `${item.name} activado` : `${item.name} desactivado: no avisa más`)
    } catch (toggleError) {
      toast.error(toggleError.message)
    }
  }

  return (
    <>
      <PageHeader
        description="Gastos que se repiten cada mes. Llega un aviso el día de pago y con un toque se registra el gasto."
        actions={
          canManage && (
            <Button icon={Plus} onClick={() => setModal('new')}>
              Nuevo gasto fijo
            </Button>
          )
        }
      />
      {isLoading ? (
        <Spinner label="Cargando los gastos fijos…" />
      ) : error ? (
        <Alert tone="danger">{error.message}</Alert>
      ) : items.length === 0 ? (
        <StatusMessage icon={Repeat} title="Aún no hay gastos fijos" description="Agrega el arriendo, los servicios o la nómina para que el sistema te recuerde pagarlos." />
      ) : (
        <div className="recurring-grid">
          {items.map((item) => (
            <article key={item.id} className={`recurring-card${item.isDue ? ' recurring-card--due' : ''}${item.paidExpense ? ' recurring-card--paid' : ''}${item.isActive ? '' : ' recurring-card--off'}`}>
              <header>
                <span className={`expense-chip tone-${categoryTone(item.category?.id)}`}>{item.category?.name}</span>
                {canManage && <Switch label={item.isActive ? 'Activo' : 'Inactivo'} checked={item.isActive} onChange={(checked) => toggle(item, checked)} />}
              </header>
              <h3>{item.name}</h3>
              <p className="recurring-card__amount">
                <strong>{formatCurrency(item.estimatedAmount)}</strong> aprox.
              </p>
              <p className="recurring-card__day">
                <CalendarClock aria-hidden="true" /> Se paga el día {item.dayOfMonth}
                {item.payee && ` · ${item.payee}`}
              </p>
              <div className="recurring-card__status">
                {item.paidExpense ? (
                  <span className="recurring-status recurring-status--paid">
                    <CheckCircle2 aria-hidden="true" /> Pagado este mes · {item.paidExpense.number} · {formatCurrency(item.paidExpense.amount)}
                  </span>
                ) : item.isDue ? (
                  <span className="recurring-status recurring-status--due">
                    <BellRing aria-hidden="true" /> ¡Toca pagarlo!
                  </span>
                ) : item.isActive ? (
                  <span className="recurring-status">Pendiente de {periodLabel(item.period)}</span>
                ) : (
                  <span className="recurring-status">Sin avisos</span>
                )}
              </div>
              <footer>
                {canCreate && item.isActive && !item.paidExpense && (
                  <Button size="sm" icon={Receipt} variant={item.isDue ? 'primary' : 'secondary'} onClick={() => setModal({ pay: item })}>
                    Registrar pago
                  </Button>
                )}
                {canManage && (
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setModal({ edit: item })}>
                    Editar
                  </Button>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}

      {(modal === 'new' || modal?.edit) && (
        <RecurringFormModal
          recurring={modal?.edit ?? null}
          onClose={() => setModal(null)}
          onSaved={(message) => {
            toast.success(message)
            setModal(null)
          }}
        />
      )}
      {modal?.pay && (
        <ExpenseFormModal
          recurring={modal.pay}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            toast.success(saved.message ?? `Gasto ${saved.number} registrado`)
            setModal(null)
          }}
        />
      )}
    </>
  )
}
