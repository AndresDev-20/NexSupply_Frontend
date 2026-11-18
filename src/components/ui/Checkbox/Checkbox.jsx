import { useEffect, useId, useRef } from 'react'
import { Check, Minus } from 'lucide-react'
import './Checkbox.css'

/**
 * Casilla de verificación con estilo propio (el input nativo sigue ahí para
 * teclado y lectores de pantalla). `indeterminate`: algunos marcados en un grupo.
 */
export function Checkbox({ label, description, checked, indeterminate = false, onChange, disabled = false, id }) {
  const generatedId = useId()
  const inputId = id || generatedId
  const inputRef = useRef(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <label className={`checkbox${disabled ? ' checkbox--disabled' : ''}`} htmlFor={inputId}>
      <input
        ref={inputRef}
        id={inputId}
        type="checkbox"
        className="checkbox__input"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span className="checkbox__box" aria-hidden="true">
        {indeterminate ? <Minus className="checkbox__icon" /> : <Check className="checkbox__icon" />}
      </span>
      <span className="checkbox__text">
        <span className="checkbox__label">{label}</span>
        {description && <span className="checkbox__description">{description}</span>}
      </span>
    </label>
  )
}
