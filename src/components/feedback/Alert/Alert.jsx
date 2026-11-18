import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import './Alert.css'

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert }

/**
 * Mensaje destacado. tone: info | success | warning | danger
 * Los de tono danger usan role="alert" para que el lector de pantalla los anuncie de inmediato.
 */
export function Alert({ tone = 'info', title, children }) {
  const Icon = ICONS[tone]
  return (
    <div className={`alert alert--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon className="alert__icon" aria-hidden="true" />
      <div className="alert__body">
        {title && <p className="alert__title">{title}</p>}
        {children && <div className="alert__text">{children}</div>}
      </div>
    </div>
  )
}
