import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Truck, UserPlus } from 'lucide-react'
import { useGetPortersQuery } from './portersApi'
import { PorterFormModal } from './PorterModals'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Button } from '../../../components/ui/Button/Button'
import { Badge } from '../../../components/ui/Badge/Badge'
import { formatCurrency } from '../../../utils/format'
import { porterPath } from '../../../routes/paths'
import '../../admin/admin.css'

/** /ventas/conductores — Conductores del carro de línea y sus fletes (D-FLE-1). */
export default function PortersPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const canManage = useCan('porters.manage')
  const [showInactive, setShowInactive] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const { data: porters = [], error, isFetching, refetch } = useGetPortersQuery(showInactive ? {} : { isActive: 'true' })

  const columns = [
    {
      key: 'name',
      header: 'Conductor',
      primary: true,
      render: (row) => (
        <span className="catalog-cell">
          <span className="catalog-cell__icon" aria-hidden="true">
            <Truck size={16} />
          </span>
          <span className="catalog-cell__name">
            {row.name} {!row.isActive && <Badge tone="neutral">Inactivo</Badge>}
          </span>
        </span>
      ),
    },
    { key: 'phone', header: 'Celular', render: (row) => row.phone ?? '—' },
    { key: 'rate', header: 'Flete propuesto', align: 'end', render: (row) => (Number(row.tripRate) > 0 ? formatCurrency(row.tripRate) : '—') },
    { key: 'freights', header: 'Fletes', align: 'end', render: (row) => row.freights || '—' },
    { key: 'total', header: 'Pagado en fletes', align: 'end', render: (row) => <strong className="numeric">{formatCurrency(row.freightTotal)}</strong> },
    { key: 'actions', header: 'Acciones', align: 'end', render: (row) => <IconButton icon={Eye} label={`Ver ${row.name}`} onClick={() => navigate(porterPath(row.id))} /> },
  ]

  return (
    <>
      <PageHeader
        description="Quienes llevan la mercancía en el carro de línea de la vereda. El flete se agrega en la venta: va en la factura del cliente y el pasaje sale de la caja al conductor."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowInactive((value) => !value)}>
              {showInactive ? 'Solo activos' : 'Ver inactivos'}
            </Button>
            {canManage && (
              <Button icon={UserPlus} onClick={() => setIsCreating(true)}>
                Nuevo conductor
              </Button>
            )}
          </>
        }
      />
      <DataTable
        caption="Conductores"
        columns={columns}
        rows={porters}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle="Aún no hay conductores"
        emptyDescription={canManage ? 'Registra el primero con "Nuevo conductor".' : undefined}
      />
      {isCreating && (
        <PorterFormModal
          onClose={() => setIsCreating(false)}
          onSaved={(saved) => {
            setIsCreating(false)
            toast.success(`${saved.name} quedó registrado`)
            navigate(porterPath(saved.id))
          }}
        />
      )}
    </>
  )
}
