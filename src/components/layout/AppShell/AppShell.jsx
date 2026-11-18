import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectActiveBranchId } from '../../../features/auth/authSlice'
import { useRouteTitle } from '../../../hooks/useRouteTitle'
import { Sidebar } from '../Sidebar/Sidebar'
import { Topbar } from '../Topbar/Topbar'
import { NexoonCredit } from '../../brand/NexoonCredit/NexoonCredit'
import { PageSkeleton } from '../../ui/Skeleton/Skeleton'
import { useThemePreference } from '../../../features/settings/useThemePreference'
import { useBusinessAppearance } from '../../../features/settings/appearance'
import { useGlobalShortcuts } from '../../../hooks/useGlobalShortcuts'
import { ShortcutPending, ShortcutsHelp } from '../ShortcutsHelp/ShortcutsHelp'
import { LicenseBanner } from '../LicenseBanner/LicenseBanner'
import './AppShell.css'

const SIDEBAR_ID = 'app-sidebar'

/** Estructura de las pantallas internas: menú lateral, barra superior, contenido y pie. */
export function AppShell() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // Cambiar de pantalla la vuelve a animar (entrada suave); los filtros en la URL no
  const { pathname } = useLocation()
  // Al cambiar de sede (Fase 17) la pantalla y los avisos se montan de nuevo con los datos de esa sede
  const branchId = useSelector(selectActiveBranchId)
  // El título lo declara cada ruta en handle.title
  const title = useRouteTitle()
  // Aplica el tema claro u oscuro que eligió el usuario
  useThemePreference()
  // Y la paleta del negocio (Fase 15)
  useBusinessAppearance()
  // Atajos de teclado globales: "g" + letra y "?" para la ayuda (Fase 15)
  const shortcuts = useGlobalShortcuts()

  // Escape cierra el menú en celular (uso con teclado)
  useEffect(() => {
    if (!isMenuOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMenuOpen])

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <div className="app-shell">
      <Sidebar id={SIDEBAR_ID} isOpen={isMenuOpen} onClose={closeMenu} />

      {isMenuOpen && <div className="app-shell__overlay" onClick={closeMenu} aria-hidden="true" />}

      <div className="app-shell__main">
        <Topbar key={`topbar-${branchId}`} title={title} isMenuOpen={isMenuOpen} onMenuClick={() => setIsMenuOpen(true)} menuId={SIDEBAR_ID} onShortcutsClick={() => shortcuts.setHelpOpen(true)} />

        <main className="app-shell__content" id="main-content">
          {/* Licencia de NexCore: prueba, pago pendiente, sin conexión o solo lectura (N2) */}
          <LicenseBanner />
          <div className="app-shell__page" key={`${branchId}:${pathname}`}>
            <Suspense fallback={<PageSkeleton label="Cargando la pantalla…" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        <ShortcutsHelp isOpen={shortcuts.helpOpen} onClose={() => shortcuts.setHelpOpen(false)} />
        <ShortcutPending visible={shortcuts.pending} />

        <footer className="app-shell__footer">
          <NexoonCredit />
        </footer>
      </div>
    </div>
  )
}
