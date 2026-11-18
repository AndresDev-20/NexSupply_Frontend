import './PageHeader.css'

/** Encabezado de una pantalla: descripción y acciones principales (ej. "Nuevo usuario"). */
export function PageHeader({ description, actions, children }) {
  return (
    <div className="page-header">
      <div className="page-header__text">
        {description && <p className="page-header__description">{description}</p>}
        {children}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  )
}
