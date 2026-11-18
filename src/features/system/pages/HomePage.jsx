import { lazy, Suspense } from 'react'
import { Clock, Database, Globe, RefreshCw, Server } from 'lucide-react'
import { useGetHealthQuery } from '../systemApi'
import { CLIENT_ERROR_CODES } from '../../../api/apiError'
import { Button } from '../../../components/ui/Button/Button'
import { StatusTile } from '../components/StatusTile/StatusTile'
import { formatDateTime } from '../../../utils/format'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { useHasFeature } from '../../../hooks/usePermissions'
import emblem from '../../../assets/brand/nexsupply-emblem.jpg'
import './HomePage.css'

/**
 * Traduce la respuesta de /health (o su error) a lo que muestra cada tarjeta.
 * - 200: API y base en línea.
 * - 503 SERVICE_UNAVAILABLE: la API responde, pero la base no.
 * - Error de red o tiempo agotado: la API no responde.
 */
function describeHealth({ data, error, isLoading }) {
  if (isLoading) return { api: 'loading', database: 'loading' }

  // El error va primero: si una verificación falla después de una exitosa,
  // RTK Query conserva los datos viejos y no deben mostrarse como "en línea".
  if (error) {
    if (error.code === 'SERVICE_UNAVAILABLE') return { api: 'ok', database: 'error' }
    const apiUnreachable = [CLIENT_ERROR_CODES.NETWORK_ERROR, CLIENT_ERROR_CODES.TIMEOUT].includes(error.code)
    return { api: apiUnreachable ? 'error' : 'ok', database: 'error' }
  }

  return { api: 'ok', database: data?.database === 'up' ? 'ok' : 'error' }
}

function describeCaption({ isFetching, error, fulfilledTimeStamp }) {
  if (isFetching) return 'Verificando la conexión con el servidor…'
  if (error) return 'No se pudo completar la verificación.'
  if (fulfilledTimeStamp) return `Última verificación: ${formatDateTime(fulfilledTimeStamp)}`
  return 'Verificando la conexión con el servidor…'
}

// El dashboard (con Recharts) se descarga solo si el plan lo incluye
const DashboardPage = lazy(() => import('../../dashboard/DashboardPage'))

/**
 * Inicio: el dashboard (Fase 14) si el plan lo incluye; si no, la bienvenida con el estado
 * del sistema (Fase 1). Ocultarlo aquí no protege nada: el backend también exige el plan.
 */
export default function HomePage() {
  const hasDashboard = useHasFeature('dashboard')
  if (hasDashboard) {
    return (
      <Suspense fallback={<Spinner label="Preparando tus cifras…" />}>
        <DashboardPage />
      </Suspense>
    )
  }
  return <SystemHome />
}

function SystemHome() {
  const { data, error, isLoading, isFetching, refetch, fulfilledTimeStamp } = useGetHealthQuery()
  const status = describeHealth({ data, error, isLoading })

  return (
    <div className="home-page">
      <section className="home-page__hero">
        <div className="home-page__hero-text">
          <p className="home-page__eyebrow">Sistema administrativo</p>
          <h2 className="home-page__title">
            Bienvenido a Nex<span className="home-page__title--accent">Supply</span>
          </h2>
          <p className="home-page__subtitle">
            Tu agropecuaria, siempre en control. Aquí aparecerán inventarios, ventas, caja e informes a medida que
            cada módulo se habilite.
          </p>
        </div>
        <img className="home-page__emblem" src={emblem} alt="" width="300" height="200" />
      </section>

      <section className="home-page__status" aria-labelledby="system-status-title">
        <div className="home-page__status-header">
          <div>
            <h2 className="home-page__status-title" id="system-status-title">
              Estado del sistema
            </h2>
            <p className="home-page__status-caption">{describeCaption({ isFetching, error, fulfilledTimeStamp })}</p>
          </div>
          <Button variant="secondary" size="sm" icon={RefreshCw} isLoading={isFetching} onClick={refetch}>
            Verificar
          </Button>
        </div>

        {error && (
          <p className="home-page__alert" role="alert">
            {error.message}
          </p>
        )}

        <div className="home-page__grid">
          <StatusTile
            icon={Server}
            label="Servidor"
            state={status.api}
            value={status.api === 'ok' ? 'En línea' : 'Sin conexión'}
          />
          <StatusTile
            icon={Database}
            label="Base de datos"
            state={status.database}
            value={status.database === 'ok' ? 'Disponible' : 'No disponible'}
          />
          <StatusTile
            icon={Clock}
            label="Hora del servidor"
            state={isLoading ? 'loading' : 'neutral'}
            value={data && !error ? formatDateTime(data.time) : '—'}
          />
          <StatusTile
            icon={Globe}
            label="Zona horaria"
            state={isLoading ? 'loading' : 'neutral'}
            value={data && !error ? data.timezone : '—'}
          />
        </div>
      </section>
    </div>
  )
}
