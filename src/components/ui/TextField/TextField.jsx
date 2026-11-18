import { forwardRef, useId } from 'react'
import './TextField.css'

/**
 * Campo de texto con etiqueta, ayuda y error accesibles.
 * El error se anuncia a los lectores de pantalla (aria-describedby + aria-invalid).
 * `endAdornment` permite poner un botón dentro del campo (ej. mostrar contraseña).
 */
export const TextField = forwardRef(function TextField(
  { label, hint, error, icon: Icon, endAdornment, id, className = '', 'aria-describedby': extraDescribedBy, ...inputProps },
  ref,
) {
  const generatedId = useId()
  const inputId = id || generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  // Se combinan: el error y la ayuda propios más una descripción externa (ej. requisitos de contraseña)
  const describedBy = [errorId, hintId, extraDescribedBy].filter(Boolean).join(' ') || undefined

  return (
    <div className={`text-field${error ? ' text-field--invalid' : ''} ${className}`.trim()}>
      {/* El asterisco de "obligatorio" lo pone el CSS: no altera el nombre accesible */}
      <label className={`text-field__label${inputProps.required ? ' text-field__label--required' : ''}`} htmlFor={inputId}>
        {label}
      </label>
      <div className="text-field__control">
        {Icon && <Icon className="text-field__icon" aria-hidden="true" />}
        <input
          ref={ref}
          id={inputId}
          className={`text-field__input${Icon ? ' text-field__input--with-icon' : ''}${endAdornment ? ' text-field__input--with-end' : ''}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
        {endAdornment && <div className="text-field__end">{endAdornment}</div>}
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
