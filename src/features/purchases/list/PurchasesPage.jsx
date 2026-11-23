import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Eye, FileText, Layers, Paperclip, Plus, Search, ShoppingCart } from 'lucide-react'
import { useGetPurchaseGroupsQuery, useGetPurchasesQuery } from '../purchasesApi'
import { NewPurchaseGroupModal } from '../groups/NewPurchaseGroupModal'
import { useGetSuppliersQuery } from '../../inventory/inventoryApi'
import { PAYMENT_FILTER_OPTIONS, STATUS_TABS, formatDay, purchaseState, supplierName } from '../purchaseOptions'
import { useCan } from '../../../hooks/usePermissions'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../../components/layout/FilterBar/FilterBar'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination/Pagination'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Button } from '../../../components/ui/Button/Button'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { formatCurrency } from '../../../utils/format'
import { ROUTES, purchaseGroupPath, purchasePath } from '../../../routes/paths'
import '../../cash/cash.css'
import '../purchases.css'

/** Compras a proveedores (D-COMP-1): borradores, confirmadas y anuladas, con su estado de pago. */
export default function PurchasesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const canCreate = useCan('purchases.create')
  const canSeeSuppliers = useCan('suppliers.view')
  const [status, setStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const { data: groups = [] } = useGetPurchaseGroupsQuery()
  const debouncedSearch = useDebouncedValue(search.trim())
  const { data: suppliers } = useGetSuppliersQuery({ pageSize: 100, isActive: 'true' }, { skip: !canSeeSuppliers })
  const params = { page, pageSize: 20, ...(status && { status }), ...(paymentStatus && { paymentStatus }), ...(supplierId && { supplierId }), ...(debouncedSearch && { search: debouncedSearch }) }
  const { data, error, isFetching, refetch } = useGetPurchasesQuery(params)

  const reset = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const columns = [
    {
      key: 'number',
      header: 'Compra',
      primary: true,
      render: (row) => (
        <Link className="purchase-link" to={purchasePath(row.id)}>
          <span className="cash-link__name">{row.number ?? 'Borrador'}</span>
          <span className="cash-stack__detail">{row.supplierInvoiceNumber ? `Factura ${row.supplierInvoiceNumber}` : 'Sin número de factura'}</span>
        </Link>
      ),
    },
    { key: 'supplier', header: 'Proveedor', render: (row) => supplierName(row.supplier) },
    { key: 'date', header: 'Fecha', render: (row) => formatDay(row.invoiceDate) },
    { key: 'total', header: 'Total', align: 'end', render: (row) => (row.status === 'draft' ? '—' : <strong>{formatCurrency(row.total)}</strong>) },
    {
      key: 'balance',
      header: 'Saldo',
      align: 'end',
      render: (row) => (row.status === 'confirmed' && Number(row.balance) > 0 ? <span className="purchase-balance">{formatCurrency(row.balance)}</span> : '—'),
    },
    { key: 'due', header: 'Vence', render: (row) => (row.status === 'confirmed' && Number(row.balance) > 0 ? formatDay(row.dueDate) : '—') },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => {
        const state = purchaseState(row)
        return (
          <span className={`status-pill status-pill--${state.tone}`}>
            <span className="status-pill__dot" aria-hidden="true" />
            {state.label}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (row) => (
        <div className="row-actions">
          {row.hasAttachment && <Paperclip className="purchase-clip" aria-label="Con factura adjunta" />}
          <IconButton icon={row.status === 'draft' ? FileText : Eye} label={`${row.status === 'draft' ? 'Seguir el borrador' : 'Ver la compra'} ${row.number ?? ''}`.trim()} onClick={() => navigate(purchasePath(row.id))} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        description="Lo que le compras a tus proveedores. Guarda la compra como borrador mientras llega la mercancía y confírmala para que entre al inventario."
        actions={
          canCreate && (
            <>
              <Link className="button button--secondary button--md" to={ROUTES.purchaseNew}>
                <FileText className="button__icon" aria-hidden="true" />
                <span className="button__label">Compra a un proveedor</span>
              </Link>
              <Button icon={Plus} onClick={() => setIsCreatingGroup(true)}>
                Nueva compra
              </Button>
            </>
          )
        }
      />

      {groups.length > 0 && (
        <section className="purchase-groups" aria-label="Compras con varios proveedores">
          <h2 className="purchase-groups__title">
            <Layers aria-hidden="true" /> Compras con varios proveedores
          </h2>
          <ul className="purchase-groups__list">
            {groups.slice(0, 6).map((group) => (
              <li key={group.id}>
                <Link className="purchase-groups__card" to={purchaseGroupPath(group.id)}>
                  <span className="purchase-groups__name">{group.name}</span>
                  <span className="purchase-groups__meta">
                    {group.suppliersCount} {group.suppliersCount === 1 ? 'proveedor' : 'proveedores'} · {group.productsCount} {group.productsCount === 1 ? 'producto' : 'productos'}
                  </span>
                  <span className="purchase-groups__total">{formatCurrency(group.total)}</span>
                  <span className={`status-pill status-pill--${group.isOpen ? 'info' : 'success'}`}>
                    <span className="status-pill__dot" aria-hidden="true" />
                    {group.isOpen ? 'Abierta' : 'Confirmada'}
                  </span>
                  <ChevronRight className="purchase-groups__go" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="segmented" role="tablist" aria-label="Estado de las compras">
        {STATUS_TABS.map((tab) => (
          <button key={tab.value || 'all'} type="button" role="tab" aria-selected={status === tab.value} className={`segmented__option${status === tab.value ? ' segmented__option--active' : ''}`} onClick={() => reset(setStatus)(tab.value)}>
            {tab.label}
          </button>
        ))}
      </div>

      <FilterBar>
        <TextField label="Buscar" icon={Search} type="search" placeholder="Consecutivo (C-000012) o número de factura" value={search} onChange={(event) => reset(setSearch)(event.target.value)} />
        {canSeeSuppliers && (
          <SelectField label="Proveedor" placeholder="Todos" options={(suppliers?.rows ?? []).map((supplier) => ({ value: String(supplier.id), label: supplierName(supplier) }))} value={supplierId} onChange={(event) => reset(setSupplierId)(event.target.value)} />
        )}
        <SelectField label="Pago" placeholder="Todos" options={PAYMENT_FILTER_OPTIONS} value={paymentStatus} onChange={(event) => reset(setPaymentStatus)(event.target.value)} />
      </FilterBar>

      <DataTable
        caption="Compras"
        columns={columns}
        rows={data?.rows ?? []}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle={status || paymentStatus || supplierId || debouncedSearch ? 'No hay compras con estos filtros' : 'Aún no hay compras'}
        emptyDescription={canCreate && !status && !paymentStatus && !supplierId && !debouncedSearch ? 'Registra la primera con "Nueva compra".' : undefined}
      />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="compras" />
      {!data?.rows?.length && !isFetching && !error && canCreate && !status && (
        <p className="purchase-hint">
          <ShoppingCart aria-hidden="true" /> Cada compra confirmada actualiza la existencia, el costo y el precio de compra de sus productos.
        </p>
      )}
      {isCreatingGroup && (
        <NewPurchaseGroupModal
          onClose={() => setIsCreatingGroup(false)}
          onCreated={(group) => {
            setIsCreatingGroup(false)
            toast.success(`«${group.name}» creada: agrégale productos desde Nuevo producto`)
            navigate(purchaseGroupPath(group.id))
          }}
        />
      )}
    </>
  )
}
