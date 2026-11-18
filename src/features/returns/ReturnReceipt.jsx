import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { Printer, RotateCw, Undo2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import { Alert } from '../../components/feedback/Alert/Alert'
import { formatCurrency, formatQuantity } from '../../utils/format'
import { contactLine, customerDocument, customerName, initialsOf, receiptDate, ticketFormat } from '../sales/receiptHelpers'
import { printReceipt } from '../sales/printReceipt'
import { useGetSaleReturnReceiptQuery } from './returnsApi'
import '../sales/SaleReceiptPaper.css'
import '../sales/sales.css'
import './returns.css'

function Row({ label, value, strong = false }) {
  return (
    <div className={`rcpt__row${strong ? ' rcpt__row--strong' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

/** Comprobante de devolución (DV): lo devuelto y cómo se reintegró. Mismo diseño de la tirilla de venta. */
export function ReturnReceiptPaper({ saleReturn, business, receipt }) {
  const { day, time } = receiptDate(saleReturn.createdAt)
  const document = customerDocument(saleReturn)
  const contact = contactLine(business)
  return (
    <article className={`rcpt rcpt--${ticketFormat(receipt)}`} aria-label={`Comprobante de devolución ${saleReturn.number}`}>
      <header className="rcpt__brand">
        {receipt.showLogo && business.hasLogo ? (
          <img className="rcpt__logo" src="/api/v1/branding/logo" alt="" />
        ) : (
          <span className="rcpt__monogram" aria-hidden="true">
            {initialsOf(business.name)}
          </span>
        )}
        <p className="rcpt__business">{business.name}</p>
        <p className="rcpt__muted">
          {business.nit ? `NIT ${business.nit} · ` : ''}
          {receipt.taxRegime}
        </p>
        {business.address && <p className="rcpt__muted">{business.address}</p>}
        {contact && <p className="rcpt__muted">{contact}</p>}
      </header>

      <section className="rcpt__doc rcpt__doc--return">
        <span className="rcpt__doc-label">Comprobante de devolución</span>
        <strong className="rcpt__doc-number">{saleReturn.number}</strong>
        <span className="rcpt__doc-date">
          {day} · {time}
        </span>
      </section>

      <dl className="rcpt__meta">
        <div>
          <dt>Cliente</dt>
          <dd>{customerName(saleReturn)}</dd>
        </div>
        {document && (
          <div>
            <dt>Documento</dt>
            <dd>{document}</dd>
          </div>
        )}
        <div>
          <dt>Venta</dt>
          <dd>{saleReturn.sale?.number}</dd>
        </div>
        <div>
          <dt>Atendió</dt>
          <dd>{saleReturn.createdBy?.fullName}</dd>
        </div>
      </dl>

      <div className="rcpt__items">
        <div className="rcpt__items-head">
          <span>Devuelto</span>
          <span>Valor</span>
        </div>
        {saleReturn.items.map((item) => (
          <div key={item.id} className="rcpt__item">
            <div className="rcpt__item-main">
              <span className="rcpt__item-name">{item.productName}</span>
              <span className="rcpt__item-total">{formatCurrency(item.total)}</span>
            </div>
            <span className="rcpt__item-detail">
              {formatQuantity(item.quantity)} {item.presentationName ?? item.unitSymbol} × {formatCurrency(item.unitPrice)} · {item.conditionLabel}
            </span>
          </div>
        ))}
      </div>

      <div className="rcpt__total">
        <span>Total devuelto</span>
        <strong>{formatCurrency(saleReturn.total)}</strong>
      </div>

      <div className="rcpt__payments">
        {Number(saleReturn.debtReduction) > 0 && <Row label="Baja de la deuda" value={formatCurrency(saleReturn.debtReduction)} strong />}
        {Number(saleReturn.refundedAmount) > 0 && <Row label={`Dinero devuelto${saleReturn.refundMethod ? ` (${saleReturn.refundMethod.name})` : ''}`} value={formatCurrency(saleReturn.refundedAmount)} strong />}
        {saleReturn.refundReference && <Row label="Referencia" value={saleReturn.refundReference} />}
        {Number(saleReturn.creditedAmount) > 0 && <Row label="Queda como saldo a favor" value={formatCurrency(saleReturn.creditedAmount)} strong />}
      </div>

      <div className="rcpt__totals">
        <Row label="Motivo" value="" />
        <p className="rcpt__muted">{saleReturn.reason}</p>
      </div>

      <footer className="rcpt__foot">
        <p className="rcpt__thanks">Gracias por su confianza</p>
        <p className="rcpt__legal">{receipt.legalNotice}</p>
        <p className="rcpt__dev">Desarrollado por Nexoon</p>
      </footer>
    </article>
  )
}

/** Ventana del comprobante de devolución, con "Imprimir tirilla". */
export function ReturnReceiptModal({ returnId, onClose, justCreated = false }) {
  const { data, isLoading, error, refetch } = useGetSaleReturnReceiptQuery(returnId)
  const printRef = useRef(null)
  const saleReturn = data?.saleReturn
  return (
    <Modal isOpen onClose={onClose} size="md" icon={Undo2} title={saleReturn ? `Devolución ${saleReturn.number}` : 'Devolución'} footer={<Button onClick={onClose}>Cerrar</Button>}>
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
          {justCreated && (
            <div className="sale-success" role="status">
              <svg className="sale-success__check" viewBox="0 0 52 52" aria-hidden="true">
                <circle className="sale-success__circle" cx="26" cy="26" r="24" />
                <path className="sale-success__tick" d="M15 27l7 7 15-16" />
              </svg>
              <div className="sale-success__text">
                <strong>¡Devolución registrada!</strong>
                <span>
                  {saleReturn.number} · {formatCurrency(saleReturn.total)}
                </span>
              </div>
              {Number(saleReturn.refundedAmount) > 0 && (
                <div className="sale-success__change">
                  <span>Entregar al cliente</span>
                  <strong>{formatCurrency(saleReturn.refundedAmount)}</strong>
                </div>
              )}
            </div>
          )}
          <div className="sale-actions">
            <button type="button" className="sale-action sale-action--primary" onClick={() => printReceipt(printRef.current?.firstElementChild, ticketFormat(data.receipt))}>
              <span className="sale-action__icon" aria-hidden="true">
                <Printer />
              </span>
              <span className="sale-action__text">
                <span className="sale-action__label">Imprimir tirilla</span>
                <span className="sale-action__hint">Para el cliente</span>
              </span>
            </button>
          </div>
          <div className="sale-receipt__scroll">
            <ReturnReceiptPaper saleReturn={saleReturn} business={data.business} receipt={data.receipt} />
          </div>
          {createPortal(
            <div className="sale-print-root sale-print-root--ticket" ref={printRef} aria-hidden="true">
              <ReturnReceiptPaper saleReturn={saleReturn} business={data.business} receipt={data.receipt} />
            </div>,
            document.body,
          )}
        </>
      )}
    </Modal>
  )
}
