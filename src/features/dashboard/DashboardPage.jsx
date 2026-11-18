import { useState } from 'react'
import { useSelector } from 'react-redux'
import { BadgeDollarSign, CreditCard, Landmark, PiggyBank, Receipt, RefreshCw, ShoppingBasket, TrendingUp } from 'lucide-react'
import { useGetDashboardQuery } from './dashboardApi'
import { useGetHealthQuery } from '../system/systemApi'
import { selectCurrentUser } from '../auth/authSlice'
import { useSeason } from '../settings/appearance'
import { SeasonalGarland, SeasonMessage } from '../../components/brand/Seasonal/SeasonalDecoration'
import { CategoryDonut, ProfitChart, SalesChart } from './DashboardCharts'
import { AttentionPanel, BalancesPanel, BranchesPanel, CashPanel, KpiCard, TopProducts } from './DashboardWidgets'
import { BranchScopeToggle } from '../../components/layout/BranchScopeToggle/BranchScopeToggle'
import { branchParams } from '../../components/layout/BranchScopeToggle/branchScope'
import { PERIODS, REFRESH_MS, greeting, periodInfo, timeText, todayText } from './dashboardOptions'
import { Alert } from '../../components/feedback/Alert/Alert'
import { Button } from '../../components/ui/Button/Button'
import { CardsSkeleton, Skeleton } from '../../components/ui/Skeleton/Skeleton'
import { formatCurrency, formatPercent } from '../../utils/format'
import './dashboard.css'

/** Punto verde o rojo con el estado del servidor (antes eran las tarjetas grandes de Inicio). */
function ServerStatus() {
  const { data, error, isLoading } = useGetHealthQuery()
  const online = !isLoading && !error && data?.database === 'up'
  const label = isLoading ? 'Verificando servidor…' : online ? 'Servidor en línea' : error?.code === 'SERVICE_UNAVAILABLE' ? 'Base de datos no disponible' : 'Sin conexión con el servidor'
  return (
    <span className={`dash-status${isLoading ? '' : online ? ' dash-status--ok' : ' dash-status--error'}`} role="status">
      <span className="dash-status__dot" aria-hidden="true" />
      {label}
    </span>
  )
}

/**
 * Dashboard (Fase 14, D-DASH-1 a D-DASH-7). Cada bloque llega solo si la persona tiene el
 * permiso (el servidor ni siquiera lo calcula); aquí solo se dibuja lo que llegó.
 */
export default function DashboardPage() {
  const user = useSelector(selectCurrentUser)
  const [period, setPeriod] = useState('today')
  // Sucursal activa o «Todas» (Fase 19)
  const [scope, setScope] = useState('active')
  const { data, error, isFetching, refetch, fulfilledTimeStamp } = useGetDashboardQuery({ period, ...branchParams(scope) }, { pollingInterval: REFRESH_MS, refetchOnFocus: true, skipPollingIfUnfocused: true })
  const info = periodInfo(period)
  const firstName = (user?.fullName ?? '').split(' ')[0]
  const season = useSeason()

  return (
    <div className="dash">
      <section className={`dash-hero${season ? ' dash-hero--season' : ''}`}>
        <SeasonalGarland season={season} />
        <div className="dash-hero__text">
          <p className="dash-hero__date">{todayText()}</p>
          <SeasonMessage season={season} />
          <h2 className="dash-hero__title">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h2>
          <ServerStatus />
        </div>
        <div className="dash-hero__controls">
          <BranchScopeToggle value={scope} onChange={setScope} />
          <div className="dash-periods" role="group" aria-label="Periodo">
            {PERIODS.map((item) => (
              <button key={item.key} type="button" aria-pressed={period === item.key} className={`dash-period${period === item.key ? ' is-active' : ''}`} onClick={() => setPeriod(item.key)}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="dash-refresh">
            <span>{fulfilledTimeStamp ? `Actualizado a las ${timeText(fulfilledTimeStamp)}` : ''}</span>
            <Button variant="ghost" size="sm" icon={RefreshCw} isLoading={isFetching} onClick={refetch}>
              Actualizar
            </Button>
          </div>
        </div>
      </section>

      {error && !data ? (
        <Alert tone="danger" title="No se pudo cargar el dashboard">
          {error.message}{' '}
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={refetch}>
            Reintentar
          </Button>
        </Alert>
      ) : !data ? (
        <div className="dash-content">
          <CardsSkeleton count={4} label="Preparando tus cifras…" />
          <div className="dash-grid" aria-hidden="true">
            <span className="dash-panel dash-panel--wide">
              <Skeleton width="30%" height="1.1em" />
              <Skeleton height="220px" radius="var(--radius-md)" />
            </span>
            <span className="dash-panel">
              <Skeleton width="50%" height="1.1em" />
              <Skeleton height="44px" radius="var(--radius-md)" />
              <Skeleton height="44px" radius="var(--radius-md)" />
              <Skeleton height="44px" radius="var(--radius-md)" />
            </span>
          </div>
        </div>
      ) : (
        <DashboardContent data={data} period={period} versus={info.versus} isFetching={isFetching} />
      )}
    </div>
  )
}

function DashboardContent({ data, period, versus, isFetching }) {
  const { sales, products, profit, cash, receivables, payables, attention, byBranch } = data
  const nothing = !sales && !products && !profit && !cash && !receivables && !payables && attention.length === 0
  if (nothing) {
    return (
      <p className="dash-empty dash-empty--page">
        Aún no tienes cifras para ver aquí. Usa el menú para ir a tu trabajo; si necesitas ver ventas, caja o inventario, pídele al administrador el permiso.
      </p>
    )
  }

  return (
    <div className={`dash-content${isFetching ? ' is-loading' : ''}`} aria-busy={isFetching}>
      {sales && (
        <div className="dash-kpis" role="group" aria-label="Cifras de ventas">
          <KpiCard label={sales.scope === 'mine' ? 'Mis ventas' : 'Vendido'} icon={BadgeDollarSign} value={formatCurrency(sales.total.value)} metric={sales.total} versus={versus} detail="Neto de devoluciones, con IVA" highlight={!profit} />
          <KpiCard label="Número de ventas" icon={ShoppingBasket} value={sales.count.value.toLocaleString('es-CO')} metric={sales.count} versus={versus} />
          <KpiCard label="Venta promedio" icon={Receipt} value={formatCurrency(sales.average.value)} metric={sales.average} versus={versus} />
          {/* Que el fiado suba o baje no es bueno ni malo por sí solo: la variación va en gris */}
          <KpiCard label="Fiado" icon={CreditCard} value={formatCurrency(sales.credit.value)} metric={sales.credit} versus={versus} detail="Quedó en la cartera" tone="muted" neutral />
        </div>
      )}
      {profit && (
        <div className="dash-kpis dash-kpis--profit" role="group" aria-label="Cifras de ganancias">
          <KpiCard label="Ganancia bruta" icon={TrendingUp} value={formatCurrency(profit.grossProfit.value)} metric={profit.grossProfit} versus={versus} detail={`Margen ${formatPercent(profit.grossMargin)}`} />
          <KpiCard label="Gastos" icon={Landmark} value={formatCurrency(profit.expenses.value)} metric={profit.expenses} versus={versus} inverse />
          <KpiCard label="Ganancia neta" icon={PiggyBank} value={formatCurrency(profit.netProfit.value)} metric={profit.netProfit} versus={versus} detail={`Margen ${formatPercent(profit.netMargin)}`} highlight tone={Number(profit.netProfit.value) < 0 ? 'danger' : undefined} />
        </div>
      )}

      <div className="dash-grid">
        {sales && (
          <section className="dash-panel dash-panel--wide" aria-labelledby="dash-sales-title">
            <header className="dash-panel__head">
              <h2 id="dash-sales-title">{sales.scope === 'mine' ? 'Mis ventas' : 'Ventas'}</h2>
              <span className="dash-panel__aside">Comparadas con {versus.replace(' a esta hora', '')}</span>
            </header>
            <SalesChart chart={sales.chart} period={period} />
          </section>
        )}
        <AttentionPanel alerts={attention} />
        {byBranch?.length > 0 && <BranchesPanel branches={byBranch} versus={versus} />}

        {profit?.chart && (
          <section className="dash-panel dash-panel--wide" aria-labelledby="dash-profit-title">
            <header className="dash-panel__head">
              <h2 id="dash-profit-title">Ingresos frente a gastos</h2>
              <span className="dash-panel__aside">Ganancia neta {formatCurrency(profit.netProfit.value)}</span>
            </header>
            <ProfitChart chart={profit.chart} period={period} />
          </section>
        )}
        {products && (
          <section className="dash-panel" aria-labelledby="dash-categories-title">
            <header className="dash-panel__head">
              <h2 id="dash-categories-title">Ventas por categoría</h2>
            </header>
            <CategoryDonut categories={products.categories} />
          </section>
        )}

        {products && <TopProducts products={products.top} />}
        {cash && <CashPanel cash={cash} />}
        {(receivables || payables) && <BalancesPanel receivables={receivables} payables={payables} />}
      </div>
    </div>
  )
}
