import { formatCurrency, formatDate, formatQuantity } from '../../utils/format'
import { BRANDING_LOGO_SRC } from '../../config/env'
import { formatDay } from '../purchases/purchaseOptions'
import { contactLine, customerDocument, initialsOf, receiptDate, ticketFormat } from '../sales/receiptHelpers'
import '../sales/SaleReceiptPaper.css'

function Row({ label, value, strong = false }) {
  return (
    <div className={`rcpt__row${strong ? ' rcpt__row--strong' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

/**
 * Comprobante de apartado (D7b, D-APA-6): el mismo diseño de la tirilla de venta. Dice qué quedó
 * reservado, lo abonado, lo que falta y hasta cuándo. Al entregar se imprime el comprobante de venta.
 */
export function LayawayReceiptPaper({ layaway, business, receipt }) {
  const { day, time } = receiptDate(layaway.createdAt)
  const document = customerDocument({ customer: { ...layaway.customer, isFinalConsumer: false } })
  const contact = contactLine(business)
  const pendingInstallments = (layaway.installments ?? []).filter((item) => Number(item.pending) > 0)
  const activePayments = (layaway.payments ?? []).filter((payment) => payment.status !== 'cancelled')
  return (
    <article className={`rcpt rcpt--${ticketFormat(receipt)}`} aria-label={`Comprobante de apartado ${layaway.number}`}>
      <header className="rcpt__brand">
        {receipt.showLogo && business.hasLogo ? (
          <img className="rcpt__logo" src={BRANDING_LOGO_SRC} alt="" />
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

      <section className="rcpt__doc">
        <span className="rcpt__doc-label">Comprobante de apartado</span>
        <strong className="rcpt__doc-number">{layaway.number}</strong>
        <span className="rcpt__doc-date">
          {day} · {time}
        </span>
      </section>

      <dl className="rcpt__meta">
        <div>
          <dt>Cliente</dt>
          <dd>{layaway.customer?.name}</dd>
        </div>
        {document && (
          <div>
            <dt>Documento</dt>
            <dd>{document}</dd>
          </div>
        )}
        <div>
          <dt>Atendió</dt>
          <dd>{layaway.createdBy?.fullName}</dd>
        </div>
        <div>
          <dt>Pagar antes del</dt>
          <dd>{formatDay(layaway.dueDate)}</dd>
        </div>
      </dl>

      <div className="rcpt__items">
        <div className="rcpt__items-head">
          <span>Apartado</span>
          <span>Valor</span>
        </div>
        {layaway.items.map((item) => (
          <div key={item.id} className="rcpt__item">
            <div className="rcpt__item-main">
              <span className="rcpt__item-name">{item.productName}</span>
              <span className="rcpt__item-total">{formatCurrency(item.gross)}</span>
            </div>
            <span className="rcpt__item-detail">
              {formatQuantity(item.quantity)} {item.presentationName ?? item.unitSymbol} × {formatCurrency(item.unitPrice)}
            </span>
            {Number(item.lineDiscount) > 0 && (
              <div className="rcpt__item-discount">
                <span>Descuento</span>
                <span>−{formatCurrency(item.lineDiscount)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rcpt__totals">
        <Row label="Subtotal" value={formatCurrency(layaway.subtotal)} />
        {Number(layaway.discountTotal) > 0 && <Row label="Descuentos" value={`−${formatCurrency(layaway.discountTotal)}`} />}
        {layaway.taxEnabled && Number(layaway.taxTotal) > 0 && <Row label="IVA" value={formatCurrency(layaway.taxTotal)} />}
      </div>

      <div className="rcpt__total">
        <span>Total</span>
        <strong>{formatCurrency(layaway.total)}</strong>
      </div>

      <div className="rcpt__payments">
        {activePayments.map((payment) => (
          <div key={payment.id} className="rcpt__payment">
            <Row label={`Abono ${payment.number}`} value={formatCurrency(payment.amount)} strong />
            <Row label={`${formatDate(payment.paidAt)}${payment.method ? ` · ${payment.method}` : ''}`} value="" />
          </div>
        ))}
        <Row label="Abonado" value={formatCurrency(layaway.amountPaid)} strong />
      </div>

      {Number(layaway.balance) > 0 ? (
        <div className="rcpt__credit">
          <span>Falta por pagar</span>
          <strong>{formatCurrency(layaway.balance)}</strong>
          <small>Antes del {formatDay(layaway.dueDate)}</small>
        </div>
      ) : (
        layaway.status === 'paid' && (
          <div className="rcpt__credit">
            <span>Pagado</span>
            <strong>Listo para entregar</strong>
          </div>
        )
      )}

      {pendingInstallments.length > 1 && (
        <div className="rcpt__totals">
          {pendingInstallments.map((item) => (
            <Row key={item.id} label={`Cuota ${item.installmentNumber} · ${formatDay(item.dueDate)}`} value={formatCurrency(item.pending)} />
          ))}
        </div>
      )}

      <footer className="rcpt__foot">
        <p className="rcpt__thanks">Su producto queda apartado</p>
        <p className="rcpt__legal">Se entrega completo cuando se pague el total. El precio queda congelado. Conserve este comprobante.</p>
        <p className="rcpt__legal">{receipt.legalNotice}</p>
        <p className="rcpt__dev">Desarrollado por Nexoon</p>
      </footer>
    </article>
  )
}
