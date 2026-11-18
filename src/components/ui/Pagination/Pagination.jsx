import { ChevronLeft, ChevronRight } from 'lucide-react'
import './Pagination.css'

/** Paginación con el formato `meta` de la API: { page, pageSize, total, totalPages }. */
export function Pagination({ meta, onPageChange, itemLabel = 'registros' }) {
  if (!meta || meta.total === 0) return null
  const { page, pageSize, total, totalPages } = meta
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <nav className="pagination" aria-label="Paginación">
      <p className="pagination__summary">
        {from}–{to} de {total} {itemLabel}
      </p>
      <div className="pagination__controls">
        <button
          type="button"
          className="pagination__button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <span className="pagination__page" aria-current="page">
          Página {page} de {Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          className="pagination__button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}
