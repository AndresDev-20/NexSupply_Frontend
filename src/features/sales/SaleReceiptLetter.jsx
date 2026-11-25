import { formatCurrency, formatQuantity } from '../../utils/format'
import { BRANDING_LOGO_SRC } from '../../config/env'
import { contactLine, customerDocument, customerName, initialsOf, isCreditSale, receiptDate } from './receiptHelpers'
import './SaleReceiptLetter.css'

function Total({ label, value, tone }) {
  return (
    <div className={`rcl__sum${tone ? ` rcl__sum--${tone}` : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

/**
 * Comprobante de venta en hoja carta (D-VEN-10): negocio a la izquierda y el comprobante a la
 * derecha, tabla de productos, pagos y totales lado a lado. Mismo estilo que la tirilla.
 */
export function SaleReceiptLetter({ sale, business, receipt }) {
  const { day, time } = receiptDate(sale.createdAt)
  const isCredit = isCreditSale(sale)
  const document = customerDocument(sale)
  const contact = contactLine(business)
  const hasDiscounts = sale.items.some((item) => Number(item.lineDiscount) > 0)
  return (
    <article className="rcl" aria-label={`${receipt.title} ${sale.number}`}>
      <header className="rcl__head">
        <div className="rcl__brand">
          {receipt.showLogo && business.hasLogo ? (
            <img className="rcl__logo" src={BRANDING_LOGO_SRC} alt="" />
          ) : (
            <span className="rcl__monogram" aria-hidden="true">
              {initialsOf(business.name)}
            </span>
          )}
          <div>
            <p className="rcl__business">{business.name}</p>
            <p className="rcl__muted">
              {business.nit ? `NIT ${business.nit} · ` : ''}
              {receipt.taxRegime}
            </p>
            {business.address && <p className="rcl__muted">{business.address}</p>}
            {contact && <p className="rcl__muted">{contact}</p>}
          </div>
        </div>
        <section className="rcl__doc">
          <span className="rcl__doc-label">{receipt.title}</span>
          <strong className="rcl__doc-number">{sale.number}</strong>
          <span className="rcl__doc-date">
            {day} · {time}
          </span>
        </section>
      </header>

      <dl className="rcl__meta">
        <div>
          <dt>Cliente</dt>
          <dd>
            {customerName(sale)}
            {document && <small>{document}</small>}
          </dd>
        </div>
        <div>
          <dt>Atendió</dt>
          <dd>{sale.seller?.fullName}</dd>
        </div>
        <div>
          <dt>Caja</dt>
          <dd>{sale.register?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Pago</dt>
          <dd>{isCredit ? 'Fiado' : 'Contado'}</dd>
        </div>
      </dl>

      <table className="rcl__table">
        <thead>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col" className="rcl__num">
              Cant.
            </th>
            <th scope="col" className="rcl__num">
              Precio
            </th>
            {hasDiscounts && (
              <th scope="col" className="rcl__num">
                Descuento
              </th>
            )}
            <th scope="col" className="rcl__num">
              Valor
            </th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.id}>
              <td>
                <span className="rcl__product">{item.productName}</span>
                <span className="rcl__unit">{item.presentationName ?? item.unitSymbol}</span>
              </td>
              <td className="rcl__num">{formatQuantity(item.quantity)}</td>
              <td className="rcl__num">{formatCurrency(item.unitPrice)}</td>
              {hasDiscounts && <td className="rcl__num rcl__saving">{Number(item.lineDiscount) > 0 ? `−${formatCurrency(item.lineDiscount)}` : '—'}</td>}
              <td className="rcl__num rcl__strong">{formatCurrency(item.gross)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rcl__bottom">
        <div className="rcl__side">
          <section className="rcl__box">
            <h3 className="rcl__box-title">Pagos</h3>
            {sale.payments.map((payment) => (
              <div key={payment.id} className="rcl__payment">
                <Total label={payment.paymentMethod?.name} value={formatCurrency(payment.amount)} tone="strong" />
                {payment.paymentReference && <Total label="Referencia" value={payment.paymentReference} />}
                {payment.isCash && payment.received && (
                  <>
                    <Total label="Recibido" value={formatCurrency(payment.received)} />
                    <Total label="Cambio" value={formatCurrency(payment.change ?? '0')} tone="strong" />
                  </>
                )}
              </div>
            ))}
            {sale.layaway && <Total label={`Abonos del apartado ${sale.layaway.number}`} value={formatCurrency(sale.total)} tone="strong" />}
            {sale.payments.length === 0 && !sale.layaway && <p className="rcl__muted">Sin pagos en la venta</p>}
          </section>
          {isCredit && (
            <div className="rcl__credit">
              <span>Queda debiendo</span>
              <strong>{formatCurrency(sale.creditAmount)}</strong>
              {sale.receivable?.number && <small>Cuenta {sale.receivable.number}</small>}
            </div>
          )}
        </div>
        <div className="rcl__totals">
          <Total label="Subtotal" value={formatCurrency(sale.subtotal)} />
          {Number(sale.discountTotal) > 0 && <Total label="Descuentos" value={`−${formatCurrency(sale.discountTotal)}`} tone="saving" />}
          {sale.taxEnabled && Number(sale.taxTotal) > 0 && (
            <>
              <Total label="Base gravable" value={formatCurrency(sale.taxBase)} />
              <Total label="IVA" value={formatCurrency(sale.taxTotal)} />
            </>
          )}
          {Number(sale.roundingAdjustment) !== 0 && <Total label="Redondeo" value={formatCurrency(sale.roundingAdjustment)} />}
          {/* Flete con conductor (D-FLE-1): va en la misma factura */}
          {Number(sale.freightAmount ?? 0) > 0 && <Total label={`Flete${sale.freightDriver ? ` · ${sale.freightDriver.name}` : ''}`} value={formatCurrency(sale.freightAmount)} />}
          <div className="rcl__total">
            <span>Total</span>
            <strong>{formatCurrency(sale.total)}</strong>
          </div>
        </div>
      </div>

      <footer className="rcl__foot">
        {receipt.footerMessage && <p className="rcl__thanks">{receipt.footerMessage}</p>}
        <p className="rcl__muted">{receipt.legalNotice}</p>
        <p className="rcl__dev">Desarrollado por Nexoon</p>
      </footer>
    </article>
  )
}
