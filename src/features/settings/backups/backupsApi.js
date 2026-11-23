// Copias de seguridad de la base de datos (D-SEG-1).
import { baseApi } from '../../../api/baseApi'
import { httpClient } from '../../../api/httpClient'

export const backupsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBackups: build.query({
      query: () => ({ url: '/backups' }),
      providesTags: ['Backup'],
    }),
    createBackup: build.mutation({
      query: () => ({ url: '/backups', method: 'POST' }),
      transformResponse: (data, meta) => ({ ...data, message: meta?.message ?? null }),
      invalidatesTags: ['Backup', 'Audit'],
    }),
  }),
})

/** Descarga una copia (.sql.gz) con su nombre. */
export async function downloadBackup(name) {
  const response = await httpClient.get(`/backups/${encodeURIComponent(name)}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const { useGetBackupsQuery, useCreateBackupMutation } = backupsApi
