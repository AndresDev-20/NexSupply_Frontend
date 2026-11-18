import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import { Headset, KeyRound, Pencil, Power, Search, Trash2, UserPlus } from 'lucide-react'
import {
  useDeleteUserMutation,
  useGetBranchesQuery,
  useGetRolesQuery,
  useGetUsersQuery,
  useResetUserPasswordMutation,
  useSetUserActiveMutation,
} from '../adminApi'
import { formatDocument } from '../../../utils/identityDocument'
import { selectCurrentUser } from '../../auth/authSlice'
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
import { formatDateTime } from '../../../utils/format'
import { UserFormModal } from './UserFormModal'
import { TemporaryPasswordModal } from './TemporaryPasswordModal'
import '../admin.css'

const STATUS_OPTIONS = [
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
]

/** Textos y tono de la confirmación según la acción. */
function confirmCopy(confirm) {
  if (!confirm) return { title: '', message: '' }
  const { type, user } = confirm
  if (type === 'delete') {
    return {
      tone: 'danger',
      title: 'Eliminar usuario definitivamente',
      message: (
        <>
          Se eliminará a <strong>{user.fullName}</strong> junto con <strong>todo su historial</strong>. Esta acción no se
          puede deshacer. Si solo quieres impedir que ingrese, desactívalo.
        </>
      ),
      confirmLabel: 'Eliminar definitivamente',
    }
  }
  if (type === 'reset') {
    return {
      tone: 'primary',
      title: 'Restablecer contraseña',
      message: `Se generará una contraseña temporal para ${user.fullName} y se cerrarán todas sus sesiones.`,
      confirmLabel: 'Generar contraseña',
    }
  }
  return user.isActive
    ? {
        tone: 'danger',
        title: 'Desactivar usuario',
        message: `${user.fullName} no podrá iniciar sesión y se cerrarán sus sesiones abiertas. Su historial se conserva.`,
        confirmLabel: 'Desactivar',
      }
    : { tone: 'primary', title: 'Activar usuario', message: `${user.fullName} podrá volver a iniciar sesión.`, confirmLabel: 'Activar' }
}

function initialsOf(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase() || '?'
}

export default function UsersPage() {
  const toast = useToast()
  const currentUser = useSelector(selectCurrentUser)
  const isDeveloper = currentUser?.role?.systemRole === 'developer'
  const can = {
    create: useCan('users.create'),
    update: useCan('users.update'),
    deactivate: useCan('users.deactivate'),
    resetPassword: useCan('users.reset_password'),
    // Exclusivo de Administrador y Soporte Nexoon (D-ADM-9)
    remove: useCan('users.delete'),
    // Para llenar las listas del formulario
    viewRoles: useCan('roles.view'),
    viewBranches: useCan('branches.view'),
  }

  const [search, setSearch] = useState('')
  const [searchParams] = useSearchParams()
  const [roleId, setRoleId] = useState('')
  // Filtro por sucursal (Fase 17): quienes entran a esa sucursal; también llega desde Sucursales (?branchId=)
  const [branchId, setBranchId] = useState(() => searchParams.get('branchId') ?? '')
  const [isActive, setIsActive] = useState('true')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search.trim())

  const params = { page, pageSize: 20, ...(debouncedSearch && { search: debouncedSearch }), ...(roleId && { roleId }), ...(branchId && { branchId }), ...(isActive && { isActive }) }
  const { data, error, isFetching, refetch } = useGetUsersQuery(params)
  const { data: roles = [] } = useGetRolesQuery(undefined, { skip: !can.viewRoles })
  const { data: branchData } = useGetBranchesQuery({ isActive: 'true' }, { skip: !can.viewBranches })
  const branches = branchData?.branches ?? []

  // El rol de Soporte Nexoon solo lo puede asignar otro developer
  const assignableRoles = roles.filter((role) => role.systemRole !== 'developer' || isDeveloper)

  const [editing, setEditing] = useState(null) // null | 'new' | usuario
  const [createdResult, setCreatedResult] = useState(null)
  const [confirm, setConfirm] = useState(null) // { type: 'toggle' | 'reset', user }
  const [setUserActive, toggleState] = useSetUserActiveMutation()
  const [resetUserPassword, resetState] = useResetUserPasswordMutation()
  const [deleteUser, deleteState] = useDeleteUserMutation()

  const resetToFirstPage = (setter) => (event) => {
    setter(event.target.value)
    setPage(1)
  }

  const isLocked = (user) => user.isSupportAccount && !isDeveloper
  const isSelf = (user) => user.id === currentUser?.id

  const handleConfirm = async () => {
    const { type, user } = confirm
    try {
      if (type === 'delete') {
        await deleteUser(user.id).unwrap()
        toast.success(`${user.fullName} fue eliminado definitivamente`)
        setConfirm(null)
      } else if (type === 'toggle') {
        await setUserActive({ id: user.id, active: !user.isActive }).unwrap()
        toast.success(user.isActive ? `${user.fullName} fue desactivado` : `${user.fullName} fue activado`)
        setConfirm(null)
      } else {
        const result = await resetUserPassword(user.id).unwrap()
        setConfirm(null)
        setCreatedResult(result)
      }
    } catch (actionError) {
      setConfirm(null)
      toast.error(actionError.message)
    }
  }

  const columns = [
    {
      key: 'user',
      header: 'Usuario',
      primary: true,
      render: (user) => (
        <div className="person">
          <span className={`person__avatar${user.isSupportAccount ? ' person__avatar--support' : ''}`} aria-hidden="true">
            {user.isSupportAccount ? <Headset size={18} /> : initialsOf(user.fullName)}
          </span>
          <span className="person__text">
            <span className="person__name">{user.fullName}</span>
            <span className="person__detail">
              @{user.username}
              {user.documentNumber && <span>· {formatDocument(user.documentType, user.documentNumber)}</span>}
              {isSelf(user) && <Badge tone="info">Tú</Badge>}
              {user.isSupportAccount && <Badge tone="accent">Soporte Nexoon</Badge>}
              {user.mustChangePassword && <Badge tone="warning">Debe cambiar contraseña</Badge>}
            </span>
          </span>
        </div>
      ),
    },
    { key: 'role', header: 'Rol', render: (user) => user.role?.name ?? '—' },
    {
      key: 'branch',
      header: 'Sucursal',
      render: (user) => (
        <span className="person__detail">
          {user.branch?.name ?? '—'}
          {branches.length > 1 && user.accessToAllBranches && <Badge tone="info">Todas</Badge>}
          {branches.length > 1 && !user.accessToAllBranches && (user.branches?.length ?? 0) > 1 && (
            <span title={user.branches.map((branch) => branch.name).join(', ')}>
              <Badge tone="neutral">+{user.branches.length - 1}</Badge>
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (user) => <Badge tone={user.isActive ? 'success' : 'neutral'}>{user.isActive ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      key: 'lastLogin',
      header: 'Último ingreso',
      render: (user) => (user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Nunca'),
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (user) => (
        <div className="row-actions">
          {can.update && (
            <IconButton icon={Pencil} label={`Editar a ${user.fullName}`} disabled={isLocked(user)} onClick={() => setEditing(user)} />
          )}
          {can.resetPassword && (
            <IconButton
              icon={KeyRound}
              label={`Restablecer la contraseña de ${user.fullName}`}
              disabled={isLocked(user) || isSelf(user) || !user.isActive}
              onClick={() => setConfirm({ type: 'reset', user })}
            />
          )}
          {can.deactivate && (
            <IconButton
              icon={Power}
              tone={user.isActive ? 'danger' : 'success'}
              label={user.isActive ? `Desactivar a ${user.fullName}` : `Activar a ${user.fullName}`}
              disabled={isLocked(user) || isSelf(user)}
              onClick={() => setConfirm({ type: 'toggle', user })}
            />
          )}
          {can.remove && (
            <IconButton
              icon={Trash2}
              tone="danger"
              label={`Eliminar a ${user.fullName}`}
              disabled={isLocked(user) || isSelf(user)}
              onClick={() => setConfirm({ type: 'delete', user })}
            />
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        description="Personas que usan el sistema. Cada una tiene un rol, que define lo que puede ver y hacer."
        actions={
          can.create && (
            <Button icon={UserPlus} onClick={() => setEditing('new')}>
              Nuevo usuario
            </Button>
          )
        }
      />

      <FilterBar>
        <TextField
          label="Buscar"
          icon={Search}
          type="search"
          placeholder="Nombre, usuario, documento o correo"
          value={search}
          onChange={resetToFirstPage(setSearch)}
        />
        {can.viewRoles && (
          <SelectField
            label="Rol"
            placeholder="Todos los roles"
            options={roles.map((role) => ({ value: String(role.id), label: role.name }))}
            value={roleId}
            onChange={resetToFirstPage(setRoleId)}
          />
        )}
        {can.viewBranches && branches.length > 1 && (
          <SelectField
            label="Sucursal"
            placeholder="Todas las sucursales"
            options={branches.map((branch) => ({ value: String(branch.id), label: branch.name }))}
            value={branchId}
            onChange={resetToFirstPage(setBranchId)}
          />
        )}
        <SelectField label="Estado" placeholder="Todos" options={STATUS_OPTIONS} value={isActive} onChange={resetToFirstPage(setIsActive)} />
      </FilterBar>

      <DataTable
        caption="Usuarios"
        columns={columns}
        rows={data?.rows ?? []}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle="No hay usuarios con estos filtros"
        emptyDescription="Prueba con otra búsqueda o cambia el estado."
      />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="usuarios" />

      {editing && (
        <UserFormModal
          user={editing === 'new' ? null : editing}
          roles={assignableRoles}
          branches={branches}
          isSelf={editing !== 'new' && isSelf(editing)}
          onClose={() => setEditing(null)}
          onCreated={(result) => {
            setEditing(null)
            setCreatedResult(result)
            toast.success(`Usuario ${result.user.username} creado`)
          }}
          onUpdated={(user) => {
            setEditing(null)
            toast.success(`Cambios guardados para ${user.fullName}`)
          }}
        />
      )}

      <TemporaryPasswordModal result={createdResult} onClose={() => setCreatedResult(null)} />

      <ConfirmDialog
        isOpen={Boolean(confirm)}
        {...confirmCopy(confirm)}
        isLoading={toggleState.isLoading || resetState.isLoading || deleteState.isLoading}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}
