import { forwardRef, useId } from 'react'
import '../TextField/TextField.css'
import './TextAreaField.css'

/** Texto largo con el mismo aspecto que TextField. Muestra el contador si hay `maxLength`. */
export const TextAreaField = forwardRef(function TextAreaField(
  { label, hint, error, id, className = '', rows = 3, value = '', maxLength, ...textareaProps },
  ref,
) {
  const generatedId = useId()
  const fieldId = id || generatedId
  const hintId = hint ? `${fieldId}-hint` : undefined
  const errorId = error ? `${fieldId}-error` : undefined

  return (
    <div className={`text-field textarea-field${error ? ' text-field--invalid' : ''} ${className}`.trim()}>
      <label className={`text-field__label${textareaProps.required ? ' text-field__label--required' : ''}`} htmlFor={fieldId}>
        {label}
      </label>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className="text-field__input textarea-field__input"
        value={value}
        maxLength={maxLength}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
        {...textareaProps}
      />
      <div className="textarea-field__footer">
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
        {maxLength && (
          <span className="textarea-field__counter" aria-hidden="true">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  )
})
