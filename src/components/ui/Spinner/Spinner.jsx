import './Spinner.css'

/** Indicador de carga accesible. size: sm | md | lg */
export function Spinner({ size = 'md', label = 'Cargando…' }) {
  return (
    <span className={`spinner spinner--${size}`} role="status">
      <span className="spinner__circle" aria-hidden="true" />
      <span className="u-visually-hidden">{label}</span>
    </span>
  )
}
