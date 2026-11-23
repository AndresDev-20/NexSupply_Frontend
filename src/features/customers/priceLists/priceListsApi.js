// Listas de precios por tipo de cliente (D-PRE-1).
import { baseApi } from '../../../api/baseApi'

const paginated = (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null })

// Cambiar una lista cambia lo que ven los clientes y los precios del punto de venta
const AFTER_CHANGE = (id) => [{ type: 'PriceList', id: 'LIST' }, { type: 'PriceList', id }, 'Customer', 'Audit']

export const priceListsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPriceLists: build.query({
      query: (params) => ({ url: '/price-lists', params }),
      providesTags: [{ type: 'PriceList', id: 'LIST' }],
    }),
    getPriceList: build.query({
      query: (id) => ({ url: `/price-lists/${id}` }),
      providesTags: (result, error, id) => [{ type: 'PriceList', id: Number(id) }],
    }),
    getPriceListProducts: build.query({
      query: ({ id, ...params }) => ({ url: `/price-lists/${id}/products`, params }),
      transformResponse: paginated,
      providesTags: (result, error, { id }) => [{ type: 'PriceList', id: Number(id) }],
    }),
    createPriceList: build.mutation({
      query: (body) => ({ url: '/price-lists', method: 'POST', data: body }),
      invalidatesTags: [{ type: 'PriceList', id: 'LIST' }, 'Audit'],
    }),
    updatePriceList: build.mutation({
      query: ({ id, ...body }) => ({ url: `/price-lists/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: (result, error, { id }) => AFTER_CHANGE(id),
    }),
    setPriceListActive: build.mutation({
      query: ({ id, active }) => ({ url: `/price-lists/${id}/${active ? 'activate' : 'deactivate'}`, method: 'POST' }),
      invalidatesTags: (result, error, { id }) => AFTER_CHANGE(id),
    }),
    setPriceListItem: build.mutation({
      query: ({ id, ...body }) => ({ url: `/price-lists/${id}/items`, method: 'PUT', data: body }),
      invalidatesTags: (result, error, { id }) => AFTER_CHANGE(id),
    }),
    removePriceListItem: build.mutation({
      query: ({ id, itemId }) => ({ url: `/price-lists/${id}/items/${itemId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { id }) => AFTER_CHANGE(id),
    }),
  }),
})

export const {
  useGetPriceListsQuery,
  useGetPriceListQuery,
  useGetPriceListProductsQuery,
  useCreatePriceListMutation,
  useUpdatePriceListMutation,
  useSetPriceListActiveMutation,
  useSetPriceListItemMutation,
  useRemovePriceListItemMutation,
} = priceListsApi
