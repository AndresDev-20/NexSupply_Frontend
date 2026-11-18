import { useId } from 'react'
import './OptionCards.css'

/**
 * Grupo de opciones excluyentes en forma de tarjetas (radio buttons accesibles).
 * options: [{ value, label, description?, icon?, aside? }]
 * `aside`: dato extra a la derecha de la tarjeta (ej. un ejemplo de redondeo).
 */
export function OptionCards({ legend, hint, name, options, value, onChange, columns = 2, disabled = false }) {
  const hintId = useId()

  return (
    <fieldset className="option-cards" disabled={disabled} aria-describedby={hint ? hintId : undefined}>
      {legend && <legend className="option-cards__legend">{legend}</legend>}
      {hint && (
        <p className="option-cards__hint" id={hintId}>
          {hint}
        </p>
      )}
      <div className={`option-cards__grid option-cards__grid--cols-${columns}`}>
        {options.map((option) => {
          const Icon = option.icon
          const isSelected = option.value === value
          return (
            <label key={String(option.value)} className={`option-cards__card${isSelected ? ' option-cards__card--selected' : ''}`}>
              <input
                type="radio"
                className="option-cards__input"
                name={name}
                value={String(option.value)}
                checked={isSelected}
                onChange={() => onChange(option.value)}
              />
              {Icon && (
                <span className="option-cards__icon" aria-hidden="true">
                  <Icon />
                </span>
              )}
              <span className="option-cards__text">
                <span className="option-cards__label">{option.label}</span>
                {option.description && <span className="option-cards__description">{option.description}</span>}
              </span>
              {option.aside && <span className="option-cards__aside">{option.aside}</span>}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
