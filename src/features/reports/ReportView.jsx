import { useState } from 'react'
import { ArrowLeft, CalendarRange, FileDown, FileSpreadsheet, RotateCw } from 'lucide-react'
import { useGetReportOptionsQuery, useGetReportQuery, downloadReport } from './reportsApi'
import { AREA_STYLE, datePresets, formatCell, isNumeric } from './reportOptions'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { Alert } from '../../components/feedback/Alert/Alert'
import { Button } from '../../components/ui/Button/Button'
import { TextField } from '../../components/ui/TextField/TextField'
import { SelectField } from '../../components/ui/SelectField/SelectField'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import { formatCurrency, formatPercent } from '../../utils/format'
import { BranchScopeToggle } from '../../components/layout/BranchScopeToggle/BranchScopeToggle'
import { branchParams, useCanSeeAllBranches } from '../../components/layout/BranchScopeToggle/branchScope'

// Resumen destacado de algunos informes (lo que el dueño quiere ver de un vistazo)
const SUMMARY_CARDS = {
  profit_summary: (s) => [
    { label: 'Ventas netas', value: formatCurrency(s.netSales), detail: `${s.sales} ventas` },
    { label: 'Ganancia bruta', value: formatCurrency(s.grossProfit), detail: `Margen ${formatPercent(s.grossMargin)}`, tone: Number(s.grossProfit) < 0 ? 'danger' : 'success' },
    { label: 'Gastos', value: formatCurrency(s.expenses), detail: `${s.expensesCount} gastos` },
    { label: 'Ganancia neta', value: formatCurrency(s.netProfit), detail: `Margen ${formatPercent(s.netMargin)}`, tone: Number(s.netProfit) < 0 ? 'danger' : 'success', highlight: true },
  ],
  stock_valuation: (s) => [
    { label: 'Productos', value: s.products },
    { label: 'Agotados', value: s.out, tone: s.out > 0 ? 'danger' : 'success' },
    { label: 'Existencia baja', value: s.low, tone: s.low > 0 ? 'warning' : 'success' },
  ],
  expiring_batches: (s) => [
    { label: 'Lotes vencidos', value: s.expired, tone: s.expired > 0 ? 'danger' : 'success' },
    { label: `Vencen en ${s.days} días`, value: s.expiring, tone: s.expiring > 0 ? 'warning' : 'success' },
  ],
  cash_closings: (s) => [
    { label: 'Cierres', value: s.closings },
    { label: 'Con diferencia', value: s.withDifference, tone: s.withDifference > 0 ? 'warning' : 'success' },
  ],
  payables: (s) => [{ label: `Vencido (${s.overdueCount})`, value: formatCurrency(s.overdueBalance), tone: s.overdueCount > 0 ? 'danger' : 'success' }],
  receivables_by_customer: (s) => [
    { label: 'Clientes que deben', value: s.customers },
    { label: 'Con mora', value: s.customersOverdue, tone: s.customersOverdue > 0 ? 'danger' : 'success' },
  ],
}

/** Tabla del informe: columnas con el formato de su tipo y la fila de totales. */
function ReportTable({ columns, rows, totals }) {
  if (rows.length === 0) return <p className="report-empty">No hay datos con estos filtros.</p>
  return (
    <div className="report-table__wrap">
      <table className="report-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={isNumeric(column.type) ? 'is-num' : undefined}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className={row.kind ? `report-row--${row.kind}` : undefined}>
              {columns.map((column) => (
                <td key={column.key} className={isNumeric(column.type) ? 'is-num' : undefined}>
                  {formatCell(column.type, row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr>
              {columns.map((column, index) => (
                <td key={column.key} className={isNumeric(column.type) ? 'is-num' : undefined}>
                  {index === 0 ? 'Total' : totals[column.key] !== undefined ? formatCell(column.type, totals[column.key]) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/** Un informe: filtros según lo que acepta, resumen, tabla y descargas (D-INF-3). */
export function ReportView({ report, area, onBack }) {
  const toast = useToast()
  const presets = datePresets()
  const month = presets.find((preset) => preset.key === 'month')
  const has = (filter) => report.filters.includes(filter)
  const [filters, setFilters] = useState({ from: month.from, to: month.to, categoryId: '', sellerId: '', supplierId: '', registerId: '', days: String(report.defaults?.days ?? ''), order: 'most', stockStatus: 'all' })
  const [downloading, setDownloading] = useState(null)
  // Sucursal activa o «Todas» (Fase 19). La comparación por sucursal abre de una vez con «Todas»
  const canSeeAll = useCanSeeAllBranches()
  const [scope, setScope] = useState(() => (canSeeAll && report.key === 'sales_by_branch' ? 'all' : 'active'))
  const { data: options } = useGetReportOptionsQuery(undefined, { skip: !['category', 'seller', 'supplier', 'register'].some(has) })
  const params = {
    ...branchParams(scope),
    ...(has('dateRange') && { from: filters.from, to: filters.to }),
    ...(has('category') && filters.categoryId && { categoryId: filters.categoryId }),
    ...(has('seller') && filters.sellerId && { sellerId: filters.sellerId }),
    ...(has('supplier') && filters.supplierId && { supplierId: filters.supplierId }),
    ...(has('register') && filters.registerId && { registerId: filters.registerId }),
    ...(has('days') && filters.days && { days: filters.days }),
    ...(has('order') && { order: filters.order }),
    ...(has('stockStatus') && { stockStatus: filters.stockStatus }),
  }
  const { data, isFetching, error, refetch } = useGetReportQuery({ key: report.key, params })
  const set = (name, value) => setFilters((current) => ({ ...current, [name]: value }))
  const activePreset = presets.find((preset) => preset.from === filters.from && preset.to === filters.to)?.key
  const style = AREA_STYLE[area] ?? AREA_STYLE.sales
  const cards = data?.summary && SUMMARY_CARDS[report.key] ? SUMMARY_CARDS[report.key](data.summary) : null

  const download = async (format) => {
    setDownloading(format)
    try {
      const fileName = await downloadReport(report.key, format, params)
      toast.success(`Se descargó ${fileName}`)
    } catch (downloadError) {
      toast.error(downloadError.message)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <section className="report-view" aria-label={report.title}>
      <button type="button" className="report-back" onClick={onBack}>
        <ArrowLeft aria-hidden="true" /> Todos los informes
      </button>
      <header className={`report-view__head tone-${style.tone}`}>
        <span className="report-view__icon" aria-hidden="true">
          <style.icon />
        </span>
        <span className="report-view__titles">
          <h2>{report.title}</h2>
          <p>{report.description}</p>
        </span>
        <span className="report-view__downloads">
          {report.excel && (
            <Button variant="secondary" icon={FileSpreadsheet} isLoading={downloading === 'xlsx'} onClick={() => download('xlsx')} disabled={!data}>
              Excel
            </Button>
          )}
          {report.pdf && (
            <Button variant="secondary" icon={FileDown} isLoading={downloading === 'pdf'} onClick={() => download('pdf')} disabled={!data}>
              PDF
            </Button>
          )}
        </span>
      </header>

      {(report.filters.length > 0 || canSeeAll) && (
        <div className="report-filters">
          <BranchScopeToggle value={scope} onChange={setScope} className="report-filters__scope" />
          {has('dateRange') && (
            <>
              <div className="report-presets" role="group" aria-label="Periodo">
                <CalendarRange aria-hidden="true" />
                {presets.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    aria-pressed={activePreset === preset.key}
                    className={`report-preset${activePreset === preset.key ? ' is-active' : ''}`}
                    onClick={() => setFilters((current) => ({ ...current, from: preset.from, to: preset.to }))}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <TextField label="Desde" type="date" value={filters.from} max={filters.to} onChange={(event) => set('from', event.target.value)} />
              <TextField label="Hasta" type="date" value={filters.to} min={filters.from} onChange={(event) => set('to', event.target.value)} />
            </>
          )}
          {has('category') && <SelectField label="Categoría" placeholder="Todas" options={(options?.categories ?? []).map((row) => ({ value: String(row.id), label: row.name }))} value={filters.categoryId} onChange={(event) => set('categoryId', event.target.value)} />}
          {has('seller') && <SelectField label="Vendedor" placeholder="Todos" options={(options?.sellers ?? []).map((row) => ({ value: String(row.id), label: row.name }))} value={filters.sellerId} onChange={(event) => set('sellerId', event.target.value)} />}
          {has('supplier') && <SelectField label="Proveedor" placeholder="Todos" options={(options?.suppliers ?? []).map((row) => ({ value: String(row.id), label: row.name }))} value={filters.supplierId} onChange={(event) => set('supplierId', event.target.value)} />}
          {has('register') && <SelectField label="Caja" placeholder="Todas" options={(options?.registers ?? []).map((row) => ({ value: String(row.id), label: row.name }))} value={filters.registerId} onChange={(event) => set('registerId', event.target.value)} />}
          {has('days') && <TextField label={report.key === 'slow_movers' ? 'Sin vender hace (días)' : 'Vencen en los próximos (días)'} inputMode="numeric" value={filters.days} onChange={(event) => set('days', event.target.value.replace(/\D/g, '').slice(0, 3))} />}
          {has('order') && (
            <SelectField
              label="Mostrar"
              options={[
                { value: 'most', label: 'Más vendidos primero' },
                { value: 'least', label: 'Menos vendidos primero' },
              ]}
              value={filters.order}
              onChange={(event) => set('order', event.target.value)}
            />
          )}
          {has('stockStatus') && (
            <SelectField
              label="Estado"
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'low', label: 'Existencia baja' },
                { value: 'out', label: 'Agotados' },
              ]}
              value={filters.stockStatus}
              onChange={(event) => set('stockStatus', event.target.value)}
            />
          )}
        </div>
      )}

      {error ? (
        <Alert tone="danger" title="No se pudo armar el informe">
          {error.details?.[0]?.message ?? error.message}{' '}
          <Button size="sm" variant="ghost" icon={RotateCw} onClick={refetch}>
            Reintentar
          </Button>
        </Alert>
      ) : !data ? (
        <Spinner label="Armando el informe…" />
      ) : (
        <div className={`report-result${isFetching ? ' is-loading' : ''}`} aria-busy={isFetching}>
          {cards && (
            <div className="report-cards">
              {cards.map((card) => (
                <div key={card.label} className={`report-card${card.tone ? ` report-card--${card.tone}` : ''}${card.highlight ? ' report-card--highlight' : ''}`}>
                  <span className="report-card__label">{card.label}</span>
                  <strong className="report-card__value">{card.value}</strong>
                  {card.detail && <span className="report-card__detail">{card.detail}</span>}
                </div>
              ))}
            </div>
          )}
          <ReportTable columns={data.columns} rows={data.rows} totals={data.totals} />
          <p className="report-footnote">
            {data.rows.length} {data.rows.length === 1 ? 'fila' : 'filas'}
            {data.branches?.length > 1 ? ` · Suma ${data.branches.map((branch) => branch.name).join(', ')}` : ''}
            {report.excel ? ' · Descarga el Excel para trabajar los datos.' : ''}
          </p>
        </div>
      )}
    </section>
  )
}
