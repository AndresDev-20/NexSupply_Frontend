import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useChangePasswordMutation } from '../authApi'
import { logoutUser, selectCurrentUser } from '../authSlice'
import { passwordMeetsRules } from '../passwordRules'
import { ROUTES } from '../../../routes/paths'
import { PasswordField } from '../../../components/ui/PasswordField/PasswordField'
import { Button } from '../../../components/ui/Button/Button'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { PasswordRequirements } from '../components/PasswordRequirements/PasswordRequirements'
import { splitApiError } from '../../../utils/formErrors'
import '../components/AuthForm/AuthForm.css'

/**
 * Cambio de contraseña. Dos modos:
 * - Obligatorio (mustChangePassword): primer ingreso o contraseña asignada por un administrador.
 *   No hay forma de saltarlo; solo cambiarla o cerrar sesión.
 * - Voluntario: el usuario lo pide desde su menú.
 */
export default function ChangePasswordPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector(selectCurrentUser)
  const [isForced] = useState(() => Boolean(user?.mustChangePassword))
  const [changePassword, { isLoading, error, data: result }] = useChangePasswordMutation()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [confirmError, setConfirmError] = useState(null)

  const { fieldErrors, formError } = splitApiError(error)

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
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }).unwrap()
    } catch {
      // Se muestra desde `error`
    }
  }

  if (result) {
    return (
      <div className="auth-form">
        <header className="auth-form__header">
          <span className="auth-form__icon-wrap" aria-hidden="true">
            <ShieldCheck className="auth-form__icon" />
          </span>
          <h1 className="auth-form__title">Contraseña actualizada</h1>
          <p className="auth-form__subtitle">{result.message}.</p>
        </header>
        <Button size="lg" className="auth-form__submit" onClick={() => navigate(ROUTES.home, { replace: true })}>
          Ir al inicio
        </Button>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <header className="auth-form__header">
        <span className="auth-form__icon-wrap" aria-hidden="true">
          <ShieldCheck className="auth-form__icon" />
        </span>
        <h1 className="auth-form__title">{isForced ? 'Crea tu contraseña' : 'Cambiar contraseña'}</h1>
        <p className="auth-form__subtitle">
          {isForced
            ? `Hola, ${user.fullName}. Por seguridad, cambia la contraseña que te asignaron antes de continuar.`
            : 'Al cambiarla se cerrarán tus sesiones en los demás dispositivos.'}
        </p>
      </header>

      {formError && <Alert tone="danger">{formError}</Alert>}

      <div className="auth-form__fields">
        <PasswordField
          label={isForced ? 'Contraseña asignada' : 'Contraseña actual'}
          name="currentPassword"
          autoComplete="current-password"
          autoFocus
          value={form.currentPassword}
          onChange={handleChange}
          error={fieldErrors.currentPassword}
          required
        />
        <PasswordField
          label="Nueva contraseña"
          name="newPassword"
          autoComplete="new-password"
          value={form.newPassword}
          onChange={handleChange}
          error={fieldErrors.newPassword}
          aria-describedby="change-password-rules"
          required
        />
        <PasswordRequirements value={form.newPassword} id="change-password-rules" />
        <PasswordField
          label="Confirmar nueva contraseña"
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
        disabled={!form.currentPassword || !passwordMeetsRules(form.newPassword) || !form.confirmPassword}
        className="auth-form__submit"
      >
        Guardar contraseña
      </Button>

      <p className="auth-form__footer">
        {isForced ? (
          <button type="button" className="auth-form__link-button" onClick={() => dispatch(logoutUser())}>
            Cerrar sesión
          </button>
        ) : (
          <Link className="auth-form__link auth-form__link--with-icon" to={ROUTES.home}>
            <ArrowLeft className="auth-form__link-icon" aria-hidden="true" />
            Volver al inicio
          </Link>
        )}
      </p>
    </form>
  )
}
