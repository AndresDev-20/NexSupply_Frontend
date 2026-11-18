// Endpoints de la Fase 11: devoluciones, anulación de ventas y cuarentena.
import { baseApi } from '../../api/baseApi'

const paginated = (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null, summary: meta?.pagination?.summary ?? null })
const withMessage = (data, meta) => ({ ...data, message: meta?.message ?? null })

// Una devolución o una anulación mueven inventario, caja, cartera y saldo a favor
const AFTER_RETURN = ['Sale', 'SaleReturn', 'Quarantine', { type: 'Product', id: 'LIST' }, 'Product', 'Movement', 'Batch', 'CashSession', 'CashRegister', 'Receivable', 'Customer', 'CustomerCredit', 'Audit']

export const returnsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getReturnable: build.query({
      query: (saleId) => ({ url: `/sales/${saleId}/returnable` }),
      providesTags: ['Sale', 'SaleReturn'],
      keepUnusedDataFor: 0,
    }),
    createSaleReturn: build.mutation({
      query: (body) => ({ url: '/sale-returns', method: 'POST', data: body }),
      transformResponse: withMessage,
      invalidatesTags: AFTER_RETURN,
    }),
    getSaleReturns: build.query({
      query: (params) => ({ url: '/sale-returns', params }),
      transformResponse: paginated,
      providesTags: ['SaleReturn'],
    }),
    getSaleReturnReceipt: build.query({
      query: (id) => ({ url: `/sale-returns/${id}/receipt` }),
      providesTags: ['SaleReturn'],
    }),
    cancelSale: build.mutation({
      query: ({ id, ...body }) => ({ url: `/sales/${id}/cancel`, method: 'POST', data: body }),
      transformResponse: withMessage,
      invalidatesTags: AFTER_RETURN,
    }),
    getQuarantine: build.query({
      query: (params) => ({ url: '/quarantine', params }),
      transformResponse: paginated,
      providesTags: ['Quarantine'],
    }),
    releaseQuarantine: build.mutation({
      query: ({ id, ...body }) => ({ url: `/quarantine/${id}/release`, method: 'POST', data: body }),
      transformResponse: withMessage,
      invalidatesTags: ['Quarantine', { type: 'Product', id: 'LIST' }, 'Product', 'Movement', 'Batch', 'Audit'],
    }),
    writeOffQuarantine: build.mutation({
      query: ({ id, ...body }) => ({ url: `/quarantine/${id}/write-off`, method: 'POST', data: body }),
      transformResponse: withMessage,
      invalidatesTags: ['Quarantine', 'Audit'],
    }),
  }),
})

export const {
  useGetReturnableQuery,
  useCreateSaleReturnMutation,
  useGetSaleReturnsQuery,
  useGetSaleReturnReceiptQuery,
  useCancelSaleMutation,
  useGetQuarantineQuery,
  useReleaseQuarantineMutation,
  useWriteOffQuarantineMutation,
} = returnsApi
