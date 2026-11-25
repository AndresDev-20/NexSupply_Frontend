import { formatCurrency, formatDate } from '../../utils/format'
import { BRANDING_LOGO_SRC } from '../../config/env'
import { formatDay } from '../purchases/purchaseOptions'
import { contactLine, initialsOf, receiptDate } from '../sales/receiptHelpers'
import '../sales/SaleReceiptPaper.css'
import './accountReceipt.css'

// Comprobantes de cartera (D-CLI-11) con el diseño de la tirilla de venta. format: '58mm', '80mm' o 'letter'.

function Row({ label, value, strong = false, saving = false }) {
  return (
    <div className={`rcpt__row${strong ? ' rcpt__row--strong' : ''}${saving ? ' rcpt__row--saving' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Brand({ business, receipt }) {
  const contact = contactLine(business)
  return (
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
  )
}

function DocBand({ label, number, date }) {
  const { day, time } = receiptDate(date)
  return (
    <section className="rcpt__doc">
      <span className="rcpt__doc-label">{label}</span>
      <strong className="rcpt__doc-number">{number}</strong>
      <span className="rcpt__doc-date">
        {day} · {time}
      </span>
    </section>
  )
}

function CustomerMeta({ customer, extra = [] }) {
  const rows = [['Cliente', customer?.name], ...(customer?.documentNumber ? [['Documento', `${customer.documentType} ${customer.documentNumber}`]] : []), ...(customer?.phone ? [['Celular', customer.phone]] : []), ...extra]
  return (
    <dl className="rcpt__meta">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Foot({ receipt, thanks = null }) {
  return (
    <footer className="rcpt__foot">
      {thanks && <p className="rcpt__thanks">{thanks}</p>}
      <p className="rcpt__legal">{receipt.legalNotice}</p>
      <p className="rcpt__dev">Desarrollado por Nexoon</p>
    </footer>
  )
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

/** Una deuda (o todas, «Estado de cuenta») con sus cuotas, sus abonos y lo que falta. */
export function DebtsReceiptPaper({ document, business, receipt, format }) {
  const { debts, totals } = document
  return (
    <article className={`rcpt rcpt--${format}`} aria-label={`${document.title} ${document.number}`}>
      <Brand business={business} receipt={receipt} />
      <DocBand label={document.title} number={document.number} date={document.generatedAt} />
      <CustomerMeta customer={document.customer} extra={[['Fecha de corte', formatDate(document.generatedAt)]]} />

      {debts.length === 0 ? (
        <p className="rcpt__empty">No tiene deudas por pagar</p>
      ) : (
        <div className="rcpt__items">
          <div className="rcpt__items-head">
            <span>{plural(debts.length, 'deuda', 'deudas')}</span>
            <span>Saldo</span>
          </div>
          {debts.map((debt) => (
            <div key={debt.id} className="rcpt__item">
              <div className="rcpt__item-main">
                <span className="rcpt__item-name">
                  {debt.number} · {debt.description}
                </span>
                <span className="rcpt__item-total">{formatCurrency(debt.balance)}</span>
              </div>
              <span className="rcpt__item-detail">
                {debt.originLabel} · {formatDay(debt.issueDate)}
                {debt.dueDate && ` · Pagar antes del ${formatDay(debt.dueDate)}`}
              </span>
              <div className="rcpt__debt-rows">
                <Row label="Valor de la deuda" value={formatCurrency(debt.total)} />
                {debt.paymentMode === 'installments' &&
                  debt.installments.map((item) => (
                    <Row key={item.id ?? item.installmentNumber} label={`Cuota ${item.installmentNumber} · ${formatDay(item.dueDate)}`} value={Number(item.pending) > 0 ? `Debe ${formatCurrency(item.pending)}` : 'Pagada'} />
                  ))}
                {debt.payments.map((payment) => (
                  <Row key={payment.id} label={`Abono ${payment.number} · ${formatDate(payment.paidAt)}${payment.method ? ` · ${payment.method}` : ''}`} value={`−${formatCurrency(payment.amount)}`} saving />
                ))}
                <Row label="Abonado" value={formatCurrency(debt.amountPaid)} />
                {debt.status === 'paid' && <Row label="Estado" value="Pagada" saving />}
                {debt.status === 'cancelled' && <Row label="Estado" value="Anulada" />}
                {Number(debt.overdueAmount) > 0 && <Row label={`Vencido${debt.daysOverdue ? ` (${plural(debt.daysOverdue, 'día', 'días')})` : ''}`} value={formatCurrency(debt.overdueAmount)} strong />}
                <Row label="Saldo" value={formatCurrency(debt.balance)} strong />
              </div>
            </div>
          ))}
        </div>
      )}

      {debts.length > 1 && (
        <div className="rcpt__totals">
          <Row label="Valor de las deudas" value={formatCurrency(totals.total)} />
          <Row label="Abonado" value={formatCurrency(totals.amountPaid)} />
          {Number(totals.overdue) > 0 && <Row label="Vencido" value={formatCurrency(totals.overdue)} strong />}
        </div>
      )}

      <div className="rcpt__total">
        <span>Debe</span>
        <strong>{formatCurrency(totals.balance)}</strong>
      </div>

      {document.kind === 'debt' && Number(document.customerBalance) > Number(totals.balance) && (
        <div className="rcpt__credit">
          <span>Debe en total</span>
          <strong>{formatCurrency(document.customerBalance)}</strong>
          <small>Sumando todas sus deudas</small>
        </div>
      )}

      <Foot receipt={receipt} />
    </article>
  )
}

/** El recibo de un abono: a qué deudas se aplicó y lo que le queda debiendo. */
export function PaymentReceiptPaper({ payment, customerBalance, business, receipt, format }) {
  const showBranch = new Set(payment.allocations.map((item) => item.branch?.id)).size > 1
  return (
    <article className={`rcpt rcpt--${format}`} aria-label={`Recibo de abono ${payment.number}`}>
      <Brand business={business} receipt={receipt} />
      <DocBand label="Recibo de abono" number={payment.number} date={payment.paidAt} />
      {payment.status === 'cancelled' && <p className="rcpt__cancelled">ANULADO: {payment.cancelReason}</p>}
      <CustomerMeta customer={payment.customer} extra={[['Recibió', payment.createdBy?.fullName ?? '—']]} />

      <div className="rcpt__items">
        <div className="rcpt__items-head">
          <span>Abonado a</span>
          <span>Valor</span>
        </div>
        {payment.allocations.map((item) => (
          <div key={item.receivableId} className="rcpt__item">
            <div className="rcpt__item-main">
              <span className="rcpt__item-name">
                {item.number} · {item.description}
              </span>
              <span className="rcpt__item-total">{formatCurrency(item.amount)}</span>
            </div>
            <div className="rcpt__debt-rows">
              {showBranch && item.branch && <Row label={`Sucursal ${item.branch.name}`} value="" />}
              {item.installments.map((cuota) => (
                <Row key={cuota.installmentNumber} label={`Cuota ${cuota.installmentNumber} · ${formatDay(cuota.dueDate)}`} value={formatCurrency(cuota.amount)} />
              ))}
              <Row label="Queda debiendo" value={Number(item.balanceNow) > 0 ? formatCurrency(item.balanceNow) : 'Pagada'} strong />
            </div>
          </div>
        ))}
      </div>

      <div className="rcpt__total">
        <span>Abonó</span>
        <strong>{formatCurrency(payment.amount)}</strong>
      </div>

      <div className="rcpt__payments">
        <Row label={payment.paymentMethod?.name ?? 'Pago'} value={formatCurrency(payment.amount)} strong />
        {payment.paymentReference && <Row label="Referencia" value={payment.paymentReference} />}
        {payment.notes && <Row label="Nota" value={payment.notes} />}
      </div>

      <div className="rcpt__credit">
        {Number(customerBalance) > 0 ? (
          <>
            <span>Saldo pendiente</span>
            <strong>{formatCurrency(customerBalance)}</strong>
            <small>Lo que debe en total después de este abono</small>
          </>
        ) : (
          <>
            <span>Paz y salvo</span>
            <strong>{formatCurrency('0')}</strong>
            <small>No tiene deudas pendientes</small>
          </>
        )}
      </div>

      <Foot receipt={receipt} thanks="¡Gracias por su pago!" />
    </article>
  )
}
