import './StatusMessage.css'

/**
 * Mensaje centrado para estados vacíos, errores y páginas no encontradas.
 * tone: neutral | danger
 */
export function StatusMessage({ icon: Icon, title, description, tone = 'neutral', children }) {
  return (
    <section className={`status-message status-message--${tone}`}>
      {Icon && (
        <span className="status-message__icon-wrap" aria-hidden="true">
          <Icon className="status-message__icon" />
        </span>
      )}
      <h2 className="status-message__title">{title}</h2>
      {description && <p className="status-message__description">{description}</p>}
      {children && <div className="status-message__actions">{children}</div>}
    </section>
  )
}
