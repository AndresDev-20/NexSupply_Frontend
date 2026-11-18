import './IconButton.css'

/**
 * Botón solo con ícono (acciones de una fila). `label` es obligatorio: se usa
 * como texto accesible y como ayuda al pasar el mouse.
 * tone: neutral | danger | success
 */
export function IconButton({ icon: Icon, label, tone = 'neutral', className = '', ...rest }) {
  return (
    <button type="button" className={`icon-button icon-button--${tone} ${className}`.trim()} aria-label={label} title={label} {...rest}>
      <Icon className="icon-button__icon" aria-hidden="true" />
    </button>
  )
}
