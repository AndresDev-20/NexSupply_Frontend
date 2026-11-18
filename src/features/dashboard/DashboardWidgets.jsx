// Tarjetas y paneles del dashboard (Fase 14).
import { Link } from 'react-router-dom'
import { ArrowRight, CircleAlert, CircleCheck, Clock, Info, Minus, Store, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import { Badge } from '../../components/ui/Badge/Badge'
import { formatCurrency, formatPercent, formatQuantity } from '../../utils/format'
import { cashSessionPath } from '../../routes/paths'
import { timeText, trendOf } from './dashboardOptions'

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus }

/**
 * Cifra con su variación contra el periodo anterior (D-DASH-2).
 * inverse: cuando subir es malo (gastos, costo), la flecha hacia arriba va en rojo.
 */
export function KpiCard({ label, icon: Icon, value, metric, versus, inverse = false, neutral = false, detail, highlight = false, tone }) {
  const trend = trendOf(metric?.change)
  const good = trend === 'flat' || neutral ? null : (trend === 'up') !== inverse
  const TrendIcon = trend ? TREND_ICON[trend] : null
  return (
    <article className={`dash-kpi${highlight ? ' dash-kpi--highlight' : ''}${tone ? ` dash-kpi--${tone}` : ''}`}>
      <header className="dash-kpi__head">
        {Icon && (
          <span className="dash-kpi__icon" aria-hidden="true">
            <Icon />
          </span>
        )}
        <span className="dash-kpi__label">{label}</span>
      </header>
      <strong className="dash-kpi__value">{value}</strong>
      {detail && <span className="dash-kpi__detail">{detail}</span>}
      {metric && (
        <span className={`dash-kpi__trend${trend ? ` dash-kpi__trend--${good === null ? 'flat' : good ? 'good' : 'bad'}` : ''}`}>
          {TrendIcon ? (
            <>
              <TrendIcon aria-hidden="true" />
              <span>
                {trend === 'up' ? '+' : ''}
                {formatPercent(metric.change)} vs. {versus}
              </span>
            </>
          ) : (
            <span>Sin datos de {versus}</span>
          )}
        </span>
      )}
    </article>
  )
}

const SEVERITY = {
  danger: { icon: CircleAlert, tone: 'danger' },
  warning: { icon: TriangleAlert, tone: 'warning' },
  info: { icon: Info, tone: 'info' },
}

/** "Requiere atención" (D-DASH-7): solo los avisos con algo pendiente; cada uno lleva a su pantalla. */
export function AttentionPanel({ alerts }) {
  const pending = alerts.filter((alert) => alert.count > 0)
  return (
    <section className="dash-panel dash-attention" aria-labelledby="dash-attention-title">
      <header className="dash-panel__head">
        <h2 id="dash-attention-title">Requiere atención</h2>
        {pending.length > 0 && <span className="dash-attention__count">{pending.reduce((sum, alert) => sum + alert.count, 0)}</span>}
      </header>
      {pending.length === 0 ? (
        <p className="dash-attention__ok">
          <CircleCheck aria-hidden="true" /> Todo en orden. No hay nada pendiente.
        </p>
      ) : (
        <ul className="dash-attention__list">
          {pending.map((alert) => {
            const style = SEVERITY[alert.severity] ?? SEVERITY.info
            return (
              <li key={alert.key}>
                <Link to={alert.link} className={`dash-alert dash-alert--${style.tone}`}>
                  <style.icon className="dash-alert__icon" aria-hidden="true" />
                  <span className="dash-alert__label">{alert.label}</span>
                  <span className="dash-alert__count">{alert.count}</span>
                  <ArrowRight className="dash-alert__arrow" aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Los 5 más vendidos del periodo con una barra relativa al primero. */
export function TopProducts({ products }) {
  const max = Math.max(...products.map((row) => Number(row.total)), 1)
  return (
    <section className="dash-panel" aria-labelledby="dash-top-title">
      <header className="dash-panel__head">
        <h2 id="dash-top-title">Más vendidos</h2>
      </header>
      {products.length === 0 ? (
        <p className="dash-empty">Sin ventas en este periodo.</p>
      ) : (
        <ol className="dash-top">
          {products.map((row, index) => (
            <li key={row.code}>
              <span className="dash-top__rank">{index + 1}</span>
              <span className="dash-top__text">
                <strong>{row.name}</strong>
                <small>
                  {formatQuantity(row.quantity)} {row.unit} · {row.category}
                </small>
                <span className="dash-top__bar" style={{ '--share': `${(Number(row.total) / max) * 100}%` }} aria-hidden="true" />
              </span>
              <span className="dash-top__total">{formatCurrency(row.total)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** Turnos abiertos o por contar con su efectivo esperado. */
export function CashPanel({ cash }) {
  return (
    <section className="dash-panel" aria-labelledby="dash-cash-title">
      <header className="dash-panel__head">
        <h2 id="dash-cash-title">{cash.scope === 'mine' ? 'Mi caja' : 'Cajas'}</h2>
        {cash.sessions.length > 1 && <span className="dash-panel__aside">{formatCurrency(cash.expectedCash)} en total</span>}
      </header>
      {cash.sessions.length === 0 ? (
        <p className="dash-empty">{cash.scope === 'mine' ? 'No tienes un turno abierto.' : 'No hay cajas abiertas.'}</p>
      ) : (
        <ul className="dash-cash">
          {cash.sessions.map((session) => (
            <li key={session.id}>
              <Link to={cashSessionPath(session.id)} className="dash-cash__item">
                <span className="dash-cash__text">
                  <strong>
                    {session.register}
                    {session.branch ? ` · ${session.branch}` : ''}
                  </strong>
                  <small>
                    <Clock aria-hidden="true" /> Desde {timeText(session.openedAt)}
                    {session.openedBy ? ` · ${session.openedBy}` : ''}
                  </small>
                </span>
                <span className="dash-cash__amount">
                  <small>Efectivo esperado</small>
                  <strong>{formatCurrency(session.expectedCash)}</strong>
                </span>
                {session.isOverdue && <Badge tone="danger">Pasó la hora de cierre</Badge>}
                {session.status === 'pending_count' && <Badge tone="warning">Por contar</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Sucursal contra sucursal (Fase 19, D-INT-5): lo vendido por cada una, qué parte del total es,
 * cómo va contra el periodo anterior y, con permiso de costos, su ganancia neta.
 */
export function BranchesPanel({ branches, versus }) {
  const total = branches.reduce((sum, branch) => sum + Number(branch.sales.value), 0)
  const sorted = [...branches].sort((a, b) => Number(b.sales.value) - Number(a.sales.value))
  return (
    <section className="dash-panel dash-panel--wide" aria-labelledby="dash-branches-title">
      <header className="dash-panel__head">
        <h2 id="dash-branches-title">Comparación por sucursal</h2>
        <span className="dash-panel__aside">{formatCurrency(total)} entre todas</span>
      </header>
      <ul className="dash-branches">
        {sorted.map((branch) => {
          // Solo para dibujar la barra: el dinero oficial lo calcula el servidor
          const share = total > 0 ? (Number(branch.sales.value) / total) * 100 : 0
          const trend = trendOf(branch.sales.change)
          const TrendIcon = trend ? TREND_ICON[trend] : null
          return (
            <li key={branch.id} className="dash-branch">
              <span className="dash-branch__name">
                <Store aria-hidden="true" />
                <strong>{branch.name}</strong>
                <small>
                  {branch.count} {branch.count === 1 ? 'venta' : 'ventas'}
                </small>
              </span>
              <span className="dash-branch__bar" aria-hidden="true">
                <span style={{ width: `${share.toFixed(1)}%` }} />
              </span>
              <span className="dash-branch__figures">
                <strong>{formatCurrency(branch.sales.value)}</strong>
                <small className={trend ? `dash-branch__trend dash-branch__trend--${trend}` : 'dash-branch__trend'}>
                  {TrendIcon && <TrendIcon aria-hidden="true" />}
                  {TrendIcon ? `${trend === 'up' ? '+' : ''}${formatPercent(branch.sales.change)} vs. ${versus}` : `Sin datos de ${versus}`}
                </small>
                {branch.netProfit !== undefined && <small>Ganancia neta {formatCurrency(branch.netProfit)}</small>}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Plata por cobrar y por pagar, con lo vencido. */
export function BalancesPanel({ receivables, payables }) {
  return (
    <section className="dash-panel" aria-labelledby="dash-balances-title">
      <header className="dash-panel__head">
        <h2 id="dash-balances-title">Por cobrar y por pagar</h2>
      </header>
      <div className="dash-balances">
        {receivables && (
          <Link to="/cartera" className="dash-balance dash-balance--in">
            <span className="dash-balance__label">Me deben</span>
            <strong className="dash-balance__value">{formatCurrency(receivables.balance)}</strong>
            <small>
              {receivables.customers} {receivables.customers === 1 ? 'cliente' : 'clientes'}
              {receivables.customersOverdue > 0 ? ` · ${formatCurrency(receivables.overdue)} vencido` : ' · nada vencido'}
            </small>
          </Link>
        )}
        {payables && (
          <Link to="/compras/cuentas-por-pagar" className="dash-balance dash-balance--out">
            <span className="dash-balance__label">Debo a proveedores</span>
            <strong className="dash-balance__value">{formatCurrency(payables.balance)}</strong>
            <small>
              {payables.count} {payables.count === 1 ? 'compra' : 'compras'}
              {payables.overdueCount > 0 ? ` · ${formatCurrency(payables.overdue)} vencido` : ' · nada vencido'}
            </small>
          </Link>
        )}
      </div>
    </section>
  )
}
