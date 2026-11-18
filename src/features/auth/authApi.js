// Endpoints de /api/v1/auth. Los tokens nunca pasan por aquí: viajan en cookies httpOnly.
import { baseApi } from '../../api/baseApi'

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Se usa al abrir la aplicación para saber si ya hay una sesión
    // Ambas devuelven la sesión completa: { user (con sus permisos), plan }
    getMe: build.query({
      query: () => ({ url: '/auth/me' }),
    }),
    login: build.mutation({
      query: (credentials) => ({ url: '/auth/login', method: 'POST', data: credentials }),
    }),
    logout: build.mutation({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
    changePassword: build.mutation({
      query: (body) => ({ url: '/auth/change-password', method: 'POST', data: body }),
      transformResponse: (data, meta) => ({ user: data.user, message: meta?.message }),
    }),
    forgotPassword: build.mutation({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', data: body }),
      transformResponse: (data, meta) => meta?.message,
    }),
    resetPassword: build.mutation({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', data: body }),
      transformResponse: (data, meta) => meta?.message,
    }),
  }),
})

export const {
  useLoginMutation,
  useLogoutMutation,
  useChangePasswordMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = authApi
