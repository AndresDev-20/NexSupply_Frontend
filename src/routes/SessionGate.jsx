import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Outlet } from 'react-router-dom'
import { restoreSession, selectAuth } from '../features/auth/authSlice'
import { LoadingScreen } from '../components/feedback/LoadingScreen/LoadingScreen'
import { WelcomeOverlay } from '../components/feedback/WelcomeOverlay/WelcomeOverlay'

/**
 * Raíz de todas las rutas: al abrir la aplicación consulta si ya hay sesión
 * y muestra la pantalla de carga mientras tanto. Así ninguna página se dibuja
 * antes de saber quién es el usuario.
 */
export function SessionGate() {
  const dispatch = useDispatch()
  const { status } = useSelector(selectAuth)

  useEffect(() => {
    if (status === 'checking') dispatch(restoreSession())
    // Solo al montar: después, la sesión cambia por login, logout o expiración
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch])

  if (status === 'checking') return <LoadingScreen message="Verificando tu sesión…" />
  return (
    <>
      <Outlet />
      <WelcomeOverlay />
    </>
  )
}
