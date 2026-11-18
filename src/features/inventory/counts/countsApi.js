// Inventario físico por partes (Fase 8, D-INV-15).
import { baseApi } from '../../../api/baseApi'

const paginated = (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null })

// Aplicar cambia existencias: se refrescan productos, kárdex y lotes
const AFTER_APPLY = [{ type: 'Product', id: 'LIST' }, 'Product', 'Movement', 'Batch', 'Audit']

export const countsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getInventoryCounts: build.query({
      query: (params) => ({ url: '/inventory-counts', params }),
      transformResponse: paginated,
      providesTags: [{ type: 'InventoryCount', id: 'LIST' }],
    }),
    getInventoryCount: build.query({
      query: (id) => ({ url: `/inventory-counts/${id}` }),
      providesTags: (result, error, id) => [{ type: 'InventoryCount', id: Number(id) }],
    }),
    getInventoryCountItems: build.query({
      query: ({ id, ...params }) => ({ url: `/inventory-counts/${id}/items`, params }),
      transformResponse: paginated,
      providesTags: (result, error, { id }) => [{ type: 'InventoryCount', id: `ITEMS-${id}` }],
    }),
    openInventoryCount: build.mutation({
      query: (body) => ({ url: '/inventory-counts', method: 'POST', data: body }),
      invalidatesTags: [{ type: 'InventoryCount', id: 'LIST' }, 'Audit'],
    }),
    setInventoryCountItem: build.mutation({
      query: ({ id, productId, ...body }) => ({ url: `/inventory-counts/${id}/items/${productId}`, method: 'PUT', data: body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'InventoryCount', id: Number(id) }, { type: 'InventoryCount', id: `ITEMS-${id}` }],
    }),
    removeInventoryCountItem: build.mutation({
      query: ({ id, productId }) => ({ url: `/inventory-counts/${id}/items/${productId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { id }) => [{ type: 'InventoryCount', id: Number(id) }, { type: 'InventoryCount', id: `ITEMS-${id}` }],
    }),
    applyInventoryCount: build.mutation({
      query: (id) => ({ url: `/inventory-counts/${id}/apply`, method: 'POST' }),
      invalidatesTags: (result, error, id) => [{ type: 'InventoryCount', id: Number(id) }, { type: 'InventoryCount', id: `ITEMS-${id}` }, { type: 'InventoryCount', id: 'LIST' }, ...AFTER_APPLY],
    }),
    cancelInventoryCount: build.mutation({
      query: ({ id, reason }) => ({ url: `/inventory-counts/${id}/cancel`, method: 'POST', data: { reason } }),
      invalidatesTags: (result, error, { id }) => [{ type: 'InventoryCount', id: Number(id) }, { type: 'InventoryCount', id: `ITEMS-${id}` }, { type: 'InventoryCount', id: 'LIST' }, 'Audit'],
    }),
  }),
})

export const {
  useGetInventoryCountsQuery,
  useGetInventoryCountQuery,
  useGetInventoryCountItemsQuery,
  useOpenInventoryCountMutation,
  useSetInventoryCountItemMutation,
  useRemoveInventoryCountItemMutation,
  useApplyInventoryCountMutation,
  useCancelInventoryCountMutation,
} = countsApi
