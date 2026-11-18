// Endpoints de la Fase 7: compras, cuentas por pagar, pagos a proveedores y lotes.
import { baseApi } from '../../api/baseApi'
import { httpClient } from '../../api/httpClient'

const paginated = (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null })

// Una compra confirmada mueve el inventario (productos, kárdex, lotes) y las cuentas por pagar.
// La caja solo cambia al anular un pago antiguo que salió de un turno (antes de D-COMP-8).
const purchaseTags = (id) => [
  { type: 'Purchase', id },
  { type: 'Purchase', id: 'LIST' },
  'Payable',
  'Batch',
  { type: 'Product', id: 'LIST' },
  'Product',
  'Movement',
  'CashSession',
  'CashRegister',
  'Audit',
]

export const purchasesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPurchases: build.query({
      query: (params) => ({ url: '/purchases', params }),
      transformResponse: paginated,
      providesTags: [{ type: 'Purchase', id: 'LIST' }],
    }),
    getPurchase: build.query({
      query: (id) => ({ url: `/purchases/${id}` }),
      providesTags: (result, error, id) => [{ type: 'Purchase', id: Number(id) }],
    }),
    createPurchase: build.mutation({
      query: (body) => ({ url: '/purchases', method: 'POST', data: body }),
      invalidatesTags: [{ type: 'Purchase', id: 'LIST' }, 'Audit'],
    }),
    updatePurchase: build.mutation({
      query: ({ id, ...body }) => ({ url: `/purchases/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Purchase', id }, { type: 'Purchase', id: 'LIST' }, 'Audit'],
    }),
    deletePurchase: build.mutation({
      query: (id) => ({ url: `/purchases/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Purchase', id: 'LIST' }, 'Audit'],
    }),
    confirmPurchase: build.mutation({
      // paymentType, dueDate?, payment?, confirmExpiredLots?
      query: ({ id, ...body }) => ({ url: `/purchases/${id}/confirm`, method: 'POST', data: body }),
      invalidatesTags: (result, error, { id }) => purchaseTags(id),
    }),
    cancelPurchase: build.mutation({
      query: ({ id, reason }) => ({ url: `/purchases/${id}/cancel`, method: 'POST', data: { reason } }),
      invalidatesTags: (result, error, { id }) => purchaseTags(id),
    }),
    uploadPurchaseAttachment: build.mutation({
      query: ({ id, file }) => {
        const data = new FormData()
        data.append('file', file)
        return { url: `/purchases/${id}/attachment`, method: 'PUT', data }
      },
      invalidatesTags: (result, error, { id }) => [{ type: 'Purchase', id }, { type: 'Purchase', id: 'LIST' }, 'Audit'],
    }),
    addPurchasePayment: build.mutation({
      query: ({ id, ...body }) => ({ url: `/purchases/${id}/payments`, method: 'POST', data: body }),
      invalidatesTags: (result, error, { id }) => purchaseTags(id),
    }),
    cancelSupplierPayment: build.mutation({
      // purchaseId solo sirve para invalidar el caché de esa compra
      query: ({ paymentId, reason }) => ({ url: `/payables/payments/${paymentId}/cancel`, method: 'POST', data: { reason } }),
      invalidatesTags: (result, error, { purchaseId }) => purchaseTags(purchaseId),
    }),
    getPayablesSummary: build.query({
      query: () => ({ url: '/payables/summary' }),
      providesTags: ['Payable'],
    }),
    getSupplierAccount: build.query({
      query: (supplierId) => ({ url: `/payables/suppliers/${supplierId}` }),
      providesTags: ['Payable'],
    }),
    getProductBatches: build.query({
      query: ({ productId, includeEmpty = false }) => ({ url: `/batches/products/${productId}`, params: includeEmpty ? { includeEmpty: 'true' } : undefined }),
      providesTags: ['Batch'],
    }),
    getExpiringBatches: build.query({
      query: (params) => ({ url: '/batches/expiring', params }),
      transformResponse: (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null, alertDays: meta?.pagination?.alertDays ?? null }),
      providesTags: ['Batch'],
    }),
  }),
})

/** Abre la factura adjunta en otra pestaña (se pide con la sesión, por eso no es un enlace directo). */
export async function openPurchaseAttachment(id) {
  const response = await httpClient.get(`/purchases/${id}/attachment`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  window.open(url, '_blank', 'noopener')
  // Se libera después de que la pestaña nueva la cargue
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export const {
  useGetPurchasesQuery,
  useGetPurchaseQuery,
  useCreatePurchaseMutation,
  useUpdatePurchaseMutation,
  useDeletePurchaseMutation,
  useConfirmPurchaseMutation,
  useCancelPurchaseMutation,
  useUploadPurchaseAttachmentMutation,
  useAddPurchasePaymentMutation,
  useCancelSupplierPaymentMutation,
  useGetPayablesSummaryQuery,
  useGetSupplierAccountQuery,
  useGetProductBatchesQuery,
  useGetExpiringBatchesQuery,
} = purchasesApi
