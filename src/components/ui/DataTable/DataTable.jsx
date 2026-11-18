import { Inbox, RefreshCw, TriangleAlert } from 'lucide-react'
import { TableSkeleton } from '../Skeleton/Skeleton'
import { Button } from '../Button/Button'
import './DataTable.css'

/**
 * Tabla de datos. Desde 1280px es una tabla; por debajo cada fila se vuelve una
 * tarjeta con etiquetas (CSS), sin scroll horizontal.
 *
 * columns: [{ key, header, render?(row), align?: 'end', primary?: true }]
 *   `primary` es la columna que encabeza la tarjeta en celular.
 */
export function DataTable({
  columns,
  rows,
  getRowId = (row) => row.id,
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = 'No hay registros',
  emptyDescription,
  caption,
}) {
  if (isLoading && rows.length === 0) {
    return (
      <div aria-busy="true">
        <TableSkeleton columns={Math.min(columns.length, 6)} label="Cargando registros…" />
      </div>
    )
  }

  if (error && rows.length === 0) {
    return (
      <div className="data-table__state data-table__state--error" role="alert">
        <TriangleAlert className="data-table__state-icon" aria-hidden="true" />
        <p className="data-table__state-title">No se pudo cargar la información</p>
        <p className="data-table__state-text">{error.message}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
            Reintentar
          </Button>
        )}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="data-table__state">
        <Inbox className="data-table__state-icon" aria-hidden="true" />
        <p className="data-table__state-title">{emptyTitle}</p>
        {emptyDescription && <p className="data-table__state-text">{emptyDescription}</p>}
      </div>
    )
  }

  return (
    <div className={`data-table${isLoading ? ' data-table--refreshing' : ''}`}>
      <table className="data-table__table">
        {caption && <caption className="u-visually-hidden">{caption}</caption>}
        <thead className="data-table__head">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={`data-table__th${column.align === 'end' ? ' data-table__th--end' : ''}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)} className="data-table__row">
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={column.header}
                  className={[
                    'data-table__td',
                    column.align === 'end' ? 'data-table__td--end' : '',
                    column.primary ? 'data-table__td--primary' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
