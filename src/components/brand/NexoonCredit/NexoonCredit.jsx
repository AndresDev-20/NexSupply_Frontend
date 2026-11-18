import './NexoonCredit.css'

/**
 * Firma discreta del desarrollador. Obligatoria en login, pie de página
 * y pantallas de carga (CLAUDE.md §5). tone: default | inverse (sobre fondo oscuro)
 */
export function NexoonCredit({ tone = 'default' }) {
  return (
    <p className={`nexoon-credit nexoon-credit--${tone}`}>
      Desarrollado por <span className="nexoon-credit__brand">Nexoon</span>
    </p>
  )
}
