import { useState } from 'react'
import { Banknote, CreditCard, Pencil, Plus, Power } from 'lucide-react'
import { useGetPaymentMethodsQuery, useSetPaymentMethodActiveMutation } from '../settingsApi'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Badge } from '../../../components/ui/Badge/Badge'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { PaymentMethodFormModal } from './PaymentMethodFormModal'
import '../../admin/admin.css'
import '../settings.css'

/** Métodos de pago (D-CFG-4). Pantalla para quien tiene payment_methods.manage. */
export default function PaymentMethodsPage() {
  const toast = useToast()
  const { data: methods = [], error, isFetching, refetch } = useGetPaymentMethodsQuery({ includeInactive: true })
  const [setActive, toggleState] = useSetPaymentMethodActiveMutation()
  const [editing, setEditing] = useState(null) // null | 'new' | método
  const [toToggle, setToToggle] = useState(null)

  const handleToggle = async () => {
    try {
      const updated = await setActive({ id: toToggle.id, active: !toToggle.isActive }).unwrap()
      toast.success(updated.isActive ? `${updated.name} fue activado` : `${updated.name} fue desactivado`)
    } catch (toggleError) {
      toast.error(toggleError.message)
    }
    setToToggle(null)
  }

  const columns = [
    {
      key: 'name',
      header: 'Método',
      primary: true,
      render: (method) => (
        <div className="catalog-cell">
          <span className={`catalog-cell__icon${method.isCash ? ' catalog-cell__icon--cash' : ''}`} aria-hidden="true">
            {method.isCash ? <Banknote size={16} /> : <CreditCard size={16} />}
          </span>
          <span className="catalog-cell__name">
            {method.name} {method.isCash && <Badge tone="accent">Cuenta en la caja</Badge>}
          </span>
        </div>
      ),
    },
    {
      key: 'reference',
      header: 'Referencia',
      render: (method) => (method.requiresReference ? <Badge tone="info">Pide referencia</Badge> : 'No pide'),
    },
    { key: 'order', header: 'Orden', render: (method) => method.sortOrder },
    {
      key: 'status',
      header: 'Estado',
      render: (method) => <Badge tone={method.isActive ? 'success' : 'neutral'}>{method.isActive ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (method) => (
        <div className="row-actions">
          <IconButton icon={Pencil} label={`Editar ${method.name}`} onClick={() => setEditing(method)} />
          <IconButton
            icon={Power}
            tone={method.isActive ? 'danger' : 'success'}
            label={
              method.isSystem
                ? `${method.name} no se puede desactivar`
                : method.isActive
                  ? `Desactivar ${method.name}`
                  : `Activar ${method.name}`
            }
            disabled={method.isSystem}
            onClick={() => setToToggle(method)}
          />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        description="Formas en que los clientes pueden pagar. Solo el efectivo suma al dinero del cajón; los demás se informan aparte en el cierre de caja."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Nuevo método
          </Button>
        }
      />

      <DataTable
        caption="Métodos de pago"
        columns={columns}
        rows={methods}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle="No hay métodos de pago"
      />

      {editing && (
        <PaymentMethodFormModal
          method={editing === 'new' ? null : editing}
          allMethods={methods}
          onClose={() => setEditing(null)}
          onSaved={(saved, isEdit) => {
            setEditing(null)
            toast.success(isEdit ? `${saved.name} actualizado` : `${saved.name} creado`)
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(toToggle)}
        tone={toToggle?.isActive ? 'danger' : 'primary'}
        title={toToggle?.isActive ? 'Desactivar método de pago' : 'Activar método de pago'}
        message={
          toToggle?.isActive
            ? `${toToggle.name} dejará de aparecer en el punto de venta. Las ventas anteriores lo conservan.`
            : `${toToggle?.name} volverá a aparecer en el punto de venta.`
        }
        confirmLabel={toToggle?.isActive ? 'Desactivar' : 'Activar'}
        isLoading={toggleState.isLoading}
        onConfirm={handleToggle}
        onCancel={() => setToToggle(null)}
      />
    </>
  )
}
