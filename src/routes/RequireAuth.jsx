import { useSelector } from 'react-redux'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectAuth } from '../features/auth/authSlice'
import { ROUTES } from './paths'

/**
 * Protege las rutas internas en el frontend. Es solo comodidad para el usuario:
 * la protección real está en el backend (authenticate), que rechaza cualquier
 * petición sin sesión aunque alguien escriba la URL a mano.
 *
 * - Sin sesión: lleva al inicio de sesión y recuerda a dónde quería ir.
 * - Con cambio de contraseña pendiente: lleva a la pantalla de cambio.
 */
export function RequireAuth({ allowPendingPasswordChange = false }) {
  const { status, user } = useSelector(selectAuth)
  const location = useLocation()

  if (status !== 'authenticated') {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />
  }

  if (user.mustChangePassword && !allowPendingPasswordChange) {
    return <Navigate to={ROUTES.changePassword} replace />
  }

  return <Outlet />
}

/** Pantallas solo para quien NO tiene sesión (iniciar sesión). */
export function PublicOnly() {
  const { status } = useSelector(selectAuth)
  const location = useLocation()

  if (status === 'authenticated') {
    const destination = location.state?.from?.pathname || ROUTES.home
    return <Navigate to={destination} replace />
  }
  return <Outlet />
}
