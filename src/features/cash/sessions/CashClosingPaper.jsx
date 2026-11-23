import { formatCurrency, formatDateTime } from '../../../utils/format'
import { BRANDING_LOGO_SRC } from '../../../config/env'
import { contactLine, initialsOf } from '../../sales/receiptHelpers'
import { DENOMINATIONS, denominationLabel } from '../denominations'
import './CashClosingPaper.css'

function Row({ label, value, strong = false, tone }) {
  return (
    <div className={`ccp-row${strong ? ' ccp-row--strong' : ''}${tone ? ` ccp-row--${tone}` : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Box({ title, children, className = '' }) {
  return (
    <section className={`ccp-box ${className}`}>
      <h4 className="ccp-box__title">{title}</h4>
      {children}
    </section>
  )
}

/** Billetes y monedas contados, solo los que tienen cantidad. */
function Breakdown({ items }) {
  const rows = (items ?? []).filter((item) => item.quantity > 0)
  if (rows.length === 0) return <p className="ccp-muted">Sin detalle de billetes y monedas.</p>
  return (
    <table className="ccp-table">
      <thead>
        <tr>
          <th scope="col">Denominación</th>
          <th scope="col" className="ccp-num">
            Cant.
          </th>
          <th scope="col" className="ccp-num">
            Valor
          </th>
        </tr>
      </thead>
      <tbody>
        {DENOMINATIONS.map((denomination) => {
          const row = rows.find((item) => item.value === denomination.value && item.kind === denomination.kind)
          if (!row) return null
          return (
            <tr key={`${row.kind}:${row.value}`}>
              <td>{denominationLabel(denomination)}</td>
              <td className="ccp-num">× {row.quantity}</td>
              <td className="ccp-num">{formatCurrency(row.subtotal)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

const abs = (value) => formatCurrency(String(Math.abs(Number(value))))

/**
 * Informe de cierre de caja para imprimir (D-CAJA-14), con el mismo estilo de los comprobantes
 * de venta: logo y datos del negocio, ventas del turno, efectivo que entró y salió, esperado,
 * contado por billetes y monedas, diferencia, lo que se deja de base y lo que se entrega, firmas
 * y la firma del software (Nexoon). format: '58mm' | '80mm' | 'letter' (en carta, dos columnas).
 * business: { name, nit, address, phone, whatsapp, taxRegime, hasLogo, showLogo }.
 */
export function CashClosingPaper({ session, business = {}, format = '80mm' }) {
  const summary = session.summary ?? {}
  const sales = summary.sales
  const types = (summary.byType ?? []).filter((type) => Number(type.total) !== 0)
  const methods = summary.byPaymentMethod ?? []
  const isCounted = session.countedCash !== null && session.countedCash !== undefined
  const difference = Number(session.difference)
  const status = !isCounted ? { tone: 'pending', text: 'Sin contar' } : difference === 0 ? { tone: 'ok', text: 'Caja cuadrada' } : { tone: 'alert', text: `${difference < 0 ? 'Faltante' : 'Sobrante'} de ${abs(difference)}` }
  const contact = contactLine(business)
  const name = business.name ?? 'Agropecuaria'

  return (
    <article className={`ccp ccp--${format}`} aria-label={`Cierre de caja ${session.closingNumber ?? ''}`}>
      <header className="ccp-head">
        <div className="ccp-brand">
          {business.showLogo !== false && business.hasLogo ? (
            <img className="ccp-logo" src={BRANDING_LOGO_SRC} alt="" />
          ) : (
            <span className="ccp-monogram" aria-hidden="true">
              {initialsOf(name)}
            </span>
          )}
          <div className="ccp-brand__text">
            <strong className="ccp-business">{name}</strong>
            {(business.nit || business.taxRegime) && (
              <span className="ccp-muted">
                {business.nit ? `NIT ${business.nit}` : ''}
                {business.nit && business.taxRegime ? ' · ' : ''}
                {business.taxRegime}
              </span>
            )}
            {business.address && <span className="ccp-muted">{business.address}</span>}
            {contact && <span className="ccp-muted">{contact}</span>}
          </div>
        </div>
        <div className="ccp-doc">
          <span className="ccp-doc__label">Cierre de caja</span>
          <strong className="ccp-doc__number">{session.closingNumber ?? 'Sin contar'}</strong>
          <span className="ccp-doc__date">{session.register?.name ?? 'Caja'}</span>
        </div>
      </header>

      <div className={`ccp-status ccp-status--${status.tone}`}>{status.text}</div>

      <dl className="ccp-meta">
        <div>
          <dt>Abrió</dt>
          <dd>
            {formatDateTime(session.openedAt)}
            <small>{session.openedBy?.fullName ?? 'El sistema'}</small>
          </dd>
        </div>
        {session.cutAt && (
          <div>
            <dt>Cerró</dt>
            <dd>{formatDateTime(session.cutAt)}</dd>
          </div>
        )}
        {session.closedAt && (
          <div>
            <dt>Contó</dt>
            <dd>
              {formatDateTime(session.closedAt)}
              <small>{session.closedBy?.fullName ?? '—'}</small>
            </dd>
          </div>
        )}
        {session.receivedAt && (
          <div>
            <dt>Recibió</dt>
            <dd>
              {formatDateTime(session.receivedAt)}
              <small>{session.receivedBy?.fullName ?? '—'}</small>
            </dd>
          </div>
        )}
        {session.reopenCount > 0 && (
          <div>
            <dt>Reabierto</dt>
            <dd>
              {session.reopenCount} {session.reopenCount === 1 ? 'vez' : 'veces'}
            </dd>
          </div>
        )}
      </dl>

      <div className="ccp-kpis">
        {sales && (
          <div className="ccp-kpi">
            <span>Vendido</span>
            <strong>{formatCurrency(sales.total)}</strong>
          </div>
        )}
        <div className="ccp-kpi">
          <span>Esperado</span>
          <strong>{formatCurrency(session.expectedCash)}</strong>
        </div>
        {isCounted && (
          <div className="ccp-kpi ccp-kpi--accent">
            <span>Contado</span>
            <strong>{formatCurrency(session.countedCash)}</strong>
          </div>
        )}
      </div>

      <div className="ccp-grid">
        {sales && (
          <Box title="Ventas del turno">
            {sales.byType.map((type) => (
              <Row key={type.type} label={`${type.label} (${type.count})`} value={formatCurrency(type.total)} />
            ))}
            <Row label={`Total vendido (${sales.count} ${sales.count === 1 ? 'venta' : 'ventas'})`} value={formatCurrency(sales.total)} strong />
            {Number(sales.credit) > 0 && <Row label="Quedó fiado" value={formatCurrency(sales.credit)} />}
            {Number(sales.returned) > 0 && <Row label="Devuelto" value={formatCurrency(sales.returned)} />}
            {sales.cancelledCount > 0 && <Row label="Ventas anuladas" value={sales.cancelledCount} />}
          </Box>
        )}

        {methods.length > 0 && (
          <Box title="Por medio de pago">
            {methods.map((method) => (
              <Row key={method.paymentMethodId ?? method.name} label={`${method.name}${method.isCash ? '' : ' (no entra al cajón)'}`} value={formatCurrency(method.total)} />
            ))}
          </Box>
        )}

        {types.length > 0 && (
          <Box title="Movimientos del turno">
            {types.map((type) => (
              <Row key={type.type} label={`${Number(type.total) < 0 ? '−' : '+'} ${type.label} (${type.count})`} value={abs(type.total)} tone={Number(type.total) < 0 ? 'out' : 'in'} />
            ))}
          </Box>
        )}

        <Box title="Efectivo del cajón">
          <Row label="Base inicial" value={formatCurrency(summary.openingCash)} />
          <Row label="Entradas en efectivo" value={`+ ${formatCurrency(summary.cashIn)}`} tone="in" />
          <Row label="Salidas (retiros, gastos, devoluciones)" value={`− ${formatCurrency(summary.cashOut)}`} tone="out" />
          <Row label="Efectivo esperado" value={formatCurrency(session.expectedCash)} strong />
        </Box>

        {isCounted && (
          <Box title="Conteo de billetes y monedas" className="ccp-box--wide">
            <Breakdown items={session.countBreakdown} />
            <Row label="Efectivo contado" value={formatCurrency(session.countedCash)} strong />
            <Row label="Diferencia" value={difference === 0 ? 'Cuadrada' : `${difference < 0 ? 'Faltante' : 'Sobrante'} ${abs(difference)}`} tone={difference === 0 ? 'in' : 'alert'} />
            {session.differenceNotes && <p className="ccp-note">Qué pasó: {session.differenceNotes}</p>}
          </Box>
        )}

        {session.openingBreakdown?.some((item) => item.quantity > 0) && (
          <Box title="Base contada al abrir" className="ccp-box--wide">
            <Breakdown items={session.openingBreakdown} />
          </Box>
        )}
      </div>

      {isCounted && (
        <section className="ccp-final">
          <Row label="Se deja en la caja (base)" value={formatCurrency(session.baseLeft)} />
          <div className="ccp-final__total">
            <Row label={session.status === 'received' ? 'Entregado' : 'Se saca para entregar'} value={formatCurrency(session.cashWithdrawn)} />
          </div>
        </section>
      )}

      <section className="ccp-signatures">
        <div>
          <span className="ccp-line" />
          Entregó
        </div>
        <div>
          <span className="ccp-line" />
          Recibió
        </div>
      </section>

      <footer className="ccp-foot">
        <span className="ccp-muted">Documento interno de control de caja · Impreso el {formatDateTime(new Date().toISOString())}</span>
        {/* Firma del software (CLAUDE.md §5): discreta, no compite con la marca del negocio */}
        <div className="ccp-credit">
          <span className="ccp-credit__mark" aria-hidden="true">
            N
          </span>
          <span>
            Sistema <strong>NexSupply</strong> · Desarrollado por <strong>Nexoon</strong>
          </span>
        </div>
      </footer>
    </article>
  )
}
