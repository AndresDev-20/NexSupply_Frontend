import { Modal } from '../Modal/Modal'
import { Button } from '../Button/Button'

/**
 * Confirmación antes de operaciones importantes (CLAUDE.md §5).
 * tone: primary | danger. Mientras `isLoading`, no se puede cerrar ni repetir.
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'primary',
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      isBusy={isLoading}
      footer={
        <>
          {/* En acciones peligrosas el foco inicial va a "Cancelar": un Enter accidental no confirma */}
          <Button variant="secondary" onClick={onCancel} disabled={isLoading} data-autofocus={tone === 'danger' || undefined}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
            data-autofocus={tone !== 'danger' || undefined}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="u-text-muted">{message}</div>
    </Modal>
  )
}
