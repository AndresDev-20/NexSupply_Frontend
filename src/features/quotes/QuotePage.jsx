import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, FileDown, FileText, Mail, MessageCircle, RotateCw, ShoppingCart, TriangleAlert } from 'lucide-react'
import { getQuotePdfFile, openQuotePdf, useCancelQuoteMutation, useEmailQuoteMutation, useGetQuoteQuery } from './quotesApi'
import { STATE_TONE, daysLeftText, quoteShareText } from './quoteOptions'
import { shareReceiptPdf } from '../sales/shareReceipt'
import { useBusinessName } from '../settings/useBusinessName'
import { useCan } from '../../hooks/usePermissions'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { StatusMessage } from '../../components/feedback/StatusMessage/StatusMessage'
import { Alert } from '../../components/feedback/Alert/Alert'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { Badge } from '../../components/ui/Badge/Badge'
import { TextField } from '../../components/ui/TextField/TextField'
import { TextAreaField } from '../../components/ui/TextAreaField/TextAreaField'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import { formatCurrency, formatDateTime, formatQuantity } from '../../utils/format'
import { ROUTES } from '../../routes/paths'
import '../admin/admin.css'
import '../cash/cash.css'
import './quotes.css'

const dayText = (iso) => iso.split('-').reverse().join('/')

/** Anular con motivo. */
function CancelQuoteModal({ quote, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState(null)
  const [cancelQuote, state] = useCancelQuoteMutation()
  const handleSubmit = async (event) => {
    event.preventDefault()
    if (reason.trim().length < 3) return setLocalError('Escribe por qué se anula')
    try {
      await cancelQuote({ id: quote.id, reason: reason.trim() }).unwrap()
      onDone()
    } catch (cancelError) {
      setLocalError(cancelError.message)
    }
    return undefined
  }
  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={state.isLoading}
      icon={Ban}
      title={`Anular la cotización ${quote.number}`}
      description="Queda anulada con su motivo; no se borra."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={state.isLoading}>
            Volver
          </Button>
          <Button type="submit" form="cancel-quote-form" variant="danger" isLoading={state.isLoading}>
            Anular cotización
          </Button>
        </>
      }
    >
      <form id="cancel-quote-form" onSubmit={handleSubmit} noValidate>
        <TextAreaField label="Motivo" rows={2} maxLength={255} data-autofocus value={reason} onChange={(event) => setReason(event.target.value)} error={localError} required />
      </form>
    </Modal>
  )
}

/** /ventas/cotizaciones/:id — Cotización: productos, total, compartir, vender o anular (D-COT-1). */
export default function QuotePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const businessName = useBusinessName()
  const canCreate = useCan('quotes.create')
  const canSell = useCan('sales.create')
  const { data: quote, error, isLoading, refetch } = useGetQuoteQuery(id)
  const [sendEmail, emailState] = useEmailQuoteMutation()
  const [email, setEmail] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  if (isLoading) return <Spinner label="Cargando la cotización…" />
  if (error || !quote) {
    return (
      <StatusMessage icon={TriangleAlert} tone="danger" title={error?.status === 404 ? 'La cotización no existe' : 'No se pudo cargar la cotización'} description={error?.message}>
        <Link className="button button--secondary button--md" to={ROUTES.quotes}>
          <ArrowLeft className="button__icon" aria-hidden="true" />
          <span className="button__label">Volver a cotizaciones</span>
        </Link>
        {error?.status !== 404 && (
          <Button icon={RotateCw} onClick={refetch}>
            Reintentar
          </Button>
        )}
      </StatusMessage>
    )
  }

  const handlePdf = async () => {
    try {
      await openQuotePdf(quote.id)
    } catch (pdfError) {
      toast.error(pdfError.message)
    }
  }
  const handleWhatsapp = async () => {
    setSharing(true)
    try {
      const file = await getQuotePdfFile(quote.id, quote.number)
      const result = await shareReceiptPdf({ file, sale: quote, businessName, text: quoteShareText(quote, businessName), title: `Cotización ${quote.number}` })
      if (result === 'downloaded') toast.info('Se descargó el PDF de la cotización: adjúntalo en el chat de WhatsApp que se abrió')
    } catch (shareError) {
      toast.error(shareError.message ?? 'No se pudo preparar la cotización')
    } finally {
      setSharing(false)
    }
  }
  const handleEmail = async (event) => {
    event.preventDefault()
    try {
      const result = await sendEmail({ id: quote.id, email: email ?? quote.customer.email ?? '' }).unwrap()
      if (result.simulated) toast.error(result.message)
      else toast.success(result.message ?? `Cotización enviada a ${result.to}`)
    } catch (sendError) {
      toast.error(sendError.details?.[0]?.message ?? sendError.message)
    }
  }

  const columns = [
    {
      key: 'product',
      header: 'Producto',
      primary: true,
      render: (item) => (
        <span className="quote-product">
          <strong>{item.productName}</strong>
          <small>
            {formatQuantity(item.quantity)} {item.presentationName ?? item.unitSymbol} × {formatCurrency(item.unitPrice)}
            {item.regularUnitPrice && Number(item.regularUnitPrice) > Number(item.unitPrice) && <s> {formatCurrency(item.regularUnitPrice)}</s>}
          </small>
        </span>
      ),
    },
    { key: 'discount', header: 'Descuento', align: 'end', render: (item) => (Number(item.lineDiscount) > 0 ? `−${formatCurrency(item.lineDiscount)}` : '—') },
    { key: 'total', header: 'Total', align: 'end', render: (item) => <strong className="numeric">{formatCurrency(item.total)}</strong> },
  ]

  const tone = { open: 'success', expired: 'warning', converted: 'info', cancelled: 'warning' }[quote.state]
  return (
    <div className="purchase-detail">
      <Link className="cash-session__back" to={ROUTES.quotes}>
        <ArrowLeft aria-hidden="true" /> Cotizaciones
      </Link>

      <header className={`cash-session__header cash-session__header--${tone}`}>
        <span className="cash-session__icon" aria-hidden="true">
          <FileText />
        </span>
        <div className="cash-session__title">
          <h2>{quote.number}</h2>
          <p>
            {quote.customer.name}
            {quote.customer.phone ? ` · ${quote.customer.phone}` : ''} · {formatDateTime(quote.createdAt)}
            {quote.seller ? ` · ${quote.seller.fullName}` : ''}
          </p>
        </div>
        <Badge tone={STATE_TONE[quote.state]}>{quote.stateLabel}</Badge>
      </header>

      {quote.state === 'open' && (
        <Alert tone="success">
          Válida hasta el {dayText(quote.validUntil)} ({daysLeftText(quote.daysLeft).toLowerCase()}). Al venderla se respetan estos precios.
        </Alert>
      )}
      {quote.state === 'expired' && <Alert tone="warning">Venció el {dayText(quote.validUntil)}. Si se vende, es al precio de hoy.</Alert>}
      {quote.state === 'converted' && (
        <Alert tone="info">
          Se vendió.{' '}
          {quote.saleId && (
            <Link to={ROUTES.sales} className="quote-link">
              Verla en Ventas
            </Link>
          )}
        </Alert>
      )}
      {quote.state === 'cancelled' && (
        <Alert tone="warning">
          Anulada{quote.cancelledBy ? ` por ${quote.cancelledBy.fullName}` : ''}: {quote.cancelReason}
        </Alert>
      )}

      <div className="quote-actions">
        <Button variant="secondary" icon={FileDown} onClick={handlePdf}>
          Ver o imprimir PDF
        </Button>
        <Button variant="secondary" icon={MessageCircle} isLoading={sharing} onClick={handleWhatsapp}>
          WhatsApp
        </Button>
        {canSell && ['open', 'expired'].includes(quote.state) && (
          <Button icon={ShoppingCart} onClick={() => navigate(ROUTES.pos, { state: { quoteId: quote.id } })}>
            Vender esta cotización
          </Button>
        )}
        {canCreate && ['open', 'expired'].includes(quote.state) && (
          <Button variant="danger" icon={Ban} onClick={() => setIsCancelling(true)}>
            Anular
          </Button>
        )}
      </div>

      <DataTable caption={`Productos de ${quote.number}`} columns={columns} rows={quote.items} />

      <section className="quote-totals" aria-label="Totales">
        <div>
          <span>Subtotal</span>
          <span>{formatCurrency(quote.subtotal)}</span>
        </div>
        {Number(quote.discountTotal) > 0 && (
          <div>
            <span>Descuentos</span>
            <span>−{formatCurrency(quote.discountTotal)}</span>
          </div>
        )}
        {quote.taxEnabled && Number(quote.taxTotal) > 0 && (
          <div>
            <span>IVA</span>
            <span>{formatCurrency(quote.taxTotal)}</span>
          </div>
        )}
        {Number(quote.roundingAdjustment) !== 0 && (
          <div>
            <span>Redondeo</span>
            <span>{formatCurrency(quote.roundingAdjustment)}</span>
          </div>
        )}
        <div className="quote-totals__total">
          <span>Total</span>
          <strong>{formatCurrency(quote.total)}</strong>
        </div>
        {quote.priceList && <small>Precios de la lista {quote.priceList.name}</small>}
        {quote.notes && <small>Nota: {quote.notes}</small>}
      </section>

      <form className="quote-email" onSubmit={handleEmail} noValidate>
        <TextField label="Enviar por correo" icon={Mail} type="email" placeholder="correo@ejemplo.com" value={email ?? quote.customer.email ?? ''} onChange={(event) => setEmail(event.target.value)} />
        <Button type="submit" variant="secondary" isLoading={emailState.isLoading}>
          Enviar
        </Button>
      </form>

      {isCancelling && (
        <CancelQuoteModal
          quote={quote}
          onClose={() => setIsCancelling(false)}
          onDone={() => {
            setIsCancelling(false)
            toast.success(`Cotización ${quote.number} anulada`)
          }}
        />
      )}
    </div>
  )
}
