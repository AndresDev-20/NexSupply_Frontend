import { baseApi } from '../../api/baseApi'

// Notificaciones del propio usuario (sin permisos especiales)
export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getNotifications: build.query({
      query: (params) => ({ url: '/notifications', params }),
      transformResponse: (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null }),
      providesTags: ['Notification'],
    }),
    getUnreadCount: build.query({
      query: () => ({ url: '/notifications/unread-count' }),
      transformResponse: (data) => data.unread,
      providesTags: ['Notification'],
    }),
    markNotificationRead: build.mutation({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'POST' }),
      invalidatesTags: ['Notification'],
    }),
    markAllNotificationsRead: build.mutation({
      query: () => ({ url: '/notifications/read-all', method: 'POST' }),
      invalidatesTags: ['Notification'],
    }),
  }),
})

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi
