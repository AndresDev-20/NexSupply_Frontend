import './FormSection.css'

/**
 * Grupo de campos con encabezado (ícono, título y descripción).
 * columns: 1 | 2 — en celular siempre una columna.
 * Un hijo con la clase "form-section__full" ocupa las dos columnas.
 */
export function FormSection({ icon: Icon, title, description, columns = 2, children }) {
  return (
    <section className="form-section">
      <header className="form-section__header">
        {Icon && (
          <span className="form-section__icon" aria-hidden="true">
            <Icon />
          </span>
        )}
        <div>
          <h3 className="form-section__title">{title}</h3>
          {description && <p className="form-section__description">{description}</p>}
        </div>
      </header>
      <div className={`form-section__fields form-section__fields--cols-${columns}`}>{children}</div>
    </section>
  )
}
