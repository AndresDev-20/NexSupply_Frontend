import './StatusTile.css'

/**
 * Tarjeta de un indicador de estado.
 * state: ok | error | neutral | loading
 */
export function StatusTile({ icon: Icon, label, value, state = 'neutral' }) {
  return (
    <article className={`status-tile status-tile--${state}`} aria-busy={state === 'loading' || undefined}>
      <span className="status-tile__icon-wrap" aria-hidden="true">
        <Icon className="status-tile__icon" />
      </span>
      <div className="status-tile__body">
        <h3 className="status-tile__label">{label}</h3>
        <p className="status-tile__value">
          {state === 'loading' ? <span className="status-tile__skeleton">Consultando…</span> : value}
        </p>
      </div>
    </article>
  )
}
