// Endpoints de la Fase 9: clientes, cuentas por cobrar (cartera) y abonos.
import { baseApi } from '../../api/baseApi'
import { httpClient } from '../../api/httpClient'
import { saveBlob } from '../../utils/saveBlob'

const paginated = (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null })

// Una deuda o un abono cambian el saldo del cliente, la cartera y (abono en efectivo) la caja
const CARTERA = [{ type: 'Customer', id: 'LIST' }, 'Customer', 'Receivable', 'CustomerPayment', 'Layaway', 'CustomerCredit', 'Audit']

export const customersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCustomers: build.query({
      query: (params) => ({ url: '/customers', params }),
      transformResponse: paginated,
      providesTags: [{ type: 'Customer', id: 'LIST' }],
    }),
    getCustomer: build.query({
      query: (id) => ({ url: `/customers/${id}` }),
      providesTags: (result, error, id) => [{ type: 'Customer', id: Number(id) }],
    }),
    createCustomer: build.mutation({
      query: (body) => ({ url: '/customers', method: 'POST', data: body }),
      invalidatesTags: [{ type: 'Customer', id: 'LIST' }, 'Audit'],
    }),
    updateCustomer: build.mutation({
      query: ({ id, ...body }) => ({ url: `/customers/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Customer', id }, { type: 'Customer', id: 'LIST' }, 'Receivable', 'Audit'],
    }),
    setCustomerActive: build.mutation({
      query: ({ id, active }) => ({ url: `/customers/${id}/${active ? 'activate' : 'deactivate'}`, method: 'POST' }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Customer', id }, { type: 'Customer', id: 'LIST' }, 'Audit'],
    }),
    getCustomerStatement: build.query({
      query: (id) => ({ url: `/customers/${id}/statement` }),
      providesTags: ['Receivable', 'CustomerPayment'],
    }),

    getReceivables: build.query({
      query: (params) => ({ url: '/receivables', params }),
      transformResponse: paginated,
      providesTags: ['Receivable'],
    }),
    getReceivablesSummary: build.query({
      // params: { branch: 'all' } para «Todas las sucursales» (Fase 19)
      query: (params) => ({ url: '/receivables/summary', params }),
      providesTags: ['Receivable'],
    }),
    getReceivable: build.query({
      query: (id) => ({ url: `/receivables/${id}` }),
      providesTags: ['Receivable'],
    }),
    // Importación de clientes con sus deudas desde Excel (D-CLI-10)
    importCustomers: build.mutation({
      query: ({ file, dryRun }) => {
        const data = new FormData()
        data.append('file', file)
        return { url: '/customers/import', method: 'POST', data, params: dryRun ? { dryRun: 'true' } : undefined }
      },
      invalidatesTags: (result, error, { dryRun }) => (dryRun ? [] : CARTERA),
    }),
    createReceivable: build.mutation({
      query: (body) => ({ url: '/receivables', method: 'POST', data: body }),
      transformResponse: (data, meta) => ({ ...data, message: meta?.message ?? null }),
      invalidatesTags: CARTERA,
    }),
    previewInstallments: build.mutation({
      query: (body) => ({ url: '/receivables/installments-preview', method: 'POST', data: body }),
    }),
    cancelReceivable: build.mutation({
      query: ({ id, reason }) => ({ url: `/receivables/${id}/cancel`, method: 'POST', data: { reason } }),
      invalidatesTags: CARTERA,
    }),

    getCustomerPayments: build.query({
      query: (params) => ({ url: '/customer-payments', params }),
      transformResponse: paginated,
      providesTags: ['CustomerPayment'],
    }),
    getCustomerPayment: build.query({
      query: (id) => ({ url: `/customer-payments/${id}` }),
      providesTags: ['CustomerPayment'],
    }),
    createCustomerPayment: build.mutation({
      query: (body) => ({ url: '/customer-payments', method: 'POST', data: body }),
      invalidatesTags: [...CARTERA, 'CashSession', 'CashRegister'],
    }),
    cancelCustomerPayment: build.mutation({
      query: ({ id, reason }) => ({ url: `/customer-payments/${id}/cancel`, method: 'POST', data: { reason } }),
      invalidatesTags: [...CARTERA, 'CashSession', 'CashRegister'],
    }),
  }),
})

/** Descarga la plantilla de Excel para importar clientes. */
export async function downloadCustomerImportTemplate() {
  const response = await httpClient.get('/customers/import/template', { responseType: 'blob' })
  saveBlob(response.data, 'plantilla-clientes-nexsupply.xlsx')
}

export const {
  useImportCustomersMutation,
  useGetCustomersQuery,
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useSetCustomerActiveMutation,
  useGetCustomerStatementQuery,
  useGetReceivablesQuery,
  useGetReceivablesSummaryQuery,
  useGetReceivableQuery,
  useCreateReceivableMutation,
  usePreviewInstallmentsMutation,
  useCancelReceivableMutation,
  useGetCustomerPaymentsQuery,
  useGetCustomerPaymentQuery,
  useCreateCustomerPaymentMutation,
  useCancelCustomerPaymentMutation,
} = customersApi
