import { useState } from 'react'
import { Eye, ListChecks, Lock, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react'
import { useDeleteRoleMutation, useGetRolesQuery } from '../adminApi'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Badge } from '../../../components/ui/Badge/Badge'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { RoleFormModal } from './RoleFormModal'
import '../admin.css'
import './RolesPage.css'

export default function RolesPage() {
  const toast = useToast()
  const canCreate = useCan('roles.create')
  const canUpdate = useCan('roles.update')
  const canDelete = useCan('roles.delete')
  const { data: roles = [], error, isFetching, refetch } = useGetRolesQuery()
  const [deleteRole, deleteState] = useDeleteRoleMutation()
  const [editing, setEditing] = useState(null) // null | 'new' | { role, step }
  const [toDelete, setToDelete] = useState(null)

  const handleDelete = async () => {
    try {
      await deleteRole(toDelete.id).unwrap()
      toast.success(`Rol "${toDelete.name}" eliminado`)
    } catch (deleteError) {
      toast.error(deleteError.message)
    }
    setToDelete(null)
  }

  const columns = [
    {
      key: 'name',
      header: 'Rol',
      primary: true,
      render: (role) => (
        <div className="role-cell">
          <span className={`role-cell__icon${role.isSystemRole ? ' role-cell__icon--system' : ''}`} aria-hidden="true">
            {role.isSystemRole ? <Lock size={16} /> : <ShieldCheck size={16} />}
          </span>
          <span className="role-cell__text">
            <span className="role-cell__name">
              {role.name} {role.isSystemRole && <Badge tone="accent">Del sistema</Badge>}
            </span>
            {role.description && <span className="role-cell__description">{role.description}</span>}
          </span>
        </div>
      ),
    },
    {
      key: 'permissions',
      header: 'Permisos',
      render: (role) => (role.isSystemRole ? 'Todos (automáticos)' : `${role.permissions.length} permiso${role.permissions.length === 1 ? '' : 's'}`),
    },
    {
      key: 'users',
      header: 'Usuarios',
      render: (role) => (
        <span className="role-cell__users">
          <Users size={14} aria-hidden="true" /> {role.userCount}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (role) => (
        <div className="row-actions">
          {role.isSystemRole || !canUpdate ? (
            <IconButton icon={Eye} label={`Ver permisos de ${role.name}`} onClick={() => setEditing({ role, step: 1 })} />
          ) : (
            <>
              {/* Acceso directo al paso de permisos, sin pasar por "Editar" */}
              <Button variant="secondary" size="sm" icon={ListChecks} onClick={() => setEditing({ role, step: 1 })} aria-label={`Asignar permisos a ${role.name}`}>
                Asignar permisos
              </Button>
              <IconButton icon={Pencil} label={`Editar ${role.name}`} onClick={() => setEditing({ role, step: 0 })} />
            </>
          )}
          {canDelete && !role.isSystemRole && (
            <IconButton
              icon={Trash2}
              tone="danger"
              label={role.userCount > 0 ? `${role.name} tiene usuarios: no se puede eliminar` : `Eliminar ${role.name}`}
              disabled={role.userCount > 0}
              onClick={() => setToDelete(role)}
            />
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        description="Un rol agrupa permisos. Asigna a cada persona el rol que corresponde a su trabajo."
        actions={
          canCreate && (
            <Button icon={Plus} onClick={() => setEditing('new')}>
              Nuevo rol
            </Button>
          )
        }
      />

      <DataTable caption="Roles" columns={columns} rows={roles} isLoading={isFetching} error={error} onRetry={refetch} emptyTitle="No hay roles" />

      {editing && (
        <RoleFormModal
          role={editing === 'new' ? null : editing.role}
          initialStep={editing === 'new' ? 0 : editing.step}
          readOnly={editing !== 'new' && !canUpdate}
          onClose={() => setEditing(null)}
          onSaved={(role, isEdit) => {
            setEditing(null)
            toast.success(isEdit ? `Rol "${role.name}" actualizado` : `Rol "${role.name}" creado`)
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(toDelete)}
        tone="danger"
        title="Eliminar rol"
        message={`¿Eliminar el rol "${toDelete?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        isLoading={deleteState.isLoading}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}
