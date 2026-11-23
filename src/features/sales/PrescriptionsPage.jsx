import { useState } from 'react'
import { Search, Stethoscope } from 'lucide-react'
import { useGetPrescriptionsQuery } from './salesApi'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { PageHeader } from '../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../components/layout/FilterBar/FilterBar'
import { TextField } from '../../components/ui/TextField/TextField'
import { SelectField } from '../../components/ui/SelectField/SelectField'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { Badge } from '../../components/ui/Badge/Badge'
import { Alert } from '../../components/feedback/Alert/Alert'
import { formatDateTime, formatQuantity } from '../../utils/format'
import '../admin/admin.css'
import '../quotes/quotes.css'
import '../settings/settings.css'

const dayText = (iso) => (iso ? iso.split('-').reverse().join('/') : '—')

/**
 * /ventas/formulas — Libro de fórmulas veterinarias (D-VET-1): cada venta de productos que
 * requieren fórmula, con sus datos o la marca «Sin fórmula».
 */
export default function PrescriptionsPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [has, setHas] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebouncedValue(search.trim(), 300)
  const reset = (setter) => (value) => {
    setter(value)
    setPage(1)
  }
  const { data, error, isFetching, refetch } = useGetPrescriptionsQuery({ ...(from && { from }), ...(to && { to }), ...(has && { has }), ...(debounced && { search: debounced }), page, pageSize: 20 })
  const missing = data?.pagination?.summary?.withoutPrescription ?? 0

  const columns = [
    {
      key: 'sale',
      header: 'Venta',
      primary: true,
      render: (row) => (
        <span className="quote-product">
          <strong>
            {row.sale?.number} {row.sale?.status === 'cancelled' && <Badge tone="neutral">Anulada</Badge>}
          </strong>
          <small>
            {formatDateTime(row.createdAt)} · {row.sale?.customer?.isFinalConsumer ? 'Consumidor final' : (row.sale?.customer?.name ?? '')}
          </small>
        </span>
      ),
    },
    {
      key: 'products',
      header: 'Productos',
      render: (row) => (
        <span className="quote-product">
          {row.products.map((product) => (
            <small key={product.productId}>
              {formatQuantity(product.quantity)} {product.unit} · {product.productName}
            </small>
          ))}
        </span>
      ),
    },
    {
      key: 'prescription',
      header: 'Fórmula',
      render: (row) =>
        row.hasPrescription ? (
          <span className="quote-product">
            <strong>N.º {row.number}</strong>
            <small>
              {row.veterinarianName}
              {row.veterinarianLicense ? ` · TP ${row.veterinarianLicense}` : ''} · {dayText(row.date)}
            </small>
            {row.patient && <small>{row.patient}</small>}
          </span>
        ) : (
          <Badge tone="warning">Sin fórmula</Badge>
        ),
    },
    { key: 'seller', header: 'Vendió', render: (row) => row.seller?.fullName ?? '—' },
  ]

  return (
    <>
      <PageHeader description="Cada venta de productos marcados «Requiere fórmula veterinaria», con la fórmula que la respaldó. El sistema registra; no diagnostica ni formula." />
      {missing > 0 && !has && (
        <Alert tone="warning">
          {missing} {missing === 1 ? 'venta quedó' : 'ventas quedaron'} sin fórmula en este periodo.
        </Alert>
      )}
      <FilterBar>
        <TextField label="Buscar" icon={Search} type="search" placeholder="N.º de fórmula, veterinario o venta" value={search} onChange={(event) => reset(setSearch)(event.target.value)} />
        <TextField label="Desde" type="date" value={from} onChange={(event) => reset(setFrom)(event.target.value)} />
        <TextField label="Hasta" type="date" value={to} onChange={(event) => reset(setTo)(event.target.value)} />
        <SelectField
          label="Mostrar"
          options={[
            { value: '', label: 'Todas' },
            { value: 'with', label: 'Con fórmula' },
            { value: 'without', label: 'Sin fórmula' },
          ]}
          value={has}
          onChange={(event) => reset(setHas)(event.target.value)}
        />
      </FilterBar>
      <DataTable
        caption="Libro de fórmulas veterinarias"
        columns={columns}
        rows={data?.rows ?? []}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle="No hay ventas con fórmula en este periodo"
        emptyDescription="Aparecen aquí al vender productos marcados «Requiere fórmula veterinaria» (Inventario → producto → Ficha veterinaria)."
      />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="ventas" />
      <p className="settings-note">
        <Stethoscope aria-hidden="true" />
        <span>Guarde las fórmulas físicas: este libro las relaciona con cada venta.</span>
      </p>
    </>
  )
}
