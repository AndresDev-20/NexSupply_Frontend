import { Fragment, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { FileDown, FileText, Mail, MessageCircle, Printer, ReceiptText, RotateCw, Send } from 'lucide-react'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { TextField } from '../../components/ui/TextField/TextField'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import { Alert } from '../../components/feedback/Alert/Alert'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { splitApiError } from '../../utils/formErrors'
import { ticketFormat } from './receiptHelpers'
import { printReceipt } from './printReceipt'
import './sales.css'

const VIEWS = [
  { value: 'ticket', label: 'Tirilla' },
  { value: 'letter', label: 'Carta' },
]

function ActionTile({ icon: Icon, label, hint, primary = false, ...props }) {
  const Tag = props.href ? 'a' : 'button'
  return (
    <Tag className={`sale-action${primary ? ' sale-action--primary' : ''}`} {...(Tag === 'button' ? { type: 'button' } : {})} {...props}>
      <span className="sale-action__icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="sale-action__text">
        <span className="sale-action__label">{label}</span>
        <span className="sale-action__hint">{hint}</span>
      </span>
    </Tag>
  )
}

/** Abre un PDF (File o Blob) en una pestaña nueva. */
function openPdf(file) {
  const url = URL.createObjectURL(file)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

/**
 * Ventana de un comprobante (D-VEN-4, D-VEN-10, D-CLI-11): imprimir en tirilla o en carta, PDF,
 * WhatsApp con el PDF, correo y vista previa. La usan la venta, la deuda y el recibo de abono.
 *
 * - receipt: la configuración del comprobante (paperFormat, showLogo…).
 * - renderReceipt(view): dibuja el comprobante en 'ticket' o 'letter'.
 * - getPdfFile(): el PDF del servidor como File; onShare(file): lo comparte por WhatsApp
 *   (devuelve 'shared', 'cancelled' o 'downloaded').
 * - sendEmail(email): envía por correo (promesa con { to, simulated, message }).
 * - header: lo que va arriba de los botones (ej. «¡Venta registrada!»).
 */
export function ReceiptDocumentModal({
  title,
  icon = ReceiptText,
  onClose,
  footer,
  isLoading = false,
  error = null,
  onRetry,
  receipt,
  emailEnabled = false,
  defaultEmail = '',
  emailHint = 'El PDF al correo del cliente',
  renderReceipt,
  getPdfFile,
  onShare,
  sendEmail,
  emailState = {},
  header = null,
}) {
  const toast = useToast()
  const [email, setEmail] = useState(null)
  const [preview, setPreview] = useState(null)
  const [printView, setPrintView] = useState('ticket')
  const [sharing, setSharing] = useState(false)
  const printRef = useRef(null)
  const emailRef = useRef(null)
  const { fieldErrors, formError } = splitApiError(emailState.error)
  const ready = !isLoading && !error && Boolean(receipt)
  const view = preview ?? (receipt?.paperFormat === 'letter' ? 'letter' : 'ticket')

  const handlePrint = (kind) => {
    // La copia para imprimir se cambia al formato pedido antes de abrir la impresión
    flushSync(() => setPrintView(kind))
    printReceipt(printRef.current?.firstElementChild, kind === 'letter' ? 'letter' : ticketFormat(receipt))
  }

  const handlePdf = async () => {
    try {
      openPdf(await getPdfFile())
    } catch (pdfError) {
      toast.error(pdfError.message ?? 'No se pudo abrir el PDF')
    }
  }

  const handleWhatsapp = async () => {
    setSharing(true)
    try {
      const result = await onShare(await getPdfFile())
      if (result === 'downloaded') toast.info('Se descargó el PDF del comprobante: adjúntalo en el chat de WhatsApp que se abrió')
    } catch (shareError) {
      toast.error(shareError.message ?? 'No se pudo preparar el comprobante')
    } finally {
      setSharing(false)
    }
  }

  const focusEmail = () => {
    emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    emailRef.current?.querySelector('input')?.focus({ preventScroll: true })
  }

  const handleEmail = async (event) => {
    event.preventDefault()
    try {
      const result = await sendEmail(email ?? defaultEmail ?? '')
      if (result.simulated) toast.error(result.message)
      else toast.success(result.message ?? `Comprobante enviado a ${result.to}`)
    } catch {
      // Se muestra abajo
    }
  }

  return (
    <Modal isOpen onClose={onClose} size={ready && view === 'letter' ? 'lg' : 'md'} icon={icon} title={title} footer={footer}>
      {isLoading ? (
        <Spinner label="Cargando el comprobante…" />
      ) : error ? (
        <Alert tone="danger" title="No se pudo cargar el comprobante">
          {error.message}{' '}
          <Button size="sm" variant="ghost" icon={RotateCw} onClick={onRetry}>
            Reintentar
          </Button>
        </Alert>
      ) : ready ? (
        <>
          {header}

          <div className="sale-actions">
            <ActionTile icon={Printer} label="Imprimir tirilla" hint={`Rollo de ${ticketFormat(receipt).replace('mm', ' mm')}`} primary onClick={() => handlePrint('ticket')} />
            <ActionTile icon={FileText} label="Imprimir carta" hint="Hoja carta" onClick={() => handlePrint('letter')} />
            <ActionTile icon={FileDown} label="PDF" hint="Descargar o guardar" onClick={handlePdf} />
            <ActionTile icon={MessageCircle} label="WhatsApp" hint={sharing ? 'Preparando el PDF…' : 'Enviar el PDF'} onClick={handleWhatsapp} disabled={sharing} />
            <ActionTile icon={Mail} label="Enviar por correo" hint={emailEnabled ? emailHint : 'Apagado en Configuración'} onClick={focusEmail} disabled={!emailEnabled} />
          </div>
          <div className="sale-preview">
            <div className="sale-preview__bar">
              <span className="sale-preview__title">Vista previa</span>
              <div className="sale-preview__switch" role="radiogroup" aria-label="Vista previa del comprobante">
                {VIEWS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={view === option.value}
                    className={`sale-preview__option${view === option.value ? ' is-active' : ''}`}
                    onClick={() => setPreview(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sale-receipt__scroll">
              <Fragment key={view}>{renderReceipt(view)}</Fragment>
            </div>
          </div>

          {createPortal(
            <div className={`sale-print-root sale-print-root--${printView}`} ref={printRef} aria-hidden="true">
              {renderReceipt(printView)}
            </div>,
            document.body,
          )}

          {emailEnabled && (
            <form className="sale-receipt__email" ref={emailRef} onSubmit={handleEmail} noValidate>
              <TextField
                label="Enviar por correo"
                icon={Mail}
                type="email"
                placeholder="correo@cliente.com"
                value={email ?? defaultEmail ?? ''}
                onChange={(event) => setEmail(event.target.value)}
                error={fieldErrors.email ?? formError}
              />
              <Button type="submit" variant="secondary" icon={Send} isLoading={emailState.isLoading}>
                Enviar
              </Button>
            </form>
          )}
        </>
      ) : null}
    </Modal>
  )
}
