import { useState } from 'react'
import { BookOpenCheck, Download } from 'lucide-react'
import { httpClient } from '../../api/httpClient'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { TextField } from '../../components/ui/TextField/TextField'
import { Button } from '../../components/ui/Button/Button'
import { todayIso } from '../purchases/purchaseOptions'

/** Primer y último día del mes pasado (lo que normalmente pide el contador). */
function lastMonth() {
  const [year, month] = todayIso().split('-').map(Number)
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate()
  const mm = String(prevMonth).padStart(2, '0')
  return { from: `${prevYear}-${mm}-01`, to: `${prevYear}-${mm}-${String(lastDay).padStart(2, '0')}` }
}

/**
 * Libro para el contador (D-CON-1): un Excel del periodo con Resumen, Ventas, Devoluciones,
 * Compras, Gastos, Abonos de clientes y Pagos a proveedores.
 */
export function AccountingBook() {
  const toast = useToast()
  const [range, setRange] = useState(lastMonth)
  const [isLoading, setIsLoading] = useState(false)

  const handleDownload = async () => {
    if (!range.from || !range.to) return toast.error('Escoge las dos fechas')
    if (range.from > range.to) return toast.error('La fecha final no puede ser anterior a la inicial')
    setIsLoading(true)
    try {
      const response = await httpClient.get('/accounting/book.xlsx', { params: range, responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `libro-contador-${range.from}-a-${range.to}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('Libro para el contador descargado')
    } catch (downloadError) {
      toast.error(downloadError.details?.[0]?.message ?? downloadError.message ?? 'No se pudo descargar el libro')
    } finally {
      setIsLoading(false)
    }
    return undefined
  }

  return (
    <section className="accounting-book" aria-label="Libro para el contador">
      <span className="accounting-book__icon" aria-hidden="true">
        <BookOpenCheck />
      </span>
      <div className="accounting-book__text">
        <h2>Libro para el contador</h2>
        <p>Un Excel del periodo con ventas, devoluciones, compras, gastos, abonos de clientes y pagos a proveedores, con el NIT o la cédula de cada tercero, base, IVA y total. Por defecto, el mes pasado.</p>
      </div>
      <div className="accounting-book__form">
        <TextField label="Desde" type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} />
        <TextField label="Hasta" type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} />
        <Button icon={Download} isLoading={isLoading} onClick={handleDownload}>
          Descargar Excel
        </Button>
      </div>
    </section>
  )
}
