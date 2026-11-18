// Endpoints de la Fase 18: transferencias entre sedes (plan intermedio).
import { baseApi } from '../../api/baseApi'

const paginated = (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null, summary: meta?.pagination?.summary ?? null })
const withMessage = (data, meta) => ({ ...data, message: meta?.message ?? null })

// Enviar, recibir o anular mueven existencias, lotes, cuarentena y avisos
const AFTER_TRANSFER = ['Transfer', { type: 'Product', id: 'LIST' }, 'Product', 'Movement', 'Batch', 'Quarantine', 'Notification', 'Audit']

export const transfersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTransfers: build.query({
      query: (params) => ({ url: '/transfers', params }),
      transformResponse: paginated,
      providesTags: ['Transfer'],
    }),
    getTransfer: build.query({
      query: (id) => ({ url: `/transfers/${id}` }),
      providesTags: ['Transfer'],
    }),
    getTransferDestinations: build.query({
      query: () => ({ url: '/transfers/destinations' }),
      providesTags: ['Transfer', 'Branch'],
    }),
    sendTransfer: build.mutation({
      query: (body) => ({ url: '/transfers', method: 'POST', data: body }),
      transformResponse: withMessage,
      invalidatesTags: AFTER_TRANSFER,
    }),
    receiveTransfer: build.mutation({
      query: ({ id, ...body }) => ({ url: `/transfers/${id}/receive`, method: 'POST', data: body }),
      transformResponse: withMessage,
      invalidatesTags: AFTER_TRANSFER,
    }),
    cancelTransfer: build.mutation({
      query: ({ id, ...body }) => ({ url: `/transfers/${id}/cancel`, method: 'POST', data: body }),
      transformResponse: withMessage,
      invalidatesTags: AFTER_TRANSFER,
    }),
  }),
})

export const { useGetTransfersQuery, useGetTransferQuery, useGetTransferDestinationsQuery, useSendTransferMutation, useReceiveTransferMutation, useCancelTransferMutation } = transfersApi
