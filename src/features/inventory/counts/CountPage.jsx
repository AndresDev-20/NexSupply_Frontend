import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, CheckCheck, ClipboardCheck, ClipboardList, Info, PackageMinus, PackagePlus, RotateCw, ScanBarcode, Scale, TriangleAlert } from 'lucide-react'
import { useApplyInventoryCountMutation, useCancelInventoryCountMutation, useGetInventoryCountItemsQuery, useGetInventoryCountQuery } from './countsApi'
import { COUNT_STATUS_TONE, ITEM_FILTERS, differenceTone, formatDifference, scopeLabel } from './countOptions'
import { CountRowEditor } from './CountRowEditor'
import { ReasonModal } from '../../purchases/detail/PurchaseModals'
import { useCan } from '../../../hooks/usePermissions'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { Button } from '../../../components/ui/Button/Button'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { TextField } from '../../../components/ui/TextField/TextField'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination/Pagination'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { formatCurrency, formatDateTime, formatQuantity } from '../../../utils/format'
import { ROUTES, productPath } from '../../../routes/paths'
import '../../admin/admin.css'
import '../../cash/cash.css'
import '../../purchases/purchases.css'
import '../products/ProductDetailPage.css'
import '../inventory.css'
import './counts.css'

function Tile({ icon: Icon, tone, value, label }) {
  return (
    <div className={`cash-tile cash-tile--${tone}`}>
      <Icon aria-hidden="true" />
      <span className="cash-tile__value">{value}</span>
      <span className="cash-tile__label">{label}</span>
    </div>
  )
}

/** Un inventario físico: contar por partes, revisar diferencias y aplicarlo (D-INV-15). */
export default function CountPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const canCount = useCan('inventory.count')
  const canApply = useCan('inventory.count_apply')
  const canViewCost = useCan('inventory.cost_view')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState(null) // 'apply' | 'cancel'
  const firstInputRef = useRef(null)
  const debouncedSearch = useDebouncedValue(search.trim(), 250)
  const { data: count, isLoading, error, refetch } = useGetInventoryCountQuery(id)
  const isOpen = count?.status === 'open'
  const itemFilter = isOpen ? filter : filter === 'differences' ? 'differences' : 'counted'
  const items = useGetInventoryCountItemsQuery({ id, page, pageSize: 25, filter: itemFilter, ...(debouncedSearch && { search: debouncedSearch }) }, { skip: !count })
  const [applyCount, applyState] = useApplyInventoryCountMutation()
  const [cancelCount, cancelState] = useCancelInventoryCountMutation()

  if (isLoading) {
    return (
      <div className="product-detail__state">
        <Spinner size="lg" label="Cargando el inventario…" />
      </div>
    )
  }
  if (error || !count) {
    return (
      <StatusMessage icon={TriangleAlert} tone="danger" title={error?.status === 404 ? 'El inventario no existe' : 'No se pudo cargar el inventario'} description={error?.message}>
        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(ROUTES.inventoryCounts)}>
          Volver a inventarios
        </Button>
        {error?.status !== 404 && (
          <Button icon={RotateCw} onClick={refetch}>
            Reintentar
          </Button>
        )}
      </StatusMessage>
    )
  }

  const summary = count.summary
  const editable = isOpen && canCount
  const percent = summary.productsInScope ? Math.round((summary.counted / summary.productsInScope) * 100) : 100
  const rows = items.data?.rows ?? []

  const handleApply = async () => {
    try {
      const applied = await applyCount(count.id).unwrap()
      toast.success(`Inventario ${applied.number} aplicado: ${applied.summary.withDifference} ${applied.summary.withDifference === 1 ? 'ajuste' : 'ajustes'}`)
    } catch (applyError) {
      toast.error(applyError.message)
    }
    setDialog(null)
  }

  const handleCancel = async (reason) => {
    try {
      await cancelCount({ id: count.id, reason }).unwrap()
      toast.success(`Inventario ${count.number} anulado`)
      setDialog(null)
    } catch {
      // Se muestra en el modal
    }
  }

  // Lector de código de barras o búsqueda: Enter con un solo resultado lleva a su casilla
  const handleSearchKey = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (rows.length === 1) firstInputRef.current?.focus()
  }

  const columns = [
    {
      key: 'product',
      header: 'Producto',
      primary: true,
      render: (row) => (
        <Link className="purchase-link" to={productPath(row.product.id)}>
          <span className="cash-link__name">{row.product.name}</span>
          <span className="cash-stack__detail">{row.product.code}</span>
        </Link>
      ),
    },
    {
      key: 'system',
      header: 'Sistema',
      align: 'end',
      render: (row) => (
        <span className="numeric" title={row.count ? 'Existencia del sistema cuando se contó' : 'Existencia actual'}>
          {formatQuantity(row.count ? row.count.systemQuantity : row.currentStock)} {row.product.unit?.symbol}
        </span>
      ),
    },
    {
      key: 'counted',
      header: 'Contado',
      align: 'end',
      render: (row) =>
        row.count ? (
          <span className="numeric count-cell__counted">
            {formatQuantity(row.count.countedQuantity)} {row.product.unit?.symbol}
          </span>
        ) : (
          <span className="count-cell__pending">Sin contar</span>
        ),
    },
    {
      key: 'difference',
      header: 'Diferencia',
      align: 'end',
      render: (row) =>
        row.count ? (
          <span className={`status-pill status-pill--${differenceTone(row.count.difference)}`}>
            {formatDifference(row.count.difference)} {row.product.unit?.symbol}
          </span>
        ) : (
          '—'
        ),
    },
    ...(canViewCost
      ? [
          {
            key: 'value',
            header: 'Valor',
            align: 'end',
            render: (row) => (row.count && Number(row.count.differenceValue) ? <span className={`numeric${row.count.differenceValue.startsWith('-') ? ' margin--negative' : ''}`}>{formatCurrency(row.count.differenceValue)}</span> : '—'),
          },
        ]
      : []),
    ...(editable ? [{ key: 'edit', header: 'Contar', render: (row) => <CountRowEditor countId={count.id} row={row} inputRef={row === rows[0] ? firstInputRef : undefined} /> }] : []),
  ]

  return (
    <div className="count-page">
      <button type="button" className="product-detail__back" onClick={() => navigate(ROUTES.inventoryCounts)}>
        <ArrowLeft aria-hidden="true" /> Inventarios físicos
      </button>

      <header className="count-hero">
        <span className="count-hero__icon" aria-hidden="true">
          <ClipboardCheck />
        </span>
        <div className="count-hero__text">
          <h2 className="count-hero__title">
            {count.number}
            <span className={`status-pill status-pill--${COUNT_STATUS_TONE[count.status]}`}>
              <span className="status-pill__dot" aria-hidden="true" />
              {count.statusLabel}
            </span>
          </h2>
          <p className="count-hero__meta">
            {scopeLabel(count)} · Abierto el {formatDateTime(count.createdAt)} por {count.createdBy?.fullName ?? '—'}
            {count.notes && ` · ${count.notes}`}
          </p>
          {count.status === 'applied' && (
            <p className="count-hero__meta">
              Aplicado el {formatDateTime(count.appliedAt)} por {count.appliedBy?.fullName ?? '—'}
            </p>
          )}
        </div>
        {isOpen && canApply && (
          <div className="count-hero__actions">
            <Button variant="ghost" icon={Ban} onClick={() => setDialog('cancel')}>
              Anular
            </Button>
            <Button icon={CheckCheck} onClick={() => setDialog('apply')} disabled={summary.counted === 0}>
              Aplicar inventario
            </Button>
          </div>
        )}
      </header>

      {count.status === 'cancelled' && (
        <div className="count-page__alert">
          <Alert tone="warning">
            Anulado el {formatDateTime(count.cancelledAt)} por {count.cancelledBy?.fullName ?? '—'}: {count.cancelReason}. No se cambió ninguna existencia.
          </Alert>
        </div>
      )}

      {isOpen && (
        <div className="count-progress-card">
          <div className="count-progress-card__head">
            <span>
              <strong>{summary.counted}</strong> de {summary.productsInScope} productos contados
            </span>
            <span>{percent} %</span>
          </div>
          <span className="count-progress" aria-hidden="true">
            <span className="count-progress__bar" style={{ width: `${percent}%` }} />
          </span>
          <p className="count-progress-card__note">
            <Info aria-hidden="true" />
            Cada producto se compara con lo que había en el sistema cuando lo contaste: puedes seguir vendiendo. Lo que no cuentes no se toca.
          </p>
        </div>
      )}

      <section className={`cash-tiles${canViewCost ? ' cash-tiles--four' : ''}`} aria-label="Resumen del inventario">
        <Tile icon={ClipboardList} tone="info" value={summary.counted} label="Contados" />
        <Tile icon={Scale} tone={summary.withDifference ? 'warning' : 'success'} value={summary.withDifference} label="Con diferencia" />
        {canViewCost ? (
          <>
            <Tile icon={PackageMinus} tone="danger" value={formatCurrency(summary.shortageValue)} label="Faltante" />
            <Tile icon={PackagePlus} tone="success" value={formatCurrency(summary.surplusValue)} label="Sobrante" />
          </>
        ) : (
          isOpen && <Tile icon={ClipboardCheck} tone="accent" value={summary.pending} label="Sin contar" />
        )}
      </section>

      <div className="segmented" role="tablist" aria-label="Productos del inventario">
        {ITEM_FILTERS.filter((option) => isOpen || ['counted', 'differences'].includes(option.value)).map((option) => {
          const active = itemFilter === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={`segmented__option${active ? ' segmented__option--active' : ''}`}
              onClick={() => {
                setFilter(option.value)
                setPage(1)
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <div className="count-search">
        <TextField
          label={editable ? 'Escanea o busca el producto' : 'Buscar producto'}
          icon={ScanBarcode}
          type="search"
          placeholder="Nombre, código interno o código de barras"
          hint={editable ? 'Con un solo resultado, Enter te lleva a su casilla. Escribe lo contado y presiona Enter.' : undefined}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          onKeyDown={handleSearchKey}
          data-autofocus={editable || undefined}
        />
      </div>

      <DataTable
        caption="Productos del inventario"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.product.id}
        isLoading={items.isFetching && !items.data}
        error={items.error}
        onRetry={items.refetch}
        emptyTitle={itemFilter === 'pending' ? '¡Todo contado!' : itemFilter === 'differences' ? 'Sin diferencias' : 'Sin productos'}
        emptyDescription={debouncedSearch ? 'Ningún producto coincide con la búsqueda.' : undefined}
      />
      <Pagination meta={items.data?.pagination} onPageChange={setPage} itemLabel="productos" />

      <ConfirmDialog
        isOpen={dialog === 'apply'}
        title={`Aplicar el inventario ${count.number}`}
        message={
          <>
            Se hará un ajuste por cada producto con diferencia ({summary.withDifference}).
            {canViewCost && ` Faltante ${formatCurrency(summary.shortageValue)}, sobrante ${formatCurrency(summary.surplusValue)}, neto ${formatCurrency(summary.netValue)}.`}
            {summary.pending > 0 && ` Los ${summary.pending} productos sin contar no se tocan.`} Después no se puede deshacer.
          </>
        }
        confirmLabel="Sí, aplicar"
        isLoading={applyState.isLoading}
        onConfirm={handleApply}
        onCancel={() => setDialog(null)}
      />
      {dialog === 'cancel' && (
        <ReasonModal
          title={`Anular el inventario ${count.number}`}
          description="No se cambia ninguna existencia y queda el registro de quién lo anuló y por qué."
          confirmLabel="Anular inventario"
          placeholder="Ej.: se contó mal la bodega, se repetirá"
          isLoading={cancelState.isLoading}
          error={cancelState.error}
          onClose={() => setDialog(null)}
          onConfirm={handleCancel}
        />
      )}
    </div>
  )
}
