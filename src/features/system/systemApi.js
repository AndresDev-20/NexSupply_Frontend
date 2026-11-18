import { baseApi } from '../../api/baseApi'

export const systemApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // GET /api/v1/health → { status, database, time, timezone }
    getHealth: build.query({
      query: () => ({ url: '/health' }),
      providesTags: ['Health'],
    }),
  }),
})

export const { useGetHealthQuery } = systemApi
