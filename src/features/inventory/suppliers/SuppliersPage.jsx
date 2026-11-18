import { useState } from 'react'
import { Pencil, Power, Search, Truck } from 'lucide-react'
import { useGetSuppliersQuery, useSetSupplierActiveMutation } from '../inventoryApi'
import { useCan } from '../../../hooks/usePermissions'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../../components/layout/FilterBar/FilterBar'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination/Pagination'
import { Badge } from '../../../components/ui/Badge/Badge'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { formatDocument } from '../../../utils/identityDocument'
import { SupplierFormModal } from './SupplierFormModal'
import '../../admin/admin.css'
import '../inventory.css'

const STATUS_OPTIONS = [
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
]

/** Proveedores (D-INV-4, D-INV-5). Ver con suppliers.view; registrar y editar con suppliers.manage. */
export default function SuppliersPage() {
  const toast = useToast()
  const canManage = useCan('suppliers.manage')
  const [search, setSearch] = useState('')
  const [isActive, setIsActive] = useState('true')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search.trim())
  const params = { page, pageSize: 20, ...(debouncedSearch && { search: debouncedSearch }), ...(isActive && { isActive }) }
  const { data, error, isFetching, refetch } = useGetSuppliersQuery(params)
  const [setActive, toggleState] = useSetSupplierActiveMutation()
  const [editing, setEditing] = useState(null)
  const [toToggle, setToToggle] = useState(null)

  const handleToggle = async () => {
    try {
      const updated = await setActive({ id: toToggle.id, active: !toToggle.isActive }).unwrap()
      toast.success(updated.isActive ? `${updated.legalName} fue activado` : `${updated.legalName} fue desactivado`)
    } catch (toggleError) {
      toast.error(toggleError.message)
    }
    setToToggle(null)
  }

  const resetPage = (setter) => (event) => {
    setter(event.target.value)
    setPage(1)
  }

  const columns = [
    {
      key: 'name',
      header: 'Proveedor',
      primary: true,
      render: (supplier) => (
        <div className="entity-cell">
          <span className="entity-cell__icon" aria-hidden="true">
            <Truck size={16} />
          </span>
          <span className="entity-cell__text">
            <span className="entity-cell__name">{supplier.tradeName || supplier.legalName}</span>
            <span className="entity-cell__detail">
              {supplier.tradeName && `${supplier.legalName} · `}
              {formatDocument(supplier.documentType, supplier.documentNumber)}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contacto',
      render: (supplier) => (
        <span className="entity-cell__stack">
          <span>{supplier.phone}</span>
          {supplier.contactName && <span className="entity-cell__detail">{supplier.contactName}</span>}
        </span>
      ),
    },
    { key: 'city', header: 'Ciudad', render: (supplier) => supplier.city || '—' },
    { key: 'terms', header: 'Plazo', render: (supplier) => (supplier.paymentTermDays > 0 ? `${supplier.paymentTermDays} días` : 'Contado') },
    { key: 'products', header: 'Productos', render: (supplier) => supplier.productCount },
    {
      key: 'status',
      header: 'Estado',
      render: (supplier) => <Badge tone={supplier.isActive ? 'success' : 'neutral'}>{supplier.isActive ? 'Activo' : 'Inactivo'}</Badge>,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: 'Acciones',
            align: 'end',
            render: (supplier) => (
              <div className="row-actions">
                <IconButton icon={Pencil} label={`Editar ${supplier.legalName}`} onClick={() => setEditing(supplier)} />
                <IconButton
                  icon={Power}
                  tone={supplier.isActive ? 'danger' : 'success'}
                  label={supplier.isActive ? `Desactivar ${supplier.legalName}` : `Activar ${supplier.legalName}`}
                  onClick={() => setToToggle(supplier)}
                />
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        description="Empresas y personas que le venden al negocio. Cada producto puede tener varios, con uno principal."
        actions={
          canManage && (
            <Button icon={Truck} onClick={() => setEditing('new')}>
              Nuevo proveedor
            </Button>
          )
        }
      />

      <FilterBar>
        <TextField label="Buscar" icon={Search} type="search" placeholder="Razón social, nombre comercial, NIT o asesor" value={search} onChange={resetPage(setSearch)} />
        <SelectField label="Estado" placeholder="Todos" options={STATUS_OPTIONS} value={isActive} onChange={resetPage(setIsActive)} />
      </FilterBar>

      <DataTable
        caption="Proveedores"
        columns={columns}
        rows={data?.rows ?? []}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle="No hay proveedores con estos filtros"
        emptyDescription={canManage ? 'Registra el primero con "Nuevo proveedor".' : undefined}
      />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="proveedores" />

      {editing && (
        <SupplierFormModal
          supplier={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isEdit) => {
            setEditing(null)
            toast.success(isEdit ? `${saved.legalName} actualizado` : `${saved.legalName} registrado`)
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(toToggle)}
        tone={toToggle?.isActive ? 'danger' : 'primary'}
        title={toToggle?.isActive ? 'Desactivar proveedor' : 'Activar proveedor'}
        message={
          toToggle?.isActive
            ? `${toToggle.legalName} no se podrá asociar a productos nuevos ni usar en compras. Su historial se conserva.`
            : `${toToggle?.legalName} volverá a estar disponible.`
        }
        confirmLabel={toToggle?.isActive ? 'Desactivar' : 'Activar'}
        isLoading={toggleState.isLoading}
        onConfirm={handleToggle}
        onCancel={() => setToToggle(null)}
      />
    </>
  )
}
