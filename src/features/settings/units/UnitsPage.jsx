import { useState } from 'react'
import { Pencil, Plus, Power, Ruler } from 'lucide-react'
import { useGetUnitsQuery, useSetUnitActiveMutation } from '../settingsApi'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Badge } from '../../../components/ui/Badge/Badge'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { UnitFormModal } from './UnitFormModal'
import '../../admin/admin.css'
import '../settings.css'

/** Unidades de medida (D11, D-CFG-5). Pantalla para quien tiene units.manage. */
export default function UnitsPage() {
  const toast = useToast()
  const { data: units = [], error, isFetching, refetch } = useGetUnitsQuery({ includeInactive: true })
  const [setActive, toggleState] = useSetUnitActiveMutation()
  const [editing, setEditing] = useState(null) // null | 'new' | unidad
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
      header: 'Unidad',
      primary: true,
      render: (unit) => (
        <div className="catalog-cell">
          <span className="catalog-cell__icon" aria-hidden="true">
            <Ruler size={16} />
          </span>
          <span className="catalog-cell__name">
            {unit.name} <span className="catalog-cell__symbol">{unit.symbol}</span>
          </span>
        </div>
      ),
    },
    {
      key: 'decimals',
      header: 'Cantidades',
      render: (unit) => (unit.allowsDecimals ? 'Admite decimales' : 'Solo enteros'),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (unit) => <Badge tone={unit.isActive ? 'success' : 'neutral'}>{unit.isActive ? 'Activa' : 'Inactiva'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (unit) => (
        <div className="row-actions">
          <IconButton icon={Pencil} label={`Editar ${unit.name}`} onClick={() => setEditing(unit)} />
          <IconButton
            icon={Power}
            tone={unit.isActive ? 'danger' : 'success'}
            label={unit.isActive ? `Desactivar ${unit.name}` : `Activar ${unit.name}`}
            onClick={() => setToToggle(unit)}
          />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        description="Unidades en que se miden y venden los productos. Un bulto o una caja se configuran después como presentaciones del producto."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Nueva unidad
          </Button>
        }
      />

      <DataTable caption="Unidades de medida" columns={columns} rows={units} isLoading={isFetching} error={error} onRetry={refetch} emptyTitle="No hay unidades" />

      {editing && (
        <UnitFormModal
          unit={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isEdit) => {
            setEditing(null)
            toast.success(isEdit ? `${saved.name} actualizada` : `${saved.name} creada`)
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(toToggle)}
        tone={toToggle?.isActive ? 'danger' : 'primary'}
        title={toToggle?.isActive ? 'Desactivar unidad' : 'Activar unidad'}
        message={
          toToggle?.isActive
            ? `${toToggle.name} no se ofrecerá para productos nuevos. Los productos que ya la usan la conservan.`
            : `${toToggle?.name} volverá a estar disponible para los productos.`
        }
        confirmLabel={toToggle?.isActive ? 'Desactivar' : 'Activar'}
        isLoading={toggleState.isLoading}
        onConfirm={handleToggle}
        onCancel={() => setToToggle(null)}
      />
    </>
  )
}
