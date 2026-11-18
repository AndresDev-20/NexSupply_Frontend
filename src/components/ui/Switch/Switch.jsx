import { useId } from 'react'
import './Switch.css'

/**
 * Interruptor de encendido/apagado para ajustes (ej. "Cobrar IVA").
 * Es un botón con role="switch": se activa con clic, Espacio o Enter.
 */
export function Switch({ label, description, checked, onChange, disabled = false }) {
  const labelId = useId()
  const descriptionId = useId()

  return (
    <div className={`switch${disabled ? ' switch--disabled' : ''}`}>
      <span className="switch__text">
        <span className="switch__label" id={labelId}>
          {label}
        </span>
        {description && (
          <span className="switch__description" id={descriptionId}>
            {description}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        className={`switch__track${checked ? ' switch__track--on' : ''}`}
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="switch__thumb" aria-hidden="true" />
      </button>
    </div>
  )
}
