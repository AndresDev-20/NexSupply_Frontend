import { useSearchParams } from 'react-router-dom'
import { ChevronRight, FileDown, FileSpreadsheet } from 'lucide-react'
import { useGetReportsCatalogQuery } from './reportsApi'
import { AREA_STYLE } from './reportOptions'
import { ReportView } from './ReportView'
import { AccountingBook } from './AccountingBook'
import { useCan } from '../../hooks/usePermissions'
import { PageHeader } from '../../components/layout/PageHeader/PageHeader'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import { Alert } from '../../components/feedback/Alert/Alert'
import '../expenses/expenses.css'
import './reports.css'

/**
 * Centro de informes (Fase 13, D-INF-4): tarjetas por área con solo lo que el usuario puede ver.
 * El informe abierto queda en la dirección (?informe=clave): se puede volver con el botón atrás.
 */
export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: catalog = [], isLoading, error } = useGetReportsCatalogQuery()
  const canExportBook = useCan('reports.accounting')
  const selectedKey = searchParams.get('informe')
  const group = catalog.find((item) => item.reports.some((report) => report.key === selectedKey))
  const selected = group?.reports.find((report) => report.key === selectedKey)

  if (isLoading) return <Spinner label="Cargando los informes…" />
  if (error) return <Alert tone="danger">{error.message}</Alert>

  if (selected) {
    return <ReportView key={selected.key} report={selected} area={group.area} onBack={() => setSearchParams({})} />
  }

  return (
    <>
      <PageHeader description="Todo lo que pasa en el negocio, en números. Escoge un informe, ajusta las fechas y descárgalo en Excel o PDF." />
      {canExportBook && <AccountingBook />}
      <div className="report-areas">
        {catalog.map((item) => {
          const style = AREA_STYLE[item.area] ?? AREA_STYLE.sales
          return (
            <section key={item.area} className={`report-area tone-${style.tone}`} aria-label={item.label}>
              <header className="report-area__head">
                <span className="report-area__icon" aria-hidden="true">
                  <style.icon />
                </span>
                <h2>{item.label}</h2>
                <span className="report-area__count">{item.reports.length}</span>
              </header>
              <ul>
                {item.reports.map((report) => (
                  <li key={report.key}>
                    <button type="button" className="report-link" onClick={() => setSearchParams({ informe: report.key })}>
                      <span className="report-link__text">
                        <strong>{report.title}</strong>
                        <small>{report.description}</small>
                      </span>
                      <span className="report-link__formats" aria-hidden="true">
                        {report.excel && <FileSpreadsheet />}
                        {report.pdf && <FileDown />}
                      </span>
                      <ChevronRight className="report-link__arrow" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </>
  )
}
