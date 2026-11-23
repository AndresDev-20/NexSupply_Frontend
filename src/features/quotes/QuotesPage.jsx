import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, FilePlus2, Search } from 'lucide-react'
import { useGetQuotesQuery } from './quotesApi'
import { QUOTE_STATES, STATE_TONE, daysLeftText } from './quoteOptions'
import { useCan } from '../../hooks/usePermissions'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { PageHeader } from '../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../components/layout/FilterBar/FilterBar'
import { TextField } from '../../components/ui/TextField/TextField'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { Button } from '../../components/ui/Button/Button'
import { Badge } from '../../components/ui/Badge/Badge'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { ROUTES, quotePath } from '../../routes/paths'
import '../admin/admin.css'
import './quotes.css'

/** /ventas/cotizaciones — Cotizaciones: vigentes primero, buscar por número o cliente (D-COT-1). */
export default function QuotesPage() {
  const navigate = useNavigate()
  const canCreate = useCan('quotes.create')
  const [state, setState] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebouncedValue(search.trim(), 300)
  const { data, error, isFetching, refetch } = useGetQuotesQuery({ ...(state && { state }), ...(debounced && { search: debounced }), page, pageSize: 20 })

  const columns = [
    {
      key: 'number',
      header: 'Cotización',
      primary: true,
      render: (quote) => (
        <span className="quote-product">
          <strong>{quote.number}</strong>
          <small>{formatDateTime(quote.createdAt)}</small>
        </span>
      ),
    },
    { key: 'customer', header: 'Cliente', render: (quote) => quote.customer.name },
    { key: 'total', header: 'Total', align: 'end', render: (quote) => <strong className="numeric">{formatCurrency(quote.total)}</strong> },
    {
      key: 'state',
      header: 'Estado',
      render: (quote) => (
        <span className="customer-tags">
          <Badge tone={STATE_TONE[quote.state]}>{quote.stateLabel}</Badge>
          {quote.state === 'open' && <small>{daysLeftText(quote.daysLeft)}</small>}
        </span>
      ),
    },
    { key: 'actions', header: 'Acciones', align: 'end', render: (quote) => <IconButton icon={Eye} label={`Ver ${quote.number}`} onClick={() => navigate(quotePath(quote.id))} /> },
  ]

  return (
    <>
      <PageHeader
        description="El precio que le das al cliente antes de comprar. No aparta mercancía. Mientras esté vigente, al venderla se respetan sus precios."
        actions={
          canCreate && (
            <Button icon={FilePlus2} onClick={() => navigate(ROUTES.pos)}>
              Cotizar en el punto de venta
            </Button>
          )
        }
      />
      <div className="segmented" role="tablist" aria-label="Estado de las cotizaciones">
        {QUOTE_STATES.map((option) => (
          <button
            key={option.value || 'all'}
            type="button"
            role="tab"
            aria-selected={state === option.value}
            className={`segmented__option${state === option.value ? ' segmented__option--active' : ''}`}
            onClick={() => {
              setState(option.value)
              setPage(1)
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <FilterBar>
        <TextField
          label="Buscar"
          icon={Search}
          type="search"
          placeholder="Número (COT-000012) o cliente"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
      </FilterBar>
      <DataTable
        caption="Cotizaciones"
        columns={columns}
        rows={data?.rows ?? []}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle={debounced || state ? 'Ninguna cotización coincide' : 'Aún no hay cotizaciones'}
        emptyDescription={canCreate && !debounced && !state ? 'En el punto de venta, arma el pedido y escoge «Cotizar».' : undefined}
      />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="cotizaciones" />
    </>
  )
}
