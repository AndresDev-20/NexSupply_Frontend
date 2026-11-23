// Coteros (D-CTR-1): viajes al carro de línea y sus pagos.
import { baseApi } from '../../../api/baseApi'

const withMessage = (data, meta) => ({ ...data, message: meta?.message ?? null })

export const portersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPorters: build.query({
      query: (params) => ({ url: '/porters', params }),
      providesTags: [{ type: 'Porter', id: 'LIST' }],
    }),
    getPorter: build.query({
      query: (id) => ({ url: `/porters/${id}` }),
      providesTags: (result, error, id) => [{ type: 'Porter', id: Number(id) }],
    }),
    createPorter: build.mutation({
      query: (body) => ({ url: '/porters', method: 'POST', data: body }),
      invalidatesTags: [{ type: 'Porter', id: 'LIST' }, 'Audit'],
    }),
    updatePorter: build.mutation({
      query: ({ id, ...body }) => ({ url: `/porters/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Porter', id: 'LIST' }, { type: 'Porter', id }, 'Audit'],
    }),
    setPorterActive: build.mutation({
      query: ({ id, active }) => ({ url: `/porters/${id}/${active ? 'activate' : 'deactivate'}`, method: 'POST' }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Porter', id: 'LIST' }, { type: 'Porter', id }, 'Audit'],
    }),
    addPorterTrip: build.mutation({
      query: ({ porterId, ...body }) => ({ url: `/porters/${porterId}/trips`, method: 'POST', data: body }),
      transformResponse: withMessage,
      invalidatesTags: (result, error, { porterId }) => [{ type: 'Porter', id: 'LIST' }, { type: 'Porter', id: porterId }, 'Audit'],
    }),
    cancelPorterTrip: build.mutation({
      query: ({ tripId, reason }) => ({ url: `/porter-trips/${tripId}/cancel`, method: 'POST', data: { reason } }),
      invalidatesTags: (result, error, { porterId }) => [{ type: 'Porter', id: 'LIST' }, { type: 'Porter', id: porterId }, 'Audit'],
    }),
    payPorter: build.mutation({
      query: ({ porterId, ...body }) => ({ url: `/porters/${porterId}/payments`, method: 'POST', data: body }),
      transformResponse: withMessage,
      // El pago es un gasto y puede salir de la caja
      invalidatesTags: (result, error, { porterId }) => [{ type: 'Porter', id: 'LIST' }, { type: 'Porter', id: porterId }, 'Expense', 'CashSession', 'CashRegister', 'Audit'],
    }),
  }),
})

export const {
  useGetPortersQuery,
  useGetPorterQuery,
  useCreatePorterMutation,
  useUpdatePorterMutation,
  useSetPorterActiveMutation,
  useAddPorterTripMutation,
  useCancelPorterTripMutation,
  usePayPorterMutation,
} = portersApi
