import { useRef, useState } from 'react'
import { Ban, ExternalLink, FileUp, Landmark, Paperclip, Pencil, Receipt, Trash2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import { Alert } from '../../components/feedback/Alert/Alert'
import { useCan } from '../../hooks/usePermissions'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { formatDay } from '../purchases/purchaseOptions'
import { ReasonModal } from '../purchases/detail/PurchaseModals'
import { openExpenseAttachment, useAddExpenseAttachmentMutation, useCancelExpenseMutation, useGetExpenseQuery, useRemoveExpenseAttachmentMutation } from './expensesApi'
import { ACCEPTED_FILES, MAX_FILE_BYTES, periodLabel } from './expenseOptions'
import { ExpenseFormModal } from './ExpenseFormModal'
import './expenses.css'

function Field({ label, children }) {
  return (
    <div className="expense-detail__field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Detalle de un gasto: datos, soportes (ver, adjuntar, quitar), editar y anular. */
export function ExpenseDetailModal({ expenseId, onClose }) {
  const toast = useToast()
  const fileRef = useRef(null)
  const canCreate = useCan('expenses.create')
  const canEdit = useCan('expenses.edit')
  const canCancel = useCan('expenses.cancel')
  const can = { attach: canCreate || canEdit, edit: canEdit, cancel: canCancel }
  const [modal, setModal] = useState(null) // 'edit' | 'cancel'
  const { data: expense, isLoading, error } = useGetExpenseQuery(expenseId)
  const [addAttachment, attachState] = useAddExpenseAttachmentMutation()
  const [removeAttachment] = useRemoveExpenseAttachmentMutation()
  const [cancelExpense, cancelState] = useCancelExpenseMutation()

  const pickFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!ACCEPTED_FILES.includes(file.type) || file.size > MAX_FILE_BYTES) return toast.error('El soporte debe ser un PDF, JPG o PNG de máximo 5 MB')
    try {
      await addAttachment({ id: expense.id, file }).unwrap()
      toast.success('Soporte adjuntado')
    } catch (uploadError) {
      toast.error(uploadError.message)
    }
    return undefined
  }

  const open = async (attachment) => {
    try {
      await openExpenseAttachment(expense.id, attachment.id)
    } catch (openError) {
      toast.error(openError.message)
    }
  }

  const remove = async (attachment) => {
    try {
      await removeAttachment({ id: expense.id, attachmentId: attachment.id }).unwrap()
      toast.success('Soporte quitado')
    } catch (removeError) {
      toast.error(removeError.message)
    }
  }

  const handleCancel = async (reason) => {
    try {
      const result = await cancelExpense({ id: expense.id, reason }).unwrap()
      toast.success(result.message ?? `Gasto ${expense.number} anulado`)
      setModal(null)
    } catch {
      // Se muestra en el modal
    }
  }

  const isActive = expense?.status === 'active'
  return (
    <>
      <Modal
        isOpen={modal === null}
        onClose={onClose}
        size="md"
        icon={Receipt}
        title={expense ? `Gasto ${expense.number}` : 'Gasto'}
        footer={
          expense && (
            <>
              {isActive && can.cancel && (
                <Button variant="ghost" icon={Ban} onClick={() => setModal('cancel')}>
                  Anular
                </Button>
              )}
              {isActive && can.edit && (
                <Button variant="secondary" icon={Pencil} onClick={() => setModal('edit')}>
                  Editar
                </Button>
              )}
              <Button onClick={onClose}>Cerrar</Button>
            </>
          )
        }
      >
        {isLoading ? (
          <Spinner label="Cargando el gasto…" />
        ) : error ? (
          <Alert tone="danger">{error.message}</Alert>
        ) : (
          <>
            {!isActive && (
              <Alert tone="danger" title="Gasto anulado">
                {formatDateTime(expense.cancelledAt)} · {expense.cancelledBy?.fullName}: {expense.cancelReason}
              </Alert>
            )}
            <div className={`expense-hero${isActive ? '' : ' expense-hero--cancelled'}`}>
              <span className="expense-hero__category">{expense.category?.name}</span>
              <strong className="expense-hero__amount">{formatCurrency(expense.amount)}</strong>
              <span className="expense-hero__description">{expense.description}</span>
            </div>
            <dl className="expense-detail">
              <Field label="Fecha">{formatDay(expense.expenseDate)}</Field>
              <Field label="Beneficiario">{expense.payee ?? '—'}</Field>
              <Field label="Pago">
                {expense.paymentMethod?.name}
                {expense.paymentReference && ` · ${expense.paymentReference}`}
              </Field>
              <Field label="Caja">
                {expense.fromCash ? (
                  <span className="expense-cash-tag">
                    <Landmark aria-hidden="true" /> Salió de {expense.register?.name ?? 'la caja'}
                  </span>
                ) : (
                  'No tocó la caja'
                )}
              </Field>
              {expense.recurring && (
                <Field label="Gasto fijo">
                  {expense.recurring.name} · {periodLabel(expense.recurringPeriod)}
                </Field>
              )}
              <Field label="Registró">
                {expense.createdBy?.fullName} · {formatDateTime(expense.createdAt)}
              </Field>
            </dl>

            <section className="expense-attachments" aria-label="Soportes">
              <header>
                <strong>
                  <Paperclip aria-hidden="true" /> Soportes
                </strong>
                {can.attach && isActive && (
                  <>
                    <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={pickFile} aria-label="Elegir un soporte" />
                    <Button size="sm" variant="secondary" icon={FileUp} isLoading={attachState.isLoading} onClick={() => fileRef.current?.click()}>
                      Adjuntar
                    </Button>
                  </>
                )}
              </header>
              {expense.attachments.length === 0 ? (
                <p className="expense-attachments__empty">Sin soporte. Adjunta la factura o el recibo si lo tienes.</p>
              ) : (
                <ul>
                  {expense.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <span className="expense-attachments__name">{attachment.fileName}</span>
                      <IconButton icon={ExternalLink} label={`Ver ${attachment.fileName}`} onClick={() => open(attachment)} />
                      {can.edit && isActive && <IconButton icon={Trash2} label={`Quitar ${attachment.fileName}`} onClick={() => remove(attachment)} />}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </Modal>
      {modal === 'edit' && (
        <ExpenseFormModal
          expense={expense}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            toast.success(saved.message ?? `Gasto ${saved.number} actualizado`)
            setModal(null)
          }}
        />
      )}
      {modal === 'cancel' && (
        <ReasonModal
          title={`Anular el gasto ${expense.number}`}
          description={expense.fromCash ? `${formatCurrency(expense.amount)} vuelven al turno de caja de donde salieron (debe seguir abierto).` : 'El gasto deja de contar en los informes. Queda el registro de quién lo anuló y por qué.'}
          confirmLabel="Anular gasto"
          placeholder="Ej.: se registró dos veces"
          isLoading={cancelState.isLoading}
          error={cancelState.error}
          onClose={() => setModal(null)}
          onConfirm={handleCancel}
        />
      )}
    </>
  )
}
