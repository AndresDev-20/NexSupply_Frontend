// Cotizaciones (D-COT-1).
import { baseApi } from '../../api/baseApi'
import { httpClient } from '../../api/httpClient'

const paginated = (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null })

export const quotesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getQuotes: build.query({
      query: (params) => ({ url: '/quotes', params }),
      transformResponse: paginated,
      providesTags: [{ type: 'Quote', id: 'LIST' }],
    }),
    getQuote: build.query({
      query: (id) => ({ url: `/quotes/${id}` }),
      providesTags: (result, error, id) => [{ type: 'Quote', id: Number(id) }],
    }),
    createQuote: build.mutation({
      query: (body) => ({ url: '/quotes', method: 'POST', data: body }),
      invalidatesTags: [{ type: 'Quote', id: 'LIST' }, 'Audit'],
    }),
    cancelQuote: build.mutation({
      query: ({ id, reason }) => ({ url: `/quotes/${id}/cancel`, method: 'POST', data: { reason } }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Quote', id: 'LIST' }, { type: 'Quote', id }, 'Audit'],
    }),
    emailQuote: build.mutation({
      query: ({ id, email }) => ({ url: `/quotes/${id}/email`, method: 'POST', data: { email: email || null } }),
      transformResponse: (data, meta) => ({ ...data, message: meta?.message ?? null }),
    }),
  }),
})

/** La cotización en PDF como archivo (para compartirla por WhatsApp). */
export async function getQuotePdfFile(id, number) {
  const response = await httpClient.get(`/quotes/${id}/receipt.pdf`, { responseType: 'blob' })
  return new File([response.data], `cotizacion-${number}.pdf`, { type: 'application/pdf' })
}

/** Abre la cotización en PDF en una pestaña nueva (para verla o imprimirla). */
export async function openQuotePdf(id) {
  const response = await httpClient.get(`/quotes/${id}/receipt.pdf`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export const { useGetQuotesQuery, useGetQuoteQuery, useCreateQuoteMutation, useCancelQuoteMutation, useEmailQuoteMutation } = quotesApi
