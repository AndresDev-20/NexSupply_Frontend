// Conductores (D-FLE-1; antes coteros): quien lleva la mercancía en el carro de línea.
// El flete se agrega en la venta del punto de venta; aquí solo se registran y se consultan.
import { baseApi } from '../../../api/baseApi'

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
  }),
})

export const { useGetPortersQuery, useGetPorterQuery, useCreatePorterMutation, useUpdatePorterMutation, useSetPorterActiveMutation } = portersApi
