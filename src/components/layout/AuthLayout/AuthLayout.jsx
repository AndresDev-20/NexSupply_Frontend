import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { NexoonCredit } from '../../brand/NexoonCredit/NexoonCredit'
import { FarmScene } from '../../brand/FarmScene/FarmScene'
import { Spinner } from '../../ui/Spinner/Spinner'
import { useRouteTitle } from '../../../hooks/useRouteTitle'
import { BusinessBrand } from '../../../features/settings/BusinessBrand'
import { useBusinessAppearance } from '../../../features/settings/appearance'
import { SeasonalGarland, SeasonMessage } from '../../brand/Seasonal/SeasonalDecoration'
import emblem from '../../../assets/brand/nexsupply-emblem.jpg'
import './AuthLayout.css'

/**
 * Estructura de las pantallas de acceso (iniciar sesión, recuperar y cambiar contraseña).
 * Celular: marca arriba y formulario debajo. Laptop: panel de marca a la izquierda.
 */
export function AuthLayout() {
  useRouteTitle()
  // Paleta del negocio y adornos de temporada (Fase 15): /branding es pública
  const { season } = useBusinessAppearance()

  return (
    <div className="auth-layout">
      <aside className="auth-layout__brand">
        <SeasonalGarland season={season} />
        <div className="auth-layout__scene">
          <FarmScene />
        </div>
        <div className="auth-layout__brand-inner">
          <div className="auth-layout__emblem-wrap">
            <img className="auth-layout__emblem" src={emblem} alt="" width="300" height="200" />
          </div>
          <p className="auth-layout__name">
            Nex<span className="auth-layout__name--accent">Supply</span>
          </p>
          <p className="auth-layout__tagline">Tu agropecuaria, siempre en control.</p>
          <SeasonMessage season={season} className="auth-layout__season" />
        </div>
      </aside>

      <main className="auth-layout__main">
        <div className="auth-layout__card">
          {/* Logo y nombre del negocio del cliente, configurados en la Fase 4 */}
          <BusinessBrand />
          <Suspense
            fallback={
              <div className="auth-layout__loading">
                <Spinner size="lg" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
        <footer className="auth-layout__footer">
          <NexoonCredit />
        </footer>
      </main>
    </div>
  )
}
