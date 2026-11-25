import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlarmClock, Cake, CalendarClock, Eye, FileSpreadsheet, HandCoins, Search, UserPlus, Users } from 'lucide-react'
import { useGetCustomersQuery, useGetReceivablesSummaryQuery } from './customersApi'
import { DEBT_FILTERS, birthdayLabel } from './customerOptions'
import { CustomerFormModal } from './CustomerFormModal'
import { useCan } from '../../hooks/usePermissions'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../components/layout/FilterBar/FilterBar'
import { TextField } from '../../components/ui/TextField/TextField'
import { SelectField } from '../../components/ui/SelectField/SelectField'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { Button } from '../../components/ui/Button/Button'
import { Badge } from '../../components/ui/Badge/Badge'
import { formatCurrency } from '../../utils/format'
import { ROUTES, customerPath } from '../../routes/paths'
import '../cash/cash.css'
import '../purchases/purchases.css'
import './customers.css'

function Tile({ icon: Icon, tone, value, label }) {
  return (
    <div className={`cash-tile cash-tile--${tone}`}>
      <Icon aria-hidden="true" />
      <span className="cash-tile__value">{value}</span>
      <span className="cash-tile__label">{label}</span>
    </div>
  )
}

/** Clientes con su saldo, filtros por deuda y cumpleaños (D-CLI-2, D-CLI-8). */
export default function CustomersPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const canManage = useCan('customers.manage')
  const canSeeDebt = useCan('receivables.view')
  const [search, setSearch] = useState('')
  const [debt, setDebt] = useState('')
  const [extra, setExtra] = useState('') // '' | 'birthday' | 'inactive'
  const [page, setPage] = useState(1)
  const [isCreating, setIsCreating] = useState(false)
  const debouncedSearch = useDebouncedValue(search.trim())
  const params = {
    page,
    pageSize: 20,
    isActive: extra === 'inactive' ? 'false' : 'true',
    ...(debt && { debt }),
    ...(extra === 'birthday' && { birthday: 'soon' }),
    ...(debouncedSearch && { search: debouncedSearch }),
  }
  const { data, isFetching, error, refetch } = useGetCustomersQuery(params)
  const { data: summary } = useGetReceivablesSummaryQuery(undefined, { skip: !canSeeDebt })

  const reset = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const columns = [
    {
      key: 'name',
      header: 'Cliente',
      primary: true,
      render: (row) => (
        <Link className="purchase-link" to={customerPath(row.id)}>
          <span className="cash-link__name">{row.name}</span>
          <span className="cash-stack__detail">{[row.phone, row.location].filter(Boolean).join(' · ') || 'Sin celular'}</span>
        </Link>
      ),
    },
    { key: 'document', header: 'Documento', render: (row) => (row.documentNumber ? `${row.documentType} ${row.documentNumber}` : '—') },
    ...(canSeeDebt
      ? [
          {
            key: 'balance',
            header: 'Debe',
            align: 'end',
            render: (row) =>
              Number(row.balance) > 0 ? (
                <span className="cash-stack customer-debt">
                  <strong className="numeric">{formatCurrency(row.balance)}</strong>
                  {Number(row.overdueBalance) > 0 && <span className="customer-debt__overdue">{formatCurrency(row.overdueBalance)} vencido</span>}
                </span>
              ) : (
                <span className="u-text-muted">Al día</span>
              ),
          },
        ]
      : []),
    {
      key: 'tags',
      header: 'Notas',
      render: (row) => {
        const birthday = birthdayLabel(row)
        return (
          <span className="customer-tags">
            {birthday && (
              <Badge tone="accent" icon={Cake}>
                {birthday}
              </Badge>
            )}
            {row.isOverCreditLimit && <Badge tone="warning">Pasó el cupo</Badge>}
            {!row.isActive && <Badge tone="neutral">Inactivo</Badge>}
            {!birthday && !row.isOverCreditLimit && row.isActive && '—'}
          </span>
        )
      },
    },
    { key: 'actions', header: 'Acciones', align: 'end', render: (row) => <IconButton icon={Eye} label={`Ver ${row.name}`} onClick={() => navigate(customerPath(row.id))} /> },
  ]

  return (
    <>
      <PageHeader
        description="Tus clientes, lo que deben y sus cumpleaños. Registra un cliente con solo su nombre; para fiarle, agrega su celular."
        actions={
          canManage && (
            <>
              <Button variant="secondary" icon={FileSpreadsheet} onClick={() => navigate(ROUTES.customerImport)}>
                Importar
              </Button>
              <Button icon={UserPlus} onClick={() => setIsCreating(true)}>
                Nuevo cliente
              </Button>
            </>
          )
        }
      />

      {canSeeDebt && summary && (
        <section className="cash-tiles cash-tiles--four" aria-label="Resumen de la cartera">
          <Tile icon={HandCoins} tone="info" value={formatCurrency(summary.balance)} label="Por cobrar" />
          <Tile icon={AlarmClock} tone="danger" value={formatCurrency(summary.overdue)} label="Vencido" />
          <Tile icon={CalendarClock} tone="warning" value={formatCurrency(summary.dueThisWeek)} label="Vence esta semana" />
          <Tile icon={Users} tone="accent" value={`${summary.customersWithDebt}${summary.customersOverdue ? ` · ${summary.customersOverdue} morosos` : ''}`} label="Clientes con deuda" />
        </section>
      )}

      {canSeeDebt && (
        <div className="segmented" role="tablist" aria-label="Deuda de los clientes">
          {DEBT_FILTERS.map((option) => (
            <button key={option.value || 'all'} type="button" role="tab" aria-selected={debt === option.value} className={`segmented__option${debt === option.value ? ' segmented__option--active' : ''}`} onClick={() => reset(setDebt)(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      )}

      <FilterBar>
        <TextField label="Buscar" icon={Search} type="search" placeholder="Nombre, cédula o celular" value={search} onChange={(event) => reset(setSearch)(event.target.value)} />
        <SelectField
          label="Mostrar"
          options={[
            { value: '', label: 'Clientes activos' },
            { value: 'birthday', label: 'Cumpleaños en los próximos 7 días' },
            { value: 'inactive', label: 'Clientes inactivos' },
          ]}
          value={extra}
          onChange={(event) => reset(setExtra)(event.target.value)}
        />
      </FilterBar>

      <DataTable
        caption="Clientes"
        columns={columns}
        rows={data?.rows ?? []}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle={debouncedSearch || debt || extra ? 'Ningún cliente coincide' : 'Aún no hay clientes'}
        emptyDescription={canManage && !debouncedSearch && !debt && !extra ? 'Registra el primero con "Nuevo cliente".' : undefined}
      />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="clientes" />

      {isCreating && (
        <CustomerFormModal
          onClose={() => setIsCreating(false)}
          onSaved={(saved) => {
            setIsCreating(false)
            toast.success(`${saved.name} quedó registrado`)
            navigate(customerPath(saved.id))
          }}
        />
      )}
    </>
  )
}
