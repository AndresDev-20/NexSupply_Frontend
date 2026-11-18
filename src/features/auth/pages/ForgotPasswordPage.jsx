import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, KeyRound, Mail, Send } from 'lucide-react'
import { useForgotPasswordMutation } from '../authApi'
import { ROUTES } from '../../../routes/paths'
import { TextField } from '../../../components/ui/TextField/TextField'
import { Button } from '../../../components/ui/Button/Button'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import '../components/AuthForm/AuthForm.css'

export default function ForgotPasswordPage() {
  const [forgotPassword, { isLoading, error, data: successMessage }] = useForgotPasswordMutation()
  const [email, setEmail] = useState('')
  const { fieldErrors, formError } = splitApiError(error)

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      await forgotPassword({ email }).unwrap()
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <header className="auth-form__header">
        <span className="auth-form__icon-wrap" aria-hidden="true">
          <KeyRound className="auth-form__icon" />
        </span>
        <h1 className="auth-form__title">Recuperar contraseña</h1>
        <p className="auth-form__subtitle">
          Escribe el correo registrado en tu usuario y te enviaremos un enlace para crear una nueva contraseña.
        </p>
      </header>

      {successMessage ? (
        <Alert tone="success" title="Revisa tu correo">
          {successMessage}. El enlace vence en 30 minutos.
        </Alert>
      ) : (
        <>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <TextField
            label="Correo"
            name="email"
            type="email"
            icon={Mail}
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
            hint="Si no tienes correo registrado, pide al administrador que restablezca tu contraseña."
            required
          />
          <Button type="submit" size="lg" icon={Send} isLoading={isLoading} className="auth-form__submit">
            Enviar enlace
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
