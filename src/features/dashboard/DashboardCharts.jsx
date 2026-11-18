// Gráficas del dashboard con Recharts (D-DASH-4).
// Los colores salen de los tokens CSS del tema: así respetan el modo claro y el oscuro.
import { useEffect, useState } from 'react'
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatPercent } from '../../utils/format'
import { bucketLabel, bucketTitle, periodInfo, plot } from './dashboardOptions'

const TOKENS = ['color-primary', 'color-accent', 'color-text-subtle', 'color-border', 'color-danger', 'color-info', 'color-surface']
/** Sin animaciones si la persona pidió menos movimiento en su sistema. */
const motionOk = () => !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

const SLICE_COLORS = ['#2f9e44', '#e8a317', '#2f80ed', '#8b5cf6', '#14b8a6', '#64748b']

/** Lee los colores del tema y los vuelve a leer si cambia (modo claro/oscuro). */
function useThemeColors() {
  const read = () => {
    const style = getComputedStyle(document.documentElement)
    return Object.fromEntries(TOKENS.map((token) => [token, style.getPropertyValue(`--${token}`).trim() || '#2f6b3a']))
  }
  const [colors, setColors] = useState(read)
  useEffect(() => {
    const update = () => setColors(read())
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    media?.addEventListener?.('change', update)
    return () => {
      observer.disconnect()
      media?.removeEventListener?.('change', update)
    }
  }, [])
  return colors
}

/** Pesos abreviados para el eje: $ 1,2 M, $ 350 mil. */
function shortMoney(value) {
  const amount = Math.abs(Number(value))
  const sign = Number(value) < 0 ? '-' : ''
  if (amount >= 1_000_000) return `${sign}$ ${(amount / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
  if (amount >= 1_000) return `${sign}$ ${Math.round(amount / 1_000).toLocaleString('es-CO')} mil`
  return `${sign}$ ${amount.toLocaleString('es-CO')}`
}

function ChartTooltip({ active, payload, render }) {
  if (!active || !payload?.length) return null
  return <div className="dash-tooltip">{render(payload[0].payload)}</div>
}

const axisProps = (colors) => ({ stroke: colors['color-text-subtle'], tick: { fill: colors['color-text-subtle'], fontSize: 12 }, tickLine: false, axisLine: false })

/** Ventas del periodo (área) con el periodo anterior (línea punteada). */
export function SalesChart({ chart, period }) {
  const colors = useThemeColors()
  const info = periodInfo(period)
  const data = chart.points.map((point) => ({ ...point, current: plot(point.total), previous: plot(point.previousTotal) }))
  const hasData = data.some((point) => point.current || point.previous)
  if (!hasData) return <p className="dash-empty">Todavía no hay ventas en este periodo.</p>
  return (
    <div className="dash-chart" role="img" aria-label={`Gráfica de ventas comparada con ${info.versus}`}>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dash-sales-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors['color-primary']} stopOpacity={0.35} />
              <stop offset="100%" stopColor={colors['color-primary']} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={colors['color-border']} strokeDasharray="3 3" />
          <XAxis dataKey="key" tickFormatter={(key) => bucketLabel(key, chart.bucket, period)} minTickGap={16} {...axisProps(colors)} />
          <YAxis tickFormatter={shortMoney} width={72} {...axisProps(colors)} />
          <Tooltip
            cursor={{ stroke: colors['color-border'] }}
            content={
              <ChartTooltip
                render={(point) => (
                  <>
                    <strong>{bucketTitle(point.key, chart.bucket, period)}</strong>
                    <span className="dash-tooltip__row dash-tooltip__row--primary">{point.total === null ? 'Aún no llega' : `${formatCurrency(point.total)} · ${point.count} ${point.count === 1 ? 'venta' : 'ventas'}`}</span>
                    {point.previousKey && (
                      <span className="dash-tooltip__row">
                        {info.previousName} ({bucketTitle(point.previousKey, chart.bucket, period)}): {formatCurrency(point.previousTotal)}
                      </span>
                    )}
                  </>
                )}
              />
            }
          />
          <Line type="monotone" dataKey="previous" stroke={colors['color-text-subtle']} strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
          <Area isAnimationActive={motionOk()} type="monotone" dataKey="current" stroke={colors['color-primary']} strokeWidth={3} fill="url(#dash-sales-fill)" connectNulls={false} activeDot={{ r: 5, fill: colors['color-accent'], stroke: colors['color-primary'] }} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="dash-legend">
        <span className="dash-legend__item dash-legend__item--current">Este periodo</span>
        <span className="dash-legend__item dash-legend__item--previous">{info.previousName}</span>
      </p>
    </div>
  )
}

/** Ingresos sin IVA, costo y gastos por día o mes, con la ganancia neta como línea. */
export function ProfitChart({ chart, period }) {
  const colors = useThemeColors()
  const data = chart.points.map((point) => ({ ...point, incomeValue: plot(point.income), costValue: plot(point.cost), expensesValue: plot(point.expenses), profitValue: plot(point.profit) }))
  if (!data.some((point) => point.incomeValue || point.expensesValue)) return <p className="dash-empty">Sin ventas ni gastos en este periodo.</p>
  return (
    <div className="dash-chart" role="img" aria-label="Gráfica de ingresos, costo, gastos y ganancia neta">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={colors['color-border']} strokeDasharray="3 3" />
          <XAxis dataKey="key" tickFormatter={(key) => bucketLabel(key, chart.bucket, period)} minTickGap={16} {...axisProps(colors)} />
          <YAxis tickFormatter={shortMoney} width={72} {...axisProps(colors)} />
          <Tooltip
            cursor={{ fill: colors['color-border'], opacity: 0.35 }}
            content={
              <ChartTooltip
                render={(point) => (
                  <>
                    <strong>{bucketTitle(point.key, chart.bucket, period)}</strong>
                    <span className="dash-tooltip__row">Ventas sin IVA: {formatCurrency(point.income)}</span>
                    <span className="dash-tooltip__row">Costo: {formatCurrency(point.cost)}</span>
                    <span className="dash-tooltip__row">Gastos: {formatCurrency(point.expenses)}</span>
                    <span className="dash-tooltip__row dash-tooltip__row--primary">Ganancia neta: {formatCurrency(point.profit)}</span>
                  </>
                )}
              />
            }
          />
          <Bar isAnimationActive={motionOk()} dataKey="incomeValue" fill={colors['color-primary']} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar isAnimationActive={motionOk()} dataKey="costValue" fill={colors['color-text-subtle']} radius={[4, 4, 0, 0]} maxBarSize={22} opacity={0.55} />
          <Bar isAnimationActive={motionOk()} dataKey="expensesValue" fill={colors['color-danger']} radius={[4, 4, 0, 0]} maxBarSize={22} opacity={0.75} />
          <Line isAnimationActive={motionOk()} type="monotone" dataKey="profitValue" stroke={colors['color-accent']} strokeWidth={3} dot={{ r: 3, fill: colors['color-accent'] }} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="dash-legend">
        <span className="dash-legend__item dash-legend__item--current">Ventas sin IVA</span>
        <span className="dash-legend__item dash-legend__item--cost">Costo</span>
        <span className="dash-legend__item dash-legend__item--expense">Gastos</span>
        <span className="dash-legend__item dash-legend__item--profit">Ganancia neta</span>
      </p>
    </div>
  )
}

/** Dona de ventas por categoría con su lista al lado. */
export function CategoryDonut({ categories }) {
  const colors = useThemeColors()
  if (categories.length === 0) return <p className="dash-empty">Sin ventas en este periodo.</p>
  const data = categories.map((row) => ({ ...row, value: plot(row.total) }))
  return (
    <div className="dash-donut">
      <div className="dash-donut__chart" role="img" aria-label="Ventas por categoría">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie isAnimationActive={motionOk()} data={data} dataKey="value" nameKey="category" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke={colors['color-surface']} strokeWidth={2}>
              {data.map((row, index) => (
                <Cell key={row.category} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip render={(row) => <span className="dash-tooltip__row dash-tooltip__row--primary">{`${row.category}: ${formatCurrency(row.total)}`}</span>} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="dash-donut__list">
        {categories.map((row, index) => (
          <li key={row.category}>
            <span className="dash-donut__dot" style={{ background: SLICE_COLORS[index % SLICE_COLORS.length] }} aria-hidden="true" />
            <span className="dash-donut__name">{row.category}</span>
            <span className="dash-donut__share">{formatPercent(row.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
