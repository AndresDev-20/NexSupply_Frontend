// Endpoints de la Fase 4: configuración del negocio, logo, marca pública,
// preferencias personales, métodos de pago, unidades y consecutivos.
import { baseApi } from '../../api/baseApi'
import { env } from '../../config/env'

/** URL del logo. Lleva la versión: si cambia el logo, cambia la URL y el navegador no usa el anterior. */
export function logoUrl(logo) {
  return logo ? `${env.apiBaseUrl}/branding/logo?v=${logo.version}` : null
}

export const settingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ---------- Configuración del negocio ----------
    getSettings: build.query({
      query: () => ({ url: '/settings' }),
      providesTags: ['Settings'],
    }),
    updateSettings: build.mutation({
      // values: { 'business.name': '…' }; confirmTaxChange: true para cambiar precios con/sin IVA (D4b)
      query: ({ values, confirmTaxChange }) => ({
        url: '/settings',
        method: 'PATCH',
        data: { values, ...(confirmTaxChange && { confirmTaxChange: true }) },
      }),
      invalidatesTags: ['Settings', 'Branding', 'Audit'],
    }),
    uploadLogo: build.mutation({
      query: (file) => {
        const data = new FormData()
        data.append('logo', file)
        return { url: '/settings/logo', method: 'PUT', data }
      },
      invalidatesTags: ['Settings', 'Branding', 'Audit'],
    }),
    removeLogo: build.mutation({
      query: () => ({ url: '/settings/logo', method: 'DELETE' }),
      invalidatesTags: ['Settings', 'Branding', 'Audit'],
    }),

    // ---------- Marca pública (inicio de sesión y menú) ----------
    getBranding: build.query({
      query: () => ({ url: '/branding' }),
      providesTags: ['Branding'],
    }),

    // ---------- Preferencias personales ----------
    getPreferences: build.query({
      query: () => ({ url: '/me/preferences' }),
      providesTags: ['Preferences'],
    }),
    updatePreferences: build.mutation({
      query: (values) => ({ url: '/me/preferences', method: 'PATCH', data: values }),
      // Actualiza el caché al instante: el cambio de tema no espera a la red
      async onQueryStarted(values, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          settingsApi.util.updateQueryData('getPreferences', undefined, (draft) => {
            Object.assign(draft, values)
          }),
        )
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
    }),

    // ---------- Métodos de pago ----------
    getPaymentMethods: build.query({
      query: ({ includeInactive = false } = {}) => ({
        url: '/payment-methods',
        params: includeInactive ? { includeInactive: 'true' } : undefined,
      }),
      providesTags: ['PaymentMethod'],
    }),
    createPaymentMethod: build.mutation({
      query: (body) => ({ url: '/payment-methods', method: 'POST', data: body }),
      invalidatesTags: ['PaymentMethod', 'Audit'],
    }),
    updatePaymentMethod: build.mutation({
      query: ({ id, ...body }) => ({ url: `/payment-methods/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['PaymentMethod', 'Audit'],
    }),
    setPaymentMethodActive: build.mutation({
      query: ({ id, active }) => ({ url: `/payment-methods/${id}/${active ? 'activate' : 'deactivate'}`, method: 'POST' }),
      invalidatesTags: ['PaymentMethod', 'Audit'],
    }),

    // ---------- Unidades de medida ----------
    getUnits: build.query({
      query: ({ includeInactive = false } = {}) => ({
        url: '/units',
        params: includeInactive ? { includeInactive: 'true' } : undefined,
      }),
      providesTags: ['Unit'],
    }),
    createUnit: build.mutation({
      query: (body) => ({ url: '/units', method: 'POST', data: body }),
      invalidatesTags: ['Unit', 'Audit'],
    }),
    updateUnit: build.mutation({
      query: ({ id, ...body }) => ({ url: `/units/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['Unit', 'Audit'],
    }),
    setUnitActive: build.mutation({
      query: ({ id, active }) => ({ url: `/units/${id}/${active ? 'activate' : 'deactivate'}`, method: 'POST' }),
      invalidatesTags: ['Unit', 'Audit'],
    }),

    // ---------- Consecutivos ----------
    getSequences: build.query({
      query: () => ({ url: '/document-sequences' }),
      providesTags: ['Sequence'],
    }),
    updateSequence: build.mutation({
      query: ({ id, ...body }) => ({ url: `/document-sequences/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['Sequence', 'Audit'],
    }),
  }),
})

export const {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useUploadLogoMutation,
  useRemoveLogoMutation,
  useGetBrandingQuery,
  useGetPreferencesQuery,
  useUpdatePreferencesMutation,
  useGetPaymentMethodsQuery,
  useCreatePaymentMethodMutation,
  useUpdatePaymentMethodMutation,
  useSetPaymentMethodActiveMutation,
  useGetUnitsQuery,
  useCreateUnitMutation,
  useUpdateUnitMutation,
  useSetUnitActiveMutation,
  useGetSequencesQuery,
  useUpdateSequenceMutation,
} = settingsApi
