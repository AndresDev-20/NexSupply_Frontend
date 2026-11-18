import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Power, Store, Users } from 'lucide-react'
import { useGetBranchesQuery, useSetBranchActiveMutation } from '../adminApi'
import { selectActiveBranchId, selectPlan } from '../../auth/authSlice'
import { ROUTES } from '../../../routes/paths'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Badge } from '../../../components/ui/Badge/Badge'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { BranchFormModal } from './BranchFormModal'
import '../admin.css'
import './BranchesPage.css'

export default function BranchesPage() {
  const toast = useToast()
  const plan = useSelector(selectPlan)
  const canCreate = useCan('branches.create')
  const canUpdate = useCan('branches.update')
  const canToggle = useCan('branches.deactivate')
  const canViewUsers = useCan('users.view')
  // Sucursal en la que se trabaja ahora (Fase 17)
  const activeBranchId = useSelector(selectActiveBranchId)
  const { data, error, isFetching, refetch } = useGetBranchesQuery()
  const [setBranchActive, toggleState] = useSetBranchActiveMutation()
  const [editing, setEditing] = useState(null)
  const [toToggle, setToToggle] = useState(null)

  const branches = data?.branches ?? []
  const limit = data?.limit ?? null
  const atLimit = limit !== null && (data?.total ?? 0) >= limit

  const handleToggle = async () => {
    try {
      const updated = await setBranchActive({ id: toToggle.id, active: !toToggle.isActive }).unwrap()
      toast.success(updated.isActive ? `${updated.name} fue activada` : `${updated.name} fue desactivada`)
    } catch (toggleError) {
      toast.error(toggleError.message)
    }
    setToToggle(null)
  }

  const columns = [
    {
      key: 'name',
      header: 'Sucursal',
      primary: true,
      render: (branch) => (
        <div className="branch-cell">
          <span className="branch-cell__icon" aria-hidden="true">
            <Store size={16} />
          </span>
          <span className="branch-cell__text">
            <span className="branch-cell__name">
              {branch.name} {branches.length > 1 && branch.id === activeBranchId && <Badge tone="accent">Estás aquí</Badge>}
            </span>
            <span className="branch-cell__code">{branch.code}</span>
          </span>
        </div>
      ),
    },
    { key: 'address', header: 'Dirección', render: (branch) => branch.address || '—' },
    { key: 'phone', header: 'Teléfono', render: (branch) => branch.phone || '—' },
    {
      key: 'status',
      header: 'Estado',
      render: (branch) => <Badge tone={branch.isActive ? 'success' : 'neutral'}>{branch.isActive ? 'Activa' : 'Inactiva'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (branch) => (
        <div className="row-actions">
          {canViewUsers && branches.length > 1 && (
            <Link
              className="icon-button icon-button--neutral"
              to={`${ROUTES.users}?branchId=${branch.id}`}
              aria-label={`Ver quiénes trabajan en ${branch.name}`}
              title={`Ver quiénes trabajan en ${branch.name}`}
            >
              <Users className="icon-button__icon" aria-hidden="true" />
            </Link>
          )}
          {canUpdate && <IconButton icon={Pencil} label={`Editar ${branch.name}`} onClick={() => setEditing(branch)} />}
          {canToggle && (
            <IconButton
              icon={Power}
              tone={branch.isActive ? 'danger' : 'success'}
              label={branch.isActive ? `Desactivar ${branch.name}` : `Activar ${branch.name}`}
              onClick={() => setToToggle(branch)}
            />
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        description={
          branches.length > 1
            ? 'Lugares donde opera el negocio. Cada usuario entra a las sucursales que tenga asignadas y cambia entre ellas desde la barra superior.'
            : 'Lugares donde opera el negocio. Cada usuario trabaja en una sucursal.'
        }
        actions={
          canCreate && (
            <Button icon={Plus} onClick={() => setEditing('new')} disabled={atLimit}>
              Nueva sucursal
            </Button>
          )
        }
      >
        {limit !== null && (
          <p className="branches-usage">
            <span className="branches-usage__count">
              {data?.total ?? 0} de {limit}
            </span>{' '}
            sucursal{limit === 1 ? '' : 'es'} en el plan {plan?.name ?? 'contratado'}
          </p>
        )}
      </PageHeader>

      {atLimit && canCreate && (
        <div className="branches-page__notice">
          <Alert tone="info" title="Límite del plan alcanzado">
            Tu plan {plan?.name ?? 'contratado'} permite {limit} sucursal{limit === 1 ? '' : 'es'}. Para agregar más, contacta a Nexoon.
          </Alert>
        </div>
      )}

      <DataTable caption="Sucursales" columns={columns} rows={branches} isLoading={isFetching} error={error} onRetry={refetch} emptyTitle="No hay sucursales" />

      {editing && (
        <BranchFormModal
          branch={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(branch, isEdit) => {
            setEditing(null)
            toast.success(isEdit ? `${branch.name} actualizada` : `${branch.name} creada`)
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(toToggle)}
        tone={toToggle?.isActive ? 'danger' : 'primary'}
        title={toToggle?.isActive ? 'Desactivar sucursal' : 'Activar sucursal'}
        message={
          toToggle?.isActive
            ? `¿Desactivar ${toToggle.name}? No se podrá desactivar si es la única activa o si es la sucursal principal de usuarios activos. Nadie podrá seguir trabajando en ella.`
            : `¿Activar ${toToggle?.name}?`
        }
        confirmLabel={toToggle?.isActive ? 'Desactivar' : 'Activar'}
        isLoading={toggleState.isLoading}
        onConfirm={handleToggle}
        onCancel={() => setToToggle(null)}
      />
    </>
  )
}
