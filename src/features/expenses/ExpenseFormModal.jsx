import { useRef, useState } from 'react'
import { Banknote, CalendarDays, FileUp, Hash, NotebookPen, Paperclip, Receipt, Tags, UserRound, Wallet, X } from 'lucide-react'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { TextField } from '../../components/ui/TextField/TextField'
import { SelectField } from '../../components/ui/SelectField/SelectField'
import { Switch } from '../../components/ui/Switch/Switch'
import { FormSection } from '../../components/ui/FormSection/FormSection'
import { Alert } from '../../components/feedback/Alert/Alert'
import { useCan } from '../../hooks/usePermissions'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { splitApiError } from '../../utils/formErrors'
import { MONEY_PATTERN, toApiNumber, toInputMoney } from '../../utils/numberInput'
import { formatDateTime } from '../../utils/format'
import { todayIso } from '../purchases/purchaseOptions'
import { usePaymentMethodInfo } from '../purchases/detail/paymentHelpers'
import { useGetCashSessionsQuery } from '../cash/cashApi'
import { useAddExpenseAttachmentMutation, useCreateExpenseMutation, useGetExpenseCategoriesQuery, useUpdateExpenseMutation } from './expensesApi'
import { ACCEPTED_FILES, MAX_FILE_BYTES, periodLabel } from './expenseOptions'
import '../admin/admin.css'
import './expenses.css'
import { newIdempotencyKey } from '../../utils/idempotencyKey'

/**
 * Registrar o editar un gasto (D-GAS-1, D-GAS-2). "Salió de la caja" solo con efectivo y el turno
 * abierto. Al editar un gasto de la caja no se cambian el valor ni el método. Al registrar se
 * pueden elegir los soportes de una vez (se suben después de guardar).
 * recurring: gasto fijo que se está pagando (llena categoría, valor y descripción).
 */
export function ExpenseFormModal({ expense = null, recurring = null, onClose, onSaved }) {
  const toast = useToast()
  const isEdit = Boolean(expense)
  const canViewCash = useCan('cash.view')
  const fileRef = useRef(null)
  const { data: categories = [] } = useGetExpenseCategoriesQuery()
  const { data: sessionsData } = useGetCashSessionsQuery({ status: 'open', pageSize: 50 }, { skip: !canViewCash || isEdit })
  const sessions = sessionsData?.rows ?? []
  const [form, setForm] = useState(() => ({
    categoryId: String(expense?.category?.id ?? recurring?.category?.id ?? ''),
    expenseDate: expense?.expenseDate ?? todayIso(),
    description: expense?.description ?? (recurring ? `${recurring.name} de ${periodLabel(recurring.period)}` : ''),
    payee: expense?.payee ?? recurring?.payee ?? '',
    amount: toInputMoney(expense?.amount ?? recurring?.estimatedAmount ?? ''),
    paymentMethodId: String(expense?.paymentMethod?.id ?? ''),
    paymentReference: expense?.paymentReference ?? '',
    fromCash: false,
    cashSessionId: '',
  }))
  const [files, setFiles] = useState([])
  const [localErrors, setLocalErrors] = useState({})
  const { methods, method } = usePaymentMethodInfo(form.paymentMethodId)
  const [createExpense, createState] = useCreateExpenseMutation()
  // Una clave por formulario abierto: un doble clic o un reintento no duplica el gasto (D-AUD-3)
  const [idempotencyKey] = useState(newIdempotencyKey)
  const [updateExpense, updateState] = useUpdateExpenseMutation()
  const [addAttachment, attachState] = useAddExpenseAttachmentMutation()
  const isSaving = createState.isLoading || updateState.isLoading || attachState.isLoading
  const { fieldErrors: serverErrors, formError } = splitApiError(isEdit ? updateState.error : createState.error)
  const fieldErrors = { ...serverErrors, ...localErrors }
  const lockedMoney = isEdit && !expense.canEditAmount
  const sessionId = form.cashSessionId || (sessions.length === 1 ? String(sessions[0].id) : '')

  const set = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }
  const bind = (name) => ({ value: form[name], error: fieldErrors[name], onChange: (event) => set(name, event.target.value) })

  const pickFiles = (event) => {
    const picked = [...(event.target.files ?? [])]
    event.target.value = ''
    const valid = picked.filter((file) => ACCEPTED_FILES.includes(file.type) && file.size <= MAX_FILE_BYTES)
    if (valid.length < picked.length) toast.error('Los soportes deben ser PDF, JPG o PNG de máximo 5 MB')
    setFiles((current) => [...current, ...valid])
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const amount = toApiNumber(form.amount)
    const errors = {}
    if (!form.categoryId) errors.categoryId = 'Escoge la categoría'
    if (form.description.trim().length < 3) errors.description = 'Escribe qué se pagó (mínimo 3 caracteres)'
    if (!lockedMoney) {
      if (!MONEY_PATTERN.test(amount) || Number(amount) <= 0) errors.amount = 'Escribe el valor (ej. 30.000)'
      if (!method) errors.paymentMethodId = 'Escoge cómo se pagó'
      else if (method.requiresReference && !form.paymentReference.trim()) errors.paymentReference = `${method.name} pide el número de referencia`
    }
    if (form.expenseDate > todayIso()) errors.expenseDate = 'La fecha no puede ser futura'
    if (!isEdit && form.fromCash && !sessionId) errors.cashSessionId = 'Escoge el turno de donde salió el dinero'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return

    const common = {
      categoryId: Number(form.categoryId),
      expenseDate: form.expenseDate,
      description: form.description.trim(),
      payee: form.payee.trim() || null,
    }
    const money = lockedMoney ? {} : { amount, paymentMethodId: Number(form.paymentMethodId), ...(method.requiresReference && { paymentReference: form.paymentReference.trim() }) }
    try {
      if (isEdit) {
        onSaved(await updateExpense({ id: expense.id, ...common, ...money }).unwrap())
        return
      }
      const saved = await createExpense({
        idempotencyKey,
        ...common,
        ...money,
        fromCash: Boolean(form.fromCash && method?.isCash),
        ...(form.fromCash && method?.isCash && { cashSessionId: Number(sessionId) }),
        ...(recurring && { recurringExpenseId: recurring.id, recurringPeriod: recurring.period }),
      }).unwrap()
      // Los soportes se suben después de guardar: si uno falla, el gasto ya quedó registrado
      for (const file of files) {
        try {
          await addAttachment({ id: saved.id, file }).unwrap()
        } catch (uploadError) {
          toast.error(`No se pudo adjuntar ${file.name}: ${uploadError.message}`)
        }
      }
      onSaved(saved)
    } catch {
      // Se muestra desde el error de la mutación
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isSaving}
      size="lg"
      icon={Receipt}
      title={isEdit ? `Editar el gasto ${expense.number}` : recurring ? `Pagar ${recurring.name}` : 'Registrar gasto'}
      description={recurring ? `Gasto fijo de ${periodLabel(recurring.period)}. Confirma el valor real.` : isEdit && lockedMoney ? 'Este gasto salió de la caja: el valor y el método no se cambian (anúlalo y regístralo de nuevo).' : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" form="expense-form" icon={Receipt} isLoading={isSaving}>
            {isEdit ? 'Guardar cambios' : 'Registrar gasto'}
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={NotebookPen} title="¿Qué se pagó?">
          <SelectField label="Categoría" icon={Tags} placeholder="Escoge…" options={categories.map((row) => ({ value: String(row.id), label: row.name }))} required {...bind('categoryId')} />
          <TextField label="Fecha" icon={CalendarDays} type="date" max={todayIso()} required {...bind('expenseDate')} />
          <TextField className="form-section__full" label="Descripción" placeholder="Ej.: almuerzo de los trabajadores" maxLength={255} required data-autofocus {...bind('description')} />
          <TextField label="Beneficiario" icon={UserRound} placeholder="Opcional: a quién se le pagó" maxLength={120} {...bind('payee')} />
        </FormSection>

        <FormSection icon={Wallet} title="Pago">
          <TextField label="Valor" icon={Banknote} inputMode="decimal" placeholder="Ej.: 30.000" required disabled={lockedMoney} {...bind('amount')} onBlur={() => set('amount', toInputMoney(toApiNumber(form.amount)))} />
          <SelectField label="Método de pago" placeholder="Escoge…" options={methods.map((row) => ({ value: String(row.id), label: row.name }))} required disabled={lockedMoney} {...bind('paymentMethodId')} />
          {method?.requiresReference && !lockedMoney && <TextField label="Referencia" icon={Hash} maxLength={60} required {...bind('paymentReference')} />}
          {!isEdit && method?.isCash && (
            <div className="form-section__full expense-cash">
              <Switch label="Salió de la caja" description="Si el dinero se sacó del cajón: baja el efectivo del turno y cuadra el arqueo." checked={form.fromCash} onChange={(checked) => set('fromCash', checked)} />
              {form.fromCash &&
                (sessions.length === 0 ? (
                  <Alert tone="warning">No hay ninguna caja abierta. Si el dinero salió del cajón, abre el turno; si no, deja esta opción apagada.</Alert>
                ) : (
                  <SelectField
                    label="Turno de caja"
                    placeholder="Escoge el turno…"
                    options={sessions.map((row) => ({ value: String(row.id), label: `${row.register?.name} · abierta ${formatDateTime(row.openedAt)}` }))}
                    value={sessionId}
                    onChange={(event) => set('cashSessionId', event.target.value)}
                    error={fieldErrors.cashSessionId}
                    required
                  />
                ))}
            </div>
          )}
        </FormSection>

        {!isEdit && (
          <FormSection icon={Paperclip} title="Soportes (opcional)">
            <div className="form-section__full expense-files">
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple hidden onChange={pickFiles} aria-label="Elegir soportes" />
              <Button variant="secondary" icon={FileUp} onClick={() => fileRef.current?.click()}>
                Adjuntar factura o recibo
              </Button>
              <span className="expense-files__hint">PDF, JPG o PNG de máximo 5 MB. También se pueden adjuntar después.</span>
              {files.length > 0 && (
                <ul className="expense-files__list">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`}>
                      <Paperclip aria-hidden="true" /> {file.name}
                      <button type="button" aria-label={`Quitar ${file.name}`} onClick={() => setFiles((current) => current.filter((_, position) => position !== index))}>
                        <X aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </FormSection>
        )}
      </form>
    </Modal>
  )
}
