import { useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { FileDown, FileText, Mail, MessageCircle, Printer, ReceiptText, RotateCw, Send } from 'lucide-react'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { TextField } from '../../components/ui/TextField/TextField'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import { Alert } from '../../components/feedback/Alert/Alert'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { splitApiError } from '../../utils/formErrors'
import { formatCurrency } from '../../utils/format'
import { getSalePdfFile, openSalePdf, useEmailSaleReceiptMutation, useGetSaleReceiptQuery } from './salesApi'
import { shareReceiptPdf } from './shareReceipt'
import { SaleReceiptPaper } from './SaleReceiptPaper'
import { SaleReceiptLetter } from './SaleReceiptLetter'
import { ticketFormat } from './receiptHelpers'
import { printReceipt } from './printReceipt'
import './sales.css'

const VIEWS = [
  { value: 'ticket', label: 'Tirilla' },
  { value: 'letter', label: 'Carta' },
]

function Receipt({ view, ...props }) {
  return view === 'letter' ? <SaleReceiptLetter {...props} /> : <SaleReceiptPaper {...props} />
}

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

/**
 * Comprobante de una venta (D-VEN-4, D-VEN-10): imprimir en tirilla o en carta, PDF, WhatsApp
 * y correo. onNewSale: en el punto de venta, empieza la siguiente venta.
 */
export function SaleReceiptModal({ saleId, onClose, onNewSale, change = null }) {
  const toast = useToast()
  const { data, isLoading, error, refetch } = useGetSaleReceiptQuery(saleId)
  const [email, setEmail] = useState(null)
  const [preview, setPreview] = useState(null)
  const [printView, setPrintView] = useState('ticket')
  const printRef = useRef(null)
  const emailRef = useRef(null)
  const [sharing, setSharing] = useState(false)
  const [sendEmail, emailState] = useEmailSaleReceiptMutation()
  const { fieldErrors, formError } = splitApiError(emailState.error)

  const sale = data?.sale
  const view = preview ?? (data?.receipt.paperFormat === 'letter' ? 'letter' : 'ticket')

  const handlePrint = (kind) => {
    // La copia para imprimir se cambia al formato pedido antes de abrir la impresión
    flushSync(() => setPrintView(kind))
    printReceipt(printRef.current?.firstElementChild, kind === 'letter' ? 'letter' : ticketFormat(data.receipt))
  }

  const handlePdf = async () => {
    try {
      await openSalePdf(saleId)
    } catch (pdfError) {
      toast.error(pdfError.message)
    }
  }

  const handleWhatsapp = async () => {
    setSharing(true)
    try {
      const file = await getSalePdfFile(saleId, data.sale.number)
      const result = await shareReceiptPdf({ file, sale: data.sale, businessName: data.business.name })
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
      const result = await sendEmail({ id: saleId, email: email ?? data.sale.customer?.email ?? '' }).unwrap()
      if (result.simulated) toast.error(result.message)
      else toast.success(result.message ?? `Comprobante enviado a ${result.to}`)
    } catch {
      // Se muestra abajo
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size={view === 'letter' ? 'lg' : 'md'}
      icon={ReceiptText}
      title={sale ? `Comprobante ${sale.number}` : 'Comprobante'}
      footer={onNewSale ? <Button onClick={onNewSale}>Nueva venta</Button> : <Button onClick={onClose}>Cerrar</Button>}
    >
      {isLoading ? (
        <Spinner label="Cargando el comprobante…" />
      ) : error ? (
        <Alert tone="danger" title="No se pudo cargar el comprobante">
          {error.message}{' '}
          <Button size="sm" variant="ghost" icon={RotateCw} onClick={refetch}>
            Reintentar
          </Button>
        </Alert>
      ) : (
        <>
          {onNewSale && (
            <div className="sale-success" role="status">
              <svg className="sale-success__check" viewBox="0 0 52 52" aria-hidden="true">
                <circle className="sale-success__circle" cx="26" cy="26" r="24" />
                <path className="sale-success__tick" d="M15 27l7 7 15-16" />
              </svg>
              <div className="sale-success__text">
                <strong>¡Venta registrada!</strong>
                <span>
                  {sale.number} · {formatCurrency(sale.total)}
                  {Number(sale.creditAmount) > 0 && ` · fiado ${formatCurrency(sale.creditAmount)}`}
                </span>
              </div>
              {change !== null && Number(change) > 0 && (
                <div className="sale-success__change">
                  <span>Entregar de cambio</span>
                  <strong>{formatCurrency(change)}</strong>
                </div>
              )}
            </div>
          )}

          <div className="sale-actions">
            <ActionTile icon={Printer} label="Imprimir tirilla" hint={`Rollo de ${ticketFormat(data.receipt).replace('mm', ' mm')}`} primary onClick={() => handlePrint('ticket')} />
            <ActionTile icon={FileText} label="Imprimir carta" hint="Hoja carta" onClick={() => handlePrint('letter')} />
            <ActionTile icon={FileDown} label="PDF" hint="Descargar o guardar" onClick={handlePdf} />
            <ActionTile icon={MessageCircle} label="WhatsApp" hint={sharing ? 'Preparando el PDF…' : 'Enviar el PDF'} onClick={handleWhatsapp} disabled={sharing} />
            <ActionTile
              icon={Mail}
              label="Enviar por correo"
              hint={data.emailEnabled ? 'El PDF al correo del cliente' : 'Apagado en Configuración'}
              onClick={focusEmail}
              disabled={!data.emailEnabled}
            />
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
              <Receipt key={view} view={view} sale={sale} business={data.business} receipt={data.receipt} />
            </div>
          </div>

          {createPortal(
            <div className={`sale-print-root sale-print-root--${printView}`} ref={printRef} aria-hidden="true">
              <Receipt view={printView} sale={sale} business={data.business} receipt={data.receipt} />
            </div>,
            document.body,
          )}

          {data.emailEnabled && (
            <form className="sale-receipt__email" ref={emailRef} onSubmit={handleEmail} noValidate>
              <TextField
                label="Enviar por correo"
                icon={Mail}
                type="email"
                placeholder="correo@cliente.com"
                value={email ?? sale.customer?.email ?? ''}
                onChange={(event) => setEmail(event.target.value)}
                error={fieldErrors.email ?? formError}
              />
              <Button type="submit" variant="secondary" icon={Send} isLoading={emailState.isLoading}>
                Enviar
              </Button>
            </form>
          )}
        </>
      )}
    </Modal>
  )
}
