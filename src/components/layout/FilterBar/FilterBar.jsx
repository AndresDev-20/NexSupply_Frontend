import './FilterBar.css'

/**
 * Barra de filtros sobre una tabla: búsqueda y listas. Se apila en celular.
 * even: todos los filtros del mismo ancho (cuando no hay una búsqueda principal, ej. fechas).
 */
export function FilterBar({ children, even = false }) {
  return (
    <div className={`filter-bar${even ? ' filter-bar--even' : ''}`} role="search">
      {children}
    </div>
  )
}
