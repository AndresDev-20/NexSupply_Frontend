// Endpoint de la Fase 14: dashboard.
import { baseApi } from '../../api/baseApi'

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboard: build.query({
      // branch: 'all' para «Todas las sucursales» (Fase 19)
      query: ({ period, branch }) => ({ url: '/dashboard', params: { period, ...(branch && { branch }) } }),
      // Las cifras cambian con cada venta: al volver al dashboard se piden de nuevo
      keepUnusedDataFor: 0,
    }),
  }),
})

export const { useGetDashboardQuery } = dashboardApi
