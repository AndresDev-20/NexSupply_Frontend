import { forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import '../TextField/TextField.css'
import './SelectField.css'

/**
 * Lista desplegable con el mismo aspecto que TextField.
 * options: [{ value, label }]. `placeholder` agrega una opción vacía inicial.
 */
export const SelectField = forwardRef(function SelectField(
  { label, options, placeholder, error, hint, id, className = '', ...selectProps },
  ref,
) {
  const generatedId = useId()
  const selectId = id || generatedId
  const errorId = error ? `${selectId}-error` : undefined
  const hintId = hint ? `${selectId}-hint` : undefined

  return (
    <div className={`text-field select-field${error ? ' text-field--invalid' : ''} ${className}`.trim()}>
      {label && (
        <label className={`text-field__label${selectProps.required ? ' text-field__label--required' : ''}`} htmlFor={selectId}>
          {label}
        </label>
      )}
      <div className="text-field__control">
        <select
          ref={ref}
          id={selectId}
          className="text-field__input select-field__select"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          {...selectProps}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="select-field__chevron" aria-hidden="true" />
      </div>
      {error && (
        <p className="text-field__error" id={errorId}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-field__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  )
})
