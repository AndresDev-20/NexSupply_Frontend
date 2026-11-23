// Endpoints de la caja: cajas, días sin abrir, turnos (abrir → cerrar → contar → recibir),
// movimientos e historial de caja.
import { baseApi } from '../../api/baseApi'

const paginated = (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null })

// Lo que cambia un turno afecta su detalle, la lista de cajas (estado actual),
// la lista de turnos, el historial, sus movimientos y la auditoría
const sessionTags = (id) => [{ type: 'CashSession', id }, { type: 'CashSession', id: 'LIST' }, 'CashRegister', 'CashHistory', { type: 'CashMovement', id }, 'Audit']

export const cashApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ---------- Cajas ----------
    getCashRegisters: build.query({
      query: ({ includeInactive = false } = {}) => ({ url: '/cash-registers', params: includeInactive ? { includeInactive: 'true' } : undefined }),
      providesTags: ['CashRegister'],
    }),
    createCashRegister: build.mutation({
      query: (body) => ({ url: '/cash-registers', method: 'POST', data: body }),
      invalidatesTags: ['CashRegister', 'Audit'],
    }),
    updateCashRegister: build.mutation({
      query: ({ id, ...body }) => ({ url: `/cash-registers/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['CashRegister', 'CashSession', 'Audit'],
    }),
    setCashRegisterActive: build.mutation({
      query: ({ id, active }) => ({ url: `/cash-registers/${id}/${active ? 'activate' : 'deactivate'}`, method: 'POST' }),
      invalidatesTags: ['CashRegister', 'Audit'],
    }),
    openCashSession: build.mutation({
      // confirmClosedDay: abrir aunque hoy esté marcado como día sin abrir (D-CAJA-11)
      query: ({ registerId, ...body }) => ({ url: `/cash-registers/${registerId}/open`, method: 'POST', data: body }),
      invalidatesTags: ['CashRegister', { type: 'CashSession', id: 'LIST' }, 'Audit'],
    }),

    // ---------- Días sin abrir ----------
    getClosedDays: build.query({
      query: ({ includePast = false } = {}) => ({ url: '/cash-closed-days', params: includePast ? { includePast: 'true' } : undefined }),
      providesTags: ['CashClosedDay'],
    }),
    addClosedDay: build.mutation({
      query: (body) => ({ url: '/cash-closed-days', method: 'POST', data: body }),
      invalidatesTags: ['CashClosedDay', 'Audit'],
    }),
    removeClosedDay: build.mutation({
      query: (id) => ({ url: `/cash-closed-days/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CashClosedDay', 'Audit'],
    }),

    // ---------- Turnos ----------
    getCashSessions: build.query({
      query: (params) => ({ url: '/cash-sessions', params }),
      transformResponse: paginated,
      providesTags: [{ type: 'CashSession', id: 'LIST' }],
    }),
    getCashSession: build.query({
      query: (id) => ({ url: `/cash-sessions/${id}` }),
      providesTags: (result, error, id) => [{ type: 'CashSession', id: Number(id) }],
    }),
    getCashMovements: build.query({
      query: ({ sessionId, ...params }) => ({ url: `/cash-sessions/${sessionId}/movements`, params }),
      transformResponse: paginated,
      providesTags: (result, error, { sessionId }) => [{ type: 'CashMovement', id: Number(sessionId) }],
    }),
    getCashHistory: build.query({
      query: (params) => ({ url: '/cash-sessions/history', params }),
      providesTags: ['CashHistory'],
    }),
    confirmCashOpening: build.mutation({
      query: ({ sessionId, ...body }) => ({ url: `/cash-sessions/${sessionId}/confirm-opening`, method: 'POST', data: body }),
      invalidatesTags: (result, error, { sessionId }) => sessionTags(Number(sessionId)),
    }),
    addCashMovement: build.mutation({
      query: ({ sessionId, ...body }) => ({ url: `/cash-sessions/${sessionId}/movements`, method: 'POST', data: body }),
      invalidatesTags: (result, error, { sessionId }) => sessionTags(Number(sessionId)),
    }),
    cutCashSession: build.mutation({
      query: (sessionId) => ({ url: `/cash-sessions/${sessionId}/cut`, method: 'POST' }),
      invalidatesTags: (result, error, sessionId) => sessionTags(Number(sessionId)),
    }),
    countCashSession: build.mutation({
      query: ({ sessionId, ...body }) => ({ url: `/cash-sessions/${sessionId}/count`, method: 'POST', data: body }),
      invalidatesTags: (result, error, { sessionId }) => sessionTags(Number(sessionId)),
    }),
    receiveCashSession: build.mutation({
      query: ({ sessionId, ...body }) => ({ url: `/cash-sessions/${sessionId}/receive`, method: 'POST', data: body }),
      invalidatesTags: (result, error, { sessionId }) => sessionTags(Number(sessionId)),
    }),
    // D-CAJA-15: reabrir un turno contado que no se ha recibido
    reopenCashSession: build.mutation({
      query: ({ sessionId, reason }) => ({ url: `/cash-sessions/${sessionId}/reopen`, method: 'POST', data: { reason } }),
      transformResponse: (data, meta) => ({ ...data, message: meta?.message ?? null }),
      invalidatesTags: (result, error, { sessionId }) => sessionTags(Number(sessionId)),
    }),
  }),
})

export const {
  useReopenCashSessionMutation,
  useGetCashRegistersQuery,
  useCreateCashRegisterMutation,
  useUpdateCashRegisterMutation,
  useSetCashRegisterActiveMutation,
  useOpenCashSessionMutation,
  useGetClosedDaysQuery,
  useAddClosedDayMutation,
  useRemoveClosedDayMutation,
  useGetCashSessionsQuery,
  useGetCashSessionQuery,
  useGetCashMovementsQuery,
  useGetCashHistoryQuery,
  useConfirmCashOpeningMutation,
  useAddCashMovementMutation,
  useCutCashSessionMutation,
  useCountCashSessionMutation,
  useReceiveCashSessionMutation,
} = cashApi
