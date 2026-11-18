import { LoaderCircle } from 'lucide-react'
import './Button.css'

/**
 * Botón base del sistema.
 * variant: primary | secondary | accent | ghost | danger
 * size: sm | md | lg
 * isLoading: deshabilita el botón y muestra un indicador (evita doble envío)
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  isLoading = false,
  disabled = false,
  icon: Icon,
  className = '',
  ...rest
}) {
  const classes = [
    'button',
    `button--${variant}`,
    `button--${size}`,
    isLoading ? 'button--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} disabled={disabled || isLoading} aria-busy={isLoading || undefined} {...rest}>
      {isLoading ? (
        <LoaderCircle className="button__icon button__icon--spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="button__icon" aria-hidden="true" />
      )}
      <span className="button__label">{children}</span>
    </button>
  )
}
