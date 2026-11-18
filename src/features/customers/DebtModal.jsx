import { useState } from 'react'
import { CalendarClock, Calculator, CalendarRange, NotebookPen, Trash2, Wallet } from 'lucide-react'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { TextField } from '../../components/ui/TextField/TextField'
import { SelectField } from '../../components/ui/SelectField/SelectField'
import { OptionCards } from '../../components/ui/OptionCards/OptionCards'
import { FormSection } from '../../components/ui/FormSection/FormSection'
import { Alert } from '../../components/feedback/Alert/Alert'
import { splitApiError } from '../../utils/formErrors'
import { MONEY_PATTERN, toApiNumber, toInputMoney } from '../../utils/numberInput'
import { previewSubtract, previewSum } from '../../utils/moneyPreview'
import { formatCurrency } from '../../utils/format'
import { addDays, todayIso } from '../purchases/purchaseOptions'
import { FREQUENCIES } from './customerOptions'
import { useCreateReceivableMutation, usePreviewInstallmentsMutation } from './customersApi'
import '../admin/admin.css'

const MODES = [
  { value: 'free', label: 'Abonos libres', description: 'Abona lo que pueda hasta una fecha límite.', icon: Wallet },
  { value: 'installments', label: 'En cuotas', description: 'Cuotas con fecha y valor fijos.', icon: CalendarRange },
]

/**
 * Registrar lo que un cliente ya debe (saldo inicial, D-CLI-1): abonos libres con fecha límite
 * (vacía = el plazo configurado, 30 días) o cuotas por número y frecuencia, editables (D-CLI-7).
 */
export function DebtModal({ customer, onClose, onSaved }) {
  const [form, setForm] = useState({ description: '', total: '', issueDate: todayIso(), paymentMode: 'free', dueDate: '', count: '3', frequency: 'monthly', firstDueDate: addDays(todayIso(), 30) })
  const [installments, setInstallments] = useState([])
  const [localErrors, setLocalErrors] = useState({})
  const [createReceivable, { isLoading, error }] = useCreateReceivableMutation()
  const [previewInstallments, previewState] = usePreviewInstallmentsMutation()
  const { fieldErrors: serverErrors, formError } = splitApiError(error)
  const fieldErrors = { ...serverErrors, ...localErrors }

  const total = toApiNumber(form.total)
  const set = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }
  const bind = (name) => ({ value: form[name], error: fieldErrors[name], onChange: (event) => set(name, event.target.value) })

  const sum = previewSum(installments.map((item) => toApiNumber(item.amount)))
  const difference = MONEY_PATTERN.test(total) ? previewSubtract(total, sum) : null

  const calculate = async () => {
    const errors = {}
    if (!MONEY_PATTERN.test(total) || Number(total) <= 0) errors.total = 'Escribe primero el valor de la deuda'
    const count = Number(form.count)
    if (!Number.isInteger(count) || count < 1 || count > 48) errors.count = 'Entre 1 y 48 cuotas'
    if (!form.firstDueDate) errors.firstDueDate = 'Escribe la fecha de la primera cuota'
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    try {
      const rows = await previewInstallments({ total, count, frequency: form.frequency, firstDueDate: form.firstDueDate }).unwrap()
      setInstallments(rows.map((row) => ({ dueDate: row.dueDate, amount: toInputMoney(row.amount) })))
    } catch {
      // Se muestra desde el error de la vista previa
    }
  }

  const updateInstallment = (index, name, value) => setInstallments((rows) => rows.map((row, position) => (position === index ? { ...row, [name]: value } : row)))

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (form.description.trim().length < 3) errors.description = 'Escribe el concepto (ej. Cuaderno de fiados)'
    if (!MONEY_PATTERN.test(total) || Number(total) <= 0) errors.total = 'Escribe el valor (ej. 150.000)'
    if (form.paymentMode === 'free' && form.dueDate && form.dueDate < form.issueDate) errors.dueDate = 'No puede ser antes de la fecha de la deuda'
    if (form.paymentMode === 'installments') {
      if (installments.length === 0) errors.installments = 'Calcula las cuotas'
      else if (difference !== null && Number(difference) !== 0) errors.installments = `Las cuotas suman ${formatCurrency(sum)}: deben sumar ${formatCurrency(total)}`
    }
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    try {
      const saved = await createReceivable({
        customerId: customer.id,
        description: form.description.trim(),
        total,
        issueDate: form.issueDate,
        paymentMode: form.paymentMode,
        ...(form.paymentMode === 'free' && form.dueDate && { dueDate: form.dueDate }),
        ...(form.paymentMode === 'installments' && { installments: installments.map((item) => ({ dueDate: item.dueDate, amount: toApiNumber(item.amount) })) }),
      }).unwrap()
      onSaved(saved)
    } catch {
      // Se muestra desde `error`
    }
  }

  const installmentsError = fieldErrors.installments ?? Object.entries(fieldErrors).find(([field]) => field.startsWith('installments['))?.[1]
  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="lg"
      icon={NotebookPen}
      title="Registrar deuda"
      description={`${customer.name}. Pasa al sistema lo que ya debía (el cuaderno de fiados). Las ventas fiadas llegarán con el punto de venta.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="debt-form" icon={NotebookPen} isLoading={isLoading}>
            Registrar deuda
          </Button>
        </>
      }
    >
      <form id="debt-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <FormSection icon={NotebookPen} title="La deuda">
          <TextField className="form-section__full" label="Concepto" placeholder="Ej.: Cuaderno de fiados a noviembre" maxLength={255} data-autofocus required {...bind('description')} />
          <TextField label="Valor" icon={Wallet} inputMode="decimal" placeholder="Ej.: 150.000" required {...bind('total')} onBlur={() => set('total', toInputMoney(toApiNumber(form.total)))} />
          <TextField label="Fecha de la deuda" type="date" max={todayIso()} {...bind('issueDate')} />
        </FormSection>

        <OptionCards
          legend="¿Cómo va a pagar?"
          name="payment-mode"
          options={MODES}
          value={form.paymentMode}
          onChange={(value) => {
            set('paymentMode', value)
            setLocalErrors({})
          }}
        />

        {form.paymentMode === 'free' ? (
          <FormSection icon={CalendarClock} title="Fecha límite" columns={1}>
            <TextField label="Pagar todo antes del" type="date" min={form.issueDate} hint="Vacía = el plazo configurado (30 días por defecto). La campana avisa antes de que venza." {...bind('dueDate')} />
          </FormSection>
        ) : (
          <FormSection icon={Calculator} title="Cuotas" description="Escoge cuántas y cada cuánto; luego puedes cambiar la fecha o el valor de cada una.">
            <TextField label="Número de cuotas" inputMode="numeric" {...bind('count')} />
            <SelectField label="Cada cuánto" options={FREQUENCIES} {...bind('frequency')} />
            <TextField label="Primera cuota" type="date" min={form.issueDate} {...bind('firstDueDate')} />
            <div className="debt-calc">
              <Button variant="secondary" icon={Calculator} onClick={calculate} isLoading={previewState.isLoading}>
                Calcular cuotas
              </Button>
            </div>
            {previewState.error && (
              <div className="form-section__full">
                <Alert tone="danger">{previewState.error.message}</Alert>
              </div>
            )}
            {installments.length > 0 && (
              <div className="form-section__full">
                <ol className="installment-editor">
                  {installments.map((item, index) => (
                    <li key={index} className="installment-editor__row">
                      <span className="installment-editor__number">{index + 1}</span>
                      <input className="installment-editor__input" type="date" aria-label={`Fecha de la cuota ${index + 1}`} value={item.dueDate} min={form.issueDate} onChange={(event) => updateInstallment(index, 'dueDate', event.target.value)} />
                      <input
                        className="installment-editor__input installment-editor__input--money"
                        inputMode="decimal"
                        aria-label={`Valor de la cuota ${index + 1}`}
                        value={item.amount}
                        onChange={(event) => updateInstallment(index, 'amount', event.target.value)}
                        onBlur={() => updateInstallment(index, 'amount', toInputMoney(toApiNumber(item.amount)))}
                      />
                      <IconButton icon={Trash2} tone="danger" label={`Quitar la cuota ${index + 1}`} onClick={() => setInstallments((rows) => rows.filter((row, position) => position !== index))} disabled={installments.length === 1} />
                    </li>
                  ))}
                </ol>
                <p className={`installment-editor__sum${difference !== null && Number(difference) !== 0 ? ' installment-editor__sum--off' : ''}`} role="status">
                  Suman {formatCurrency(sum)}
                  {difference !== null && Number(difference) !== 0 && ` · faltan ${formatCurrency(difference.replace('-', ''))}${difference.startsWith('-') ? ' de más' : ''}`}
                </p>
              </div>
            )}
            {installmentsError && (
              <div className="form-section__full">
                <Alert tone="danger">{installmentsError}</Alert>
              </div>
            )}
          </FormSection>
        )}
      </form>
    </Modal>
  )
}
