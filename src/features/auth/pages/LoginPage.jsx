import { useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { LogIn, User } from 'lucide-react'
import { useLoginMutation } from '../authApi'
import { noticeCleared, selectAuth } from '../authSlice'
import { ROUTES } from '../../../routes/paths'
import { TextField } from '../../../components/ui/TextField/TextField'
import { PasswordField } from '../../../components/ui/PasswordField/PasswordField'
import { Button } from '../../../components/ui/Button/Button'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import '../components/AuthForm/AuthForm.css'

const NOTICES = {
  expired: { tone: 'warning', text: 'Tu sesión expiró. Inicia sesión de nuevo para continuar.' },
  inactive: { tone: 'danger', text: 'Tu usuario fue desactivado. Contacta al administrador.' },
  logged_out: { tone: 'success', text: 'Cerraste sesión correctamente.' },
}

export default function LoginPage() {
  const dispatch = useDispatch()
  const { notice } = useSelector(selectAuth)
  const [login, { isLoading, error }] = useLoginMutation()
  const [form, setForm] = useState({ identifier: '', password: '' })
  // Activa la animación de "sacudida" del formulario cuando el ingreso falla
  const [isShaking, setIsShaking] = useState(false)
  const passwordRef = useRef(null)

  const { fieldErrors, formError } = splitApiError(error)
  const noticeInfo = !error && NOTICES[notice]

  const handleChange = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (notice) dispatch(noticeCleared())
    try {
      // Si inicia sesión, la ruta PublicOnly lo lleva a donde quería ir
      // y la bienvenida animada (WelcomeOverlay) se muestra encima
      await login(form).unwrap()
    } catch (loginError) {
      // El mensaje se muestra desde `error` del hook. Aquí solo la respuesta visual:
      setIsShaking(true)
      if (loginError?.code === 'INVALID_CREDENTIALS') {
        // Se borra la contraseña y se deja el cursor listo para escribirla de nuevo
        setForm((current) => ({ ...current, password: '' }))
        passwordRef.current?.focus()
      }
    }
  }

  return (
    <form
      className={`auth-form${isShaking ? ' auth-form--shake' : ''}`}
      onSubmit={handleSubmit}
      onAnimationEnd={(event) => {
        if (event.animationName === 'auth-form-shake') setIsShaking(false)
      }}
      noValidate
    >
      <header className="auth-form__header">
        <h1 className="auth-form__title">Iniciar sesión</h1>
        <p className="auth-form__subtitle">Ingresa con tu usuario o tu correo.</p>
      </header>

      {noticeInfo && <Alert tone={noticeInfo.tone}>{noticeInfo.text}</Alert>}
      {formError && <Alert tone="danger">{formError}</Alert>}

      <div className="auth-form__fields">
        <TextField
          label="Usuario o correo"
          name="identifier"
          icon={User}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          value={form.identifier}
          onChange={handleChange}
          error={fieldErrors.identifier}
          required
        />
        <PasswordField
          ref={passwordRef}
          name="password"
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
          error={fieldErrors.password}
          required
        />
      </div>

      <div className="auth-form__row">
        <Link className="auth-form__link" to={ROUTES.forgotPassword}>
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      <Button type="submit" size="lg" icon={LogIn} isLoading={isLoading} className="auth-form__submit">
        Ingresar
      </Button>
    </form>
  )
}
