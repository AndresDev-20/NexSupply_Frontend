import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgePercent, Eye, Pencil, Plus, Power } from 'lucide-react'
import { useGetPriceListsQuery, useSetPriceListActiveMutation } from './priceListsApi'
import { PriceListFormModal } from './PriceListFormModal'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Badge } from '../../../components/ui/Badge/Badge'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { priceListPath } from '../../../routes/paths'
import '../../admin/admin.css'
import '../../settings/settings.css'
import './priceLists.css'

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

/** /clientes/listas-de-precios — Precios por tipo de cliente (D-PRE-1). */
export default function PriceListsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { data: lists = [], error, isFetching, refetch } = useGetPriceListsQuery()
  const [setActive, toggleState] = useSetPriceListActiveMutation()
  const [editing, setEditing] = useState(null) // null | 'new' | lista
  const [toToggle, setToToggle] = useState(null)

  const handleToggle = async () => {
    try {
      const updated = await setActive({ id: toToggle.id, active: !toToggle.isActive }).unwrap()
      toast.success(updated.isActive ? `${updated.name} fue activada` : `${updated.name} fue desactivada`)
    } catch (toggleError) {
      toast.error(toggleError.message)
    }
    setToToggle(null)
  }

  const columns = [
    {
      key: 'name',
      header: 'Lista',
      primary: true,
      render: (list) => (
        <div className="catalog-cell">
          <span className="catalog-cell__icon" aria-hidden="true">
            <BadgePercent size={16} />
          </span>
          <span className="catalog-cell__name">{list.name}</span>
        </div>
      ),
    },
    {
      key: 'percent',
      header: 'Precio',
      render: (list) => (Number(list.discountPercent) > 0 ? `${String(Number(list.discountPercent)).replace('.', ',')} % menos` : 'Solo precios especiales'),
    },
    { key: 'items', header: 'Precios especiales', render: (list) => (list.itemsCount ? plural(list.itemsCount, 'producto', 'productos') : '—') },
    { key: 'customers', header: 'Clientes', render: (list) => (list.customersCount ? plural(list.customersCount, 'cliente', 'clientes') : '—') },
    { key: 'status', header: 'Estado', render: (list) => <Badge tone={list.isActive ? 'success' : 'neutral'}>{list.isActive ? 'Activa' : 'Inactiva'}</Badge> },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (list) => (
        <div className="row-actions">
          <IconButton icon={Eye} label={`Ver precios de ${list.name}`} onClick={() => navigate(priceListPath(list.id))} />
          <IconButton icon={Pencil} label={`Editar ${list.name}`} onClick={() => setEditing(list)} />
          <IconButton icon={Power} tone={list.isActive ? 'danger' : 'success'} label={list.isActive ? `Desactivar ${list.name}` : `Activar ${list.name}`} onClick={() => setToToggle(list)} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        description="Precios para cada tipo de cliente. Cada lista tiene un % menos que el precio normal y, si quieres, precios especiales por producto. Al escoger el cliente en el punto de venta, salen sus precios."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Nueva lista
          </Button>
        }
      />

      <DataTable
        caption="Listas de precios"
        columns={columns}
        rows={lists}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle="Aún no hay listas de precios"
        emptyDescription='Crea la primera con "Nueva lista" (por ejemplo, Mayorista) y asígnala a tus clientes desde su ficha.'
      />

      {editing && (
        <PriceListFormModal
          priceList={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isEdit) => {
            setEditing(null)
            toast.success(isEdit ? `${saved.name} actualizada` : `Lista ${saved.name} creada`)
            if (!isEdit) navigate(priceListPath(saved.id))
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(toToggle)}
        tone={toToggle?.isActive ? 'danger' : 'primary'}
        title={toToggle?.isActive ? 'Desactivar lista de precios' : 'Activar lista de precios'}
        message={
          toToggle?.isActive
            ? `Mientras ${toToggle.name} esté desactivada, sus clientes pagan el precio normal. Las ventas anteriores no cambian.`
            : `Los clientes de ${toToggle?.name} vuelven a tener sus precios.`
        }
        confirmLabel={toToggle?.isActive ? 'Desactivar' : 'Activar'}
        isLoading={toggleState.isLoading}
        onConfirm={handleToggle}
        onCancel={() => setToToggle(null)}
      />
    </>
  )
}
