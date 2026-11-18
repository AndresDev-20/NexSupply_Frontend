// Endpoints de la Fase 13: centro de informes.
import { baseApi } from '../../api/baseApi'
import { httpClient } from '../../api/httpClient'

export const reportsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getReportsCatalog: build.query({
      query: () => ({ url: '/reports' }),
    }),
    getReportOptions: build.query({
      query: () => ({ url: '/reports/options' }),
    }),
    getReport: build.query({
      query: ({ key, params }) => ({ url: `/reports/${key}`, params }),
      // Los informes siempre se consultan frescos: los datos cambian con cada venta
      keepUnusedDataFor: 0,
    }),
  }),
})

/** Descarga un informe en Excel o PDF con la sesión y lo guarda con el nombre que da el servidor. */
export async function downloadReport(key, format, params) {
  const response = await httpClient.get(`/reports/${key}/export.${format}`, { params, responseType: 'blob' })
  const disposition = response.headers?.['content-disposition'] ?? ''
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${key}.${format}`
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return fileName
}

export const { useGetReportsCatalogQuery, useGetReportOptionsQuery, useGetReportQuery } = reportsApi
