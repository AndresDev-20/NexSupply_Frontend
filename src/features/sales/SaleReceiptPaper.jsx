import { formatCurrency, formatQuantity } from '../../utils/format'
import { BRANDING_LOGO_SRC } from '../../config/env'
import { contactLine, customerDocument, customerName, initialsOf, isCreditSale, receiptDate, ticketFormat } from './receiptHelpers'
import './SaleReceiptPaper.css'

function Row({ label, value, strong = false, tone }) {
  return (
    <div className={`rcpt__row${strong ? ' rcpt__row--strong' : ''}${tone ? ` rcpt__row--${tone}` : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

/**
 * Comprobante de venta en tirilla de 58 u 80 mm (D10, D-CFG-6, D-VEN-10). En pantalla y al
 * imprimir se ve igual (con fondos; en una térmica los colores salen en gris). Dice
 * "Comprobante de venta" y el aviso legal: nunca "Factura electrónica".
 * La versión en hoja carta es SaleReceiptLetter.
 */
export function SaleReceiptPaper({ sale, business, receipt }) {
  const { day, time } = receiptDate(sale.createdAt)
  const isCredit = isCreditSale(sale)
  const itemsCount = sale.items.length
  const document = customerDocument(sale)
  const contact = contactLine(business)
  return (
    <article className={`rcpt rcpt--${ticketFormat(receipt)}`} aria-label={`${receipt.title} ${sale.number}`}>
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
        <span className="rcpt__doc-label">{receipt.title}</span>
        <strong className="rcpt__doc-number">{sale.number}</strong>
        <span className="rcpt__doc-date">
          {day} · {time}
        </span>
      </section>

      {sale.status === 'cancelled' && (
        <div className="rcpt__void" role="note">
          <strong>Venta anulada</strong>
          {sale.cancelReason && <span>{sale.cancelReason}</span>}
        </div>
      )}

      <dl className="rcpt__meta">
        <div>
          <dt>Cliente</dt>
          <dd>{customerName(sale)}</dd>
        </div>
        {document && (
          <div>
            <dt>Documento</dt>
            <dd>{document}</dd>
          </div>
        )}
        <div>
          <dt>Atendió</dt>
          <dd>{sale.seller?.fullName}</dd>
        </div>
        {sale.register && (
          <div>
            <dt>Caja</dt>
            <dd>{sale.register.name}</dd>
          </div>
        )}
        <div>
          <dt>Pago</dt>
          <dd>{isCredit ? 'Fiado' : 'Contado'}</dd>
        </div>
      </dl>

      <div className="rcpt__items">
        <div className="rcpt__items-head">
          <span>
            {itemsCount} {itemsCount === 1 ? 'producto' : 'productos'}
          </span>
          <span>Valor</span>
        </div>
        {sale.items.map((item) => (
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
        <Row label="Subtotal" value={formatCurrency(sale.subtotal)} />
        {Number(sale.discountTotal) > 0 && <Row label="Descuentos" value={`−${formatCurrency(sale.discountTotal)}`} tone="saving" />}
        {sale.taxEnabled && Number(sale.taxTotal) > 0 && (
          <>
            <Row label="Base gravable" value={formatCurrency(sale.taxBase)} />
            <Row label="IVA" value={formatCurrency(sale.taxTotal)} />
          </>
        )}
        {Number(sale.roundingAdjustment) !== 0 && <Row label="Redondeo" value={formatCurrency(sale.roundingAdjustment)} />}
        {/* Flete con conductor (D-FLE-1): va en la misma factura */}
        {Number(sale.freightAmount ?? 0) > 0 && <Row label={`Flete${sale.freightDriver ? ` · ${sale.freightDriver.name}` : ''}`} value={formatCurrency(sale.freightAmount)} />}
      </div>

      <div className="rcpt__total">
        <span>Total</span>
        <strong>{formatCurrency(sale.total)}</strong>
      </div>

      <div className="rcpt__payments">
        {sale.payments.map((payment) => (
          <div key={payment.id} className="rcpt__payment">
            <Row label={payment.paymentMethod?.name} value={formatCurrency(payment.amount)} strong />
            {payment.paymentReference && <Row label="Referencia" value={payment.paymentReference} />}
            {payment.isCash && payment.received && (
              <>
                <Row label="Recibido" value={formatCurrency(payment.received)} />
                <Row label="Cambio" value={formatCurrency(payment.change ?? '0')} strong />
              </>
            )}
          </div>
        ))}
      </div>

      {sale.layaway && (
        <div className="rcpt__payments">
          <Row label={`Pagado con abonos del apartado ${sale.layaway.number}`} value={formatCurrency(sale.total)} strong />
        </div>
      )}

      {isCredit && (
        <div className="rcpt__credit">
          <span>Queda debiendo</span>
          <strong>{formatCurrency(sale.creditAmount)}</strong>
          {sale.receivable?.number && <small>Cuenta {sale.receivable.number}</small>}
        </div>
      )}

      <footer className="rcpt__foot">
        {receipt.footerMessage && <p className="rcpt__thanks">{receipt.footerMessage}</p>}
        <p className="rcpt__legal">{receipt.legalNotice}</p>
        <p className="rcpt__dev">Desarrollado por Nexoon</p>
      </footer>
    </article>
  )
}
