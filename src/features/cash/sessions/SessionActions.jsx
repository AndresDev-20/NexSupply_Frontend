import { useState } from 'react'
import { HandCoins, PackageCheck } from 'lucide-react'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { TextAreaField } from '../../../components/ui/TextAreaField/TextAreaField'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { formatCurrency } from '../../../utils/format'
import { useCutCashSessionMutation, useGetCashSessionQuery, useReceiveCashSessionMutation } from '../cashApi'
import { differenceInfo } from '../cashOptions'
import { CountSessionModal } from './CountSessionModal'
import '../cash.css'

function ReceiveModal({ session, onClose, onDone }) {
  const [notes, setNotes] = useState('')
  const [receive, { isLoading, error }] = useReceiveCashSessionMutation()
  const diff = differenceInfo(session.difference)

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      const saved = await receive({ sessionId: session.id, notes: notes.trim() || null }).unwrap()
      onDone(saved)
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
      title="Recibir el dinero"
      description={`${session.register?.name ?? 'Caja'} · ${session.closingNumber}. Confirma que recibiste el dinero contado.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="receive-session-form" icon={PackageCheck} isLoading={isLoading}>
            Marcar como recibido
          </Button>
        </>
      }
    >
      <form id="receive-session-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="admin-form__alert">
            <Alert tone="danger">{error.message}</Alert>
          </div>
        )}
        <div className="receive-amount">
          <span className="receive-amount__label">Para entregar</span>
          <span className="receive-amount__value">{formatCurrency(session.cashWithdrawn)}</span>
          <span className="receive-amount__detail">
            Contado {formatCurrency(session.countedCash)} · base que se quedó {formatCurrency(session.baseLeft)}
          </span>
        </div>
        {diff && diff.label !== 'Cuadrada' && (
          <div className="admin-form__alert">
            <Alert tone={diff.tone === 'danger' ? 'danger' : 'warning'}>
              {diff.label} de {diff.amount}. Explicación de quien contó: {session.differenceNotes}
            </Alert>
          </div>
        )}
        <TextAreaField label="Nota" placeholder="Opcional. Ej.: consignado en Bancolombia" maxLength={255} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </form>
    </Modal>
  )
}

/** El conteo necesita el turno completo y al día (efectivo esperado, base, responsable). */
function CountLoader({ sessionId, onClose, onSaved }) {
  const { data: session, isFetching } = useGetCashSessionQuery(sessionId, { refetchOnMountOrArgChange: true })
  if (!session || isFetching) return null
  return <CountSessionModal session={session} onClose={onClose} onSaved={onSaved} />
}

/**
 * Diálogos de las acciones de un turno. `action`: { type: 'cut'|'count'|'receive', session } o null.
 * Úsalo con useState en la pantalla y botones que llamen setAction(...).
 */
export function SessionActionDialogs({ action, onClose }) {
  const toast = useToast()
  const [cutSession, cutState] = useCutCashSessionMutation()
  if (!action) return null
  const { type, session } = action

  const handleCut = async () => {
    try {
      await cutSession(session.id).unwrap()
      toast.success(`${session.register?.name ?? 'Caja'}: turno cerrado. Falta contar la caja`)
      onClose()
    } catch (cutError) {
      toast.error(cutError.message)
      onClose()
    }
  }

  if (type === 'cut') {
    return (
      <ConfirmDialog
        isOpen
        tone="primary"
        title="Cerrar turno"
        message={`${session.register?.name ?? 'La caja'} deja de recibir ventas y movimientos ahora mismo. Queda pendiente por contar.`}
        confirmLabel="Cerrar turno"
        isLoading={cutState.isLoading}
        onConfirm={handleCut}
        onCancel={onClose}
      />
    )
  }
  if (type === 'count') {
    return (
      <CountLoader
        sessionId={session.id}
        onClose={onClose}
        onSaved={(saved) => {
          toast.success(`Caja contada (${saved.closingNumber}). Para entregar: ${formatCurrency(saved.cashWithdrawn)}`)
          onClose()
        }}
      />
    )
  }
  if (type === 'receive') {
    return (
      <ReceiveModal
        session={session}
        onClose={onClose}
        onDone={() => {
          toast.success('Dinero recibido')
          onClose()
        }}
      />
    )
  }
  return null
}
