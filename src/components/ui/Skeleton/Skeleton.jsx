import './Skeleton.css'

// Esqueletos de carga (Fase 15, D-UX-5): muestran la forma de lo que viene en vez de un
// círculo girando, para que la pantalla no "salte" al llegar los datos. Para los lectores de
// pantalla se anuncian igual que el Spinner (role="status" con un texto oculto).

/** Bloque gris con brillo. width/height: cualquier medida CSS. */
export function Skeleton({ width = '100%', height = '1em', radius, className = '' }) {
  return <span className={`skeleton ${className}`.trim()} style={{ width, height, borderRadius: radius }} aria-hidden="true" />
}

function Status({ label, children, className }) {
  return (
    <div className={className} role="status">
      <span className="u-visually-hidden">{label}</span>
      {children}
    </div>
  )
}

/** Tabla en carga: encabezado y filas con el número de columnas de la tabla real. */
export function TableSkeleton({ columns = 4, rows = 6, label = 'Cargando registros…' }) {
  const widths = ['70%', '45%', '55%', '35%', '60%', '40%']
  return (
    <Status label={label} className="skeleton-table">
      <span className="skeleton-table__row skeleton-table__row--head" aria-hidden="true" style={{ '--cols': columns }}>
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} width="50%" height="0.75em" />
        ))}
      </span>
      {Array.from({ length: rows }, (_, row) => (
        <span key={row} className="skeleton-table__row" aria-hidden="true" style={{ '--cols': columns }}>
          {Array.from({ length: columns }, (_, col) => (
            <Skeleton key={col} width={widths[(row + col) % widths.length]} />
          ))}
        </span>
      ))}
    </Status>
  )
}

/** Tarjetas de cifras en carga (dashboard, resúmenes). */
export function CardsSkeleton({ count = 4, label = 'Cargando…' }) {
  return (
    <Status label={label} className="skeleton-cards">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="skeleton-card" aria-hidden="true">
          <Skeleton width="40%" height="0.75em" />
          <Skeleton width="70%" height="1.8em" />
          <Skeleton width="55%" height="0.75em" />
        </span>
      ))}
    </Status>
  )
}

/** Pantalla en carga: título, filtros y una tabla. variant "form" para formularios. */
export function PageSkeleton({ variant = 'table', label = 'Cargando…' }) {
  return (
    <Status label={label} className="skeleton-page">
      <span className="skeleton-page__header" aria-hidden="true">
        <Skeleton width="38%" height="1.1em" />
        <Skeleton width="16%" height="2.4em" radius="var(--radius-md)" />
      </span>
      {variant === 'form' ? (
        Array.from({ length: 3 }, (_, index) => (
          <span key={index} className="skeleton-page__section" aria-hidden="true">
            <Skeleton width="30%" height="1em" />
            <Skeleton width="60%" height="0.75em" />
            <span className="skeleton-page__fields">
              <Skeleton height="2.6em" radius="var(--radius-md)" />
              <Skeleton height="2.6em" radius="var(--radius-md)" />
            </span>
          </span>
        ))
      ) : (
        <>
          <span className="skeleton-page__filters" aria-hidden="true">
            <Skeleton width="100%" height="2.6em" radius="var(--radius-md)" />
          </span>
          <span className="skeleton-page__table" aria-hidden="true">
            {Array.from({ length: 7 }, (_, row) => (
              <Skeleton key={row} height="1em" width={row === 0 ? '100%' : `${90 - (row % 3) * 15}%`} />
            ))}
          </span>
        </>
      )}
    </Status>
  )
}
