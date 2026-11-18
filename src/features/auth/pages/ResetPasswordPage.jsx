import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CircleCheck, KeyRound, LogIn } from 'lucide-react'
import { useResetPasswordMutation } from '../authApi'
import { passwordMeetsRules } from '../passwordRules'
import { ROUTES } from '../../../routes/paths'
import { PasswordField } from '../../../components/ui/PasswordField/PasswordField'
import { Button } from '../../../components/ui/Button/Button'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { PasswordRequirements } from '../components/PasswordRequirements/PasswordRequirements'
import { splitApiError } from '../../../utils/formErrors'
import '../components/AuthForm/AuthForm.css'

/** Lee el token del fragmento del enlace: /restablecer-contrasena#token=… (decisión D-AUTH-7). */
function readTokenFromHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return params.get('token') || ''
}

export default function ResetPasswordPage() {
  // Se lee una sola vez al abrir la página
  const [token] = useState(readTokenFromHash)
  const [resetPassword, { isLoading, error, data: successMessage }] = useResetPasswordMutation()
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [confirmError, setConfirmError] = useState(null)

  // Borra el token de la barra de direcciones: no queda en el historial ni a la vista
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
  }, [])

  const { fieldErrors, formError } = splitApiError(error)
  const invalidLink = !token || error?.code === 'INVALID_RESET_TOKEN' || Boolean(fieldErrors.token)

  const handleChange = (event) => {
    setConfirmError(null)
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (form.newPassword !== form.confirmPassword) {
      setConfirmError('Las contraseñas no coinciden')
      return
    }
    try {
      await resetPassword({ token, newPassword: form.newPassword }).unwrap()
    } catch {
      // Se muestra desde `error`
    }
  }

  if (successMessage) {
    return (
      <div className="auth-form">
        <header className="auth-form__header">
          <span className="auth-form__icon-wrap" aria-hidden="true">
            <CircleCheck className="auth-form__icon" />
          </span>
          <h1 className="auth-form__title">Contraseña restablecida</h1>
          <p className="auth-form__subtitle">{successMessage}.</p>
        </header>
        <Link className="button button--primary button--lg auth-form__submit" to={ROUTES.login}>
          <LogIn className="button__icon" aria-hidden="true" />
          <span className="button__label">Iniciar sesión</span>
        </Link>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <header className="auth-form__header">
        <span className="auth-form__icon-wrap" aria-hidden="true">
          <KeyRound className="auth-form__icon" />
        </span>
        <h1 className="auth-form__title">Crear nueva contraseña</h1>
        <p className="auth-form__subtitle">Al guardarla se cerrarán tus sesiones abiertas en todos los dispositivos.</p>
      </header>

      {invalidLink ? (
        <Alert tone="danger" title="El enlace no es válido">
          {error?.code === 'INVALID_RESET_TOKEN'
            ? error.message
            : 'El enlace está incompleto o ya expiró. Solicita uno nuevo.'}{' '}
          <Link className="auth-form__link" to={ROUTES.forgotPassword}>
            Solicitar un enlace nuevo
          </Link>
        </Alert>
      ) : (
        <>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <div className="auth-form__fields">
            <PasswordField
              label="Nueva contraseña"
              name="newPassword"
              autoComplete="new-password"
              autoFocus
              value={form.newPassword}
              onChange={handleChange}
              error={fieldErrors.newPassword}
              aria-describedby="reset-password-rules"
              required
            />
            <PasswordRequirements value={form.newPassword} id="reset-password-rules" />
            <PasswordField
              label="Confirmar contraseña"
              name="confirmPassword"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
              error={confirmError}
              required
            />
          </div>
          <Button
            type="submit"
            size="lg"
            isLoading={isLoading}
            disabled={!passwordMeetsRules(form.newPassword) || !form.confirmPassword}
            className="auth-form__submit"
          >
            Guardar contraseña
          </Button>
        </>
      )}

      <p className="auth-form__footer">
        <Link className="auth-form__link auth-form__link--with-icon" to={ROUTES.login}>
          <ArrowLeft className="auth-form__link-icon" aria-hidden="true" />
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  )
}
