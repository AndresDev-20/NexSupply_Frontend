// Endpoints de la Fase 10b: apartados y saldo a favor.
import { baseApi } from '../../api/baseApi'

const paginated = (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null, summary: meta?.pagination?.summary ?? null })
const withMessage = (data, meta) => ({ ...data, message: meta?.message ?? null })

// Un apartado reserva existencia y mueve cartera, caja y (al cancelar) el saldo a favor
const AFTER_LAYAWAY = ['Layaway', { type: 'Product', id: 'LIST' }, 'Product', 'Receivable', 'CustomerPayment', 'Customer', { type: 'Customer', id: 'LIST' }, 'CustomerCredit', 'CashSession', 'CashRegister', 'Notification', 'Audit']

export const layawaysApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getLayawayTerms: build.query({
      query: (total) => ({ url: '/layaways/terms', params: { total } }),
      providesTags: ['Settings'],
    }),
    getLayaways: build.query({
      query: (params) => ({ url: '/layaways', params }),
      transformResponse: paginated,
      providesTags: ['Layaway'],
    }),
    getLayaway: build.query({
      query: (id) => ({ url: `/layaways/${id}` }),
      providesTags: ['Layaway'],
    }),
    getLayawayReceipt: build.query({
      query: (id) => ({ url: `/layaways/${id}/receipt` }),
      providesTags: ['Layaway'],
    }),
    createLayaway: build.mutation({
      query: (body) => ({ url: '/layaways', method: 'POST', data: body }),
      transformResponse: withMessage,
      invalidatesTags: AFTER_LAYAWAY,
    }),
    payLayaway: build.mutation({
      query: ({ id, ...body }) => ({ url: `/layaways/${id}/payments`, method: 'POST', data: body }),
      transformResponse: withMessage,
      invalidatesTags: AFTER_LAYAWAY,
    }),
    deliverLayaway: build.mutation({
      query: ({ id, ...body }) => ({ url: `/layaways/${id}/deliver`, method: 'POST', data: body }),
      transformResponse: withMessage,
      invalidatesTags: [...AFTER_LAYAWAY, 'Sale', 'Movement', 'Batch'],
    }),
    cancelLayaway: build.mutation({
      query: ({ id, ...body }) => ({ url: `/layaways/${id}/cancel`, method: 'POST', data: body }),
      transformResponse: withMessage,
      invalidatesTags: AFTER_LAYAWAY,
    }),
    extendLayaway: build.mutation({
      query: ({ id, ...body }) => ({ url: `/layaways/${id}/due-date`, method: 'PATCH', data: body }),
      transformResponse: withMessage,
      invalidatesTags: ['Layaway', 'Receivable', 'Audit'],
    }),
    getCustomerCredit: build.query({
      query: (customerId) => ({ url: `/customers/${customerId}/credit` }),
      providesTags: ['CustomerCredit'],
    }),
  }),
})

export const {
  useGetLayawayTermsQuery,
  useGetLayawaysQuery,
  useGetLayawayQuery,
  useGetLayawayReceiptQuery,
  useCreateLayawayMutation,
  usePayLayawayMutation,
  useDeliverLayawayMutation,
  useCancelLayawayMutation,
  useExtendLayawayMutation,
  useGetCustomerCreditQuery,
} = layawaysApi
