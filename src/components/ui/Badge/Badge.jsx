import './Badge.css'

/** Etiqueta corta de estado. tone: neutral | success | warning | danger | info | accent */
export function Badge({ tone = 'neutral', children, icon: Icon }) {
  return (
    <span className={`badge badge--${tone}`}>
      {Icon && <Icon className="badge__icon" aria-hidden="true" />}
      {children}
    </span>
  )
}
