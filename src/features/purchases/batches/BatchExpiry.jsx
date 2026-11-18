import { formatDay } from '../purchaseOptions'
import '../purchases.css'

const TONE = { expired: 'danger', expiring: 'warning', ok: 'success' }

/** Fecha de vencimiento de un lote con cuántos días faltan (o hace cuánto venció). */
export function BatchExpiry({ batch }) {
  const days = batch.daysToExpire
  const label = days < 0 ? `Venció hace ${-days} ${days === -1 ? 'día' : 'días'}` : days === 0 ? 'Vence hoy' : `En ${days} ${days === 1 ? 'día' : 'días'}`
  return (
    <span className="batch-expiry">
      <span>{formatDay(batch.expirationDate)}</span>
      <span className={`status-pill status-pill--${TONE[batch.expiryStatus] ?? 'neutral'}`}>
        <span className="status-pill__dot" aria-hidden="true" />
        {label}
      </span>
    </span>
  )
}
