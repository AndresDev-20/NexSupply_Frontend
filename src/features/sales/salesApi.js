// Endpoints de la Fase 10: punto de venta, ventas y comprobantes.
import { baseApi } from '../../api/baseApi'
import { httpClient } from '../../api/httpClient'

const paginated = (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null, summary: meta?.pagination?.summary ?? null })

// Una venta cambia existencias, caja, cartera y el historial
const AFTER_SALE = ['Sale', { type: 'Product', id: 'LIST' }, 'Product', 'Movement', 'Batch', 'CashSession', 'CashRegister', 'Receivable', 'Customer', 'CustomerCredit', 'Audit']

export const salesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    searchSaleCatalog: build.query({
      // arg: el texto, o { search, customerId?, priceListId? } para los precios de la lista (D-PRE-1)
      query: (arg) => ({ url: '/sales/catalog', params: typeof arg === 'string' ? { search: arg } : arg }),
      keepUnusedDataFor: 5,
    }),
    previewSale: build.mutation({
      query: (body) => ({ url: '/sales/preview', method: 'POST', data: body }),
    }),
    authorizeSale: build.mutation({
      query: (body) => ({ url: '/sales/authorizations', method: 'POST', data: body }),
    }),
    createSale: build.mutation({
      query: (body) => ({ url: '/sales', method: 'POST', data: body }),
      invalidatesTags: AFTER_SALE,
    }),
    // Libro de fórmulas veterinarias (D-VET-1)
    getPrescriptions: build.query({
      query: (params) => ({ url: '/sales/prescriptions', params }),
      transformResponse: paginated,
      providesTags: ['Sale'],
    }),
    getSales: build.query({
      query: (params) => ({ url: '/sales', params }),
      transformResponse: paginated,
      providesTags: ['Sale'],
    }),
    getSale: build.query({
      query: (id) => ({ url: `/sales/${id}` }),
      providesTags: ['Sale'],
    }),
    getSaleReceipt: build.query({
      query: (id) => ({ url: `/sales/${id}/receipt` }),
      providesTags: ['Sale'],
    }),
    emailSaleReceipt: build.mutation({
      query: ({ id, email }) => ({ url: `/sales/${id}/email`, method: 'POST', data: { email: email || null } }),
      transformResponse: (data, meta) => ({ ...data, message: meta?.message ?? null }),
    }),
  }),
})

/** El comprobante en PDF como archivo (para compartirlo por WhatsApp u otra app). */
export async function getSalePdfFile(id, number) {
  const response = await httpClient.get(`/sales/${id}/receipt.pdf`, { responseType: 'blob' })
  return new File([response.data], `comprobante-${number}.pdf`, { type: 'application/pdf' })
}

/** Abre el comprobante en PDF en una pestaña nueva. */
export async function openSalePdf(id) {
  const response = await httpClient.get(`/sales/${id}/receipt.pdf`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export const {
  useLazySearchSaleCatalogQuery,
  usePreviewSaleMutation,
  useAuthorizeSaleMutation,
  useCreateSaleMutation,
  useGetSalesQuery,
  useGetPrescriptionsQuery,
  useGetSaleQuery,
  useGetSaleReceiptQuery,
  useEmailSaleReceiptMutation,
} = salesApi
