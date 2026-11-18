import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ClipboardCheck, ClipboardList, Eye, FolderTree, Plus } from 'lucide-react'
import { useGetInventoryCountsQuery, useOpenInventoryCountMutation } from './countsApi'
import { COUNT_STATUS_TABS, COUNT_STATUS_TONE, scopeLabel } from './countOptions'
import { useGetCategoriesQuery } from '../inventoryApi'
import { CategoryPicker } from '../categories/CategoryPicker'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination/Pagination'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Button } from '../../../components/ui/Button/Button'
import { Modal } from '../../../components/ui/Modal/Modal'
import { OptionCards } from '../../../components/ui/OptionCards/OptionCards'
import { TextField } from '../../../components/ui/TextField/TextField'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { formatCurrency, formatDateTime } from '../../../utils/format'
import { inventoryCountPath } from '../../../routes/paths'
import '../../admin/admin.css'
import '../../cash/cash.css'
import '../../purchases/purchases.css'
import '../inventory.css'
import './counts.css'

const SCOPES = [
  { value: 'all', label: 'Todo el inventario', description: 'Todos los productos activos.', icon: ClipboardList },
  { value: 'category', label: 'Una categoría', description: 'Solo esa categoría y sus subcategorías.', icon: FolderTree },
]

function OpenCountModal({ onClose, onOpened }) {
  const [scope, setScope] = useState('all')
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [categoryError, setCategoryError] = useState(null)
  const { data: tree = [] } = useGetCategoriesQuery()
  const [openCount, { isLoading, error }] = useOpenInventoryCountMutation()
  const { formError, fieldErrors } = splitApiError(error)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (scope === 'category' && !categoryId) {
      setCategoryError('Elige la categoría que vas a contar')
      return
    }
    try {
      const count = await openCount({ ...(scope === 'category' && { categoryId: Number(categoryId) }), notes: notes.trim() || null }).unwrap()
      onOpened(count)
    } catch {
      // Se muestra desde `error`
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={isLoading}
      size="lg"
      icon={ClipboardCheck}
      title="Nuevo inventario físico"
      description="Cuenta por partes, incluso en varios días. Puedes seguir vendiendo: cada producto se compara con lo que había en el sistema cuando lo contaste."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="open-count-form" icon={ClipboardCheck} isLoading={isLoading}>
            Empezar a contar
          </Button>
        </>
      }
    >
      <form id="open-count-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <OptionCards legend="¿Qué vas a contar?" name="count-scope" options={SCOPES} value={scope} onChange={setScope} />
        <FormSection icon={ClipboardList} title="Detalles" columns={1}>
          {scope === 'category' && (
            <CategoryPicker
              label="Categoría"
              tree={tree}
              value={categoryId}
              onChange={(value) => {
                setCategoryId(value)
                setCategoryError(null)
              }}
              error={categoryError || fieldErrors.categoryId}
              hint="Si eliges una categoría principal, entran también sus subcategorías."
              required
            />
          )}
          <TextField label="Nota" placeholder="Opcional. Ej.: cierre de mes, bodega 2" maxLength={255} value={notes} onChange={(event) => setNotes(event.target.value)} error={fieldErrors.notes} />
        </FormSection>
      </form>
    </Modal>
  )
}

/** Banner del conteo en curso: hay uno solo por sucursal. */
function OpenCountBanner({ count }) {
  const { counted, productsInScope } = count.summary
  const percent = productsInScope ? Math.round((counted / productsInScope) * 100) : 0
  return (
    <Link className="count-banner" to={inventoryCountPath(count.id)}>
      <span className="count-banner__icon" aria-hidden="true">
        <ClipboardCheck />
      </span>
      <span className="count-banner__text">
        <span className="count-banner__title">
          {count.number} en conteo · {scopeLabel(count)}
        </span>
        <span className="count-banner__detail">
          {counted} de {productsInScope} productos contados
        </span>
        <span className="count-progress" aria-hidden="true">
          <span className="count-progress__bar" style={{ width: `${percent}%` }} />
        </span>
      </span>
      <span className="count-banner__action">
        Continuar <ArrowRight aria-hidden="true" />
      </span>
    </Link>
  )
}

/** Inventarios físicos de la sucursal (D-INV-15). */
export default function CountsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const canCount = useCan('inventory.count')
  const canViewCost = useCan('inventory.cost_view')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { data, isFetching, error, refetch } = useGetInventoryCountsQuery({ page, pageSize: 20, ...(status && { status }) })
  const { data: openData } = useGetInventoryCountsQuery({ status: 'open', pageSize: 1 })
  const openCount = openData?.rows?.[0]

  const columns = [
    {
      key: 'number',
      header: 'Inventario',
      primary: true,
      render: (row) => (
        <Link className="purchase-link" to={inventoryCountPath(row.id)}>
          <span className="cash-link__name">{row.number}</span>
          <span className="cash-stack__detail">{scopeLabel(row)}</span>
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <span className={`status-pill status-pill--${COUNT_STATUS_TONE[row.status]}`}>
          <span className="status-pill__dot" aria-hidden="true" />
          {row.statusLabel}
        </span>
      ),
    },
    { key: 'counted', header: 'Contados', align: 'end', render: (row) => row.summary.counted },
    { key: 'differences', header: 'Con diferencia', align: 'end', render: (row) => row.summary.withDifference },
    ...(canViewCost
      ? [
          {
            key: 'net',
            header: 'Diferencia neta',
            align: 'end',
            render: (row) => (row.status === 'cancelled' ? '—' : <span className={`numeric${row.summary.netValue.startsWith('-') ? ' margin--negative' : ''}`}>{formatCurrency(row.summary.netValue)}</span>),
          },
        ]
      : []),
    { key: 'created', header: 'Abierto', render: (row) => `${formatDateTime(row.createdAt)} · ${row.createdBy?.fullName ?? '—'}` },
    { key: 'actions', header: 'Acciones', align: 'end', render: (row) => <IconButton icon={Eye} label={`Ver ${row.number}`} onClick={() => navigate(inventoryCountPath(row.id))} /> },
  ]

  return (
    <>
      <PageHeader
        description="Cuenta lo que hay en bodega, compáralo con el sistema y corrige las diferencias con un ajuste. Lo que no cuentes no se toca."
        actions={
          canCount &&
          !openCount && (
            <Button icon={Plus} onClick={() => setIsModalOpen(true)}>
              Nuevo inventario físico
            </Button>
          )
        }
      />

      {openCount && <OpenCountBanner count={openCount} />}

      <div className="segmented" role="tablist" aria-label="Estado de los inventarios">
        {COUNT_STATUS_TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            className={`segmented__option${status === tab.value ? ' segmented__option--active' : ''}`}
            onClick={() => {
              setStatus(tab.value)
              setPage(1)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        caption="Inventarios físicos"
        columns={columns}
        rows={data?.rows ?? []}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle="Aún no hay inventarios físicos"
        emptyDescription={canCount ? 'Empieza uno con "Nuevo inventario físico".' : undefined}
      />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="inventarios" />

      {isModalOpen && (
        <OpenCountModal
          onClose={() => setIsModalOpen(false)}
          onOpened={(count) => {
            setIsModalOpen(false)
            toast.success(`Inventario ${count.number} abierto`)
            navigate(inventoryCountPath(count.id))
          }}
        />
      )}
    </>
  )
}
