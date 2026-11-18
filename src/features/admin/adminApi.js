// Endpoints de administración: usuarios, roles, permisos, sucursales y auditoría.
// Cada cambio invalida las etiquetas afectadas, así las listas se recargan solas.
import { baseApi } from '../../api/baseApi'

/** Lista paginada: { rows, pagination } a partir del sobre estándar de la API. */
const paginated = (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null })

export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ---------- Usuarios ----------
    getUsers: build.query({
      query: (params) => ({ url: '/users', params }),
      transformResponse: paginated,
      providesTags: ['User'],
    }),
    createUser: build.mutation({
      query: (body) => ({ url: '/users', method: 'POST', data: body }),
      invalidatesTags: ['User', 'Role', 'Audit'],
    }),
    updateUser: build.mutation({
      query: ({ id, ...body }) => ({ url: `/users/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['User', 'Role', 'Audit'],
    }),
    setUserActive: build.mutation({
      query: ({ id, active }) => ({ url: `/users/${id}/${active ? 'activate' : 'deactivate'}`, method: 'POST' }),
      invalidatesTags: ['User', 'Audit'],
    }),
    deleteUser: build.mutation({
      query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
      invalidatesTags: ['User', 'Role', 'Audit'],
    }),
    resetUserPassword: build.mutation({
      query: (id) => ({ url: `/users/${id}/reset-password`, method: 'POST' }),
      invalidatesTags: ['User', 'Audit'],
    }),

    // ---------- Roles y permisos ----------
    getRoles: build.query({
      query: () => ({ url: '/roles' }),
      providesTags: ['Role'],
    }),
    getPermissionCatalog: build.query({
      query: () => ({ url: '/permissions' }),
    }),
    createRole: build.mutation({
      query: (body) => ({ url: '/roles', method: 'POST', data: body }),
      invalidatesTags: ['Role', 'Audit'],
    }),
    updateRole: build.mutation({
      query: ({ id, ...body }) => ({ url: `/roles/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['Role', 'Audit'],
    }),
    deleteRole: build.mutation({
      query: (id) => ({ url: `/roles/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Role', 'Audit'],
    }),

    // ---------- Sucursales ----------
    getBranches: build.query({
      query: (params) => ({ url: '/branches', params }),
      providesTags: ['Branch'],
    }),
    createBranch: build.mutation({
      query: (body) => ({ url: '/branches', method: 'POST', data: body }),
      invalidatesTags: ['Branch', 'Audit'],
    }),
    updateBranch: build.mutation({
      query: ({ id, ...body }) => ({ url: `/branches/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['Branch', 'User', 'Audit'],
    }),
    setBranchActive: build.mutation({
      query: ({ id, active }) => ({ url: `/branches/${id}/${active ? 'activate' : 'deactivate'}`, method: 'POST' }),
      invalidatesTags: ['Branch', 'Audit'],
    }),

    // ---------- Auditoría ----------
    getAuditLogs: build.query({
      query: (params) => ({ url: '/audit-logs', params }),
      transformResponse: paginated,
      providesTags: ['Audit'],
    }),
  }),
})

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useSetUserActiveMutation,
  useResetUserPasswordMutation,
  useDeleteUserMutation,
  useGetRolesQuery,
  useGetPermissionCatalogQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGetBranchesQuery,
  useCreateBranchMutation,
  useUpdateBranchMutation,
  useSetBranchActiveMutation,
  useGetAuditLogsQuery,
} = adminApi
