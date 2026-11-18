// Endpoints de la Fase 12: gastos, soportes, categorías y gastos fijos.
import { baseApi } from '../../api/baseApi'
import { httpClient } from '../../api/httpClient'

const paginated = (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null, summary: meta?.pagination?.summary ?? null })
const withMessage = (data, meta) => ({ ...data, message: meta?.message ?? null })

// Un gasto de la caja cambia el turno; los gastos fijos muestran si ya se pagó el mes
const AFTER_EXPENSE = ['Expense', 'RecurringExpense', 'CashSession', 'CashRegister', 'Notification', 'Audit']

export const expensesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getExpenses: build.query({
      query: (params) => ({ url: '/expenses', params }),
      transformResponse: paginated,
      providesTags: ['Expense'],
    }),
    getExpense: build.query({
      query: (id) => ({ url: `/expenses/${id}` }),
      providesTags: ['Expense'],
    }),
    createExpense: build.mutation({
      query: (body) => ({ url: '/expenses', method: 'POST', data: body }),
      transformResponse: withMessage,
      invalidatesTags: AFTER_EXPENSE,
    }),
    updateExpense: build.mutation({
      query: ({ id, ...body }) => ({ url: `/expenses/${id}`, method: 'PATCH', data: body }),
      transformResponse: withMessage,
      invalidatesTags: ['Expense', 'Audit'],
    }),
    cancelExpense: build.mutation({
      query: ({ id, reason }) => ({ url: `/expenses/${id}/cancel`, method: 'POST', data: { reason } }),
      transformResponse: withMessage,
      invalidatesTags: AFTER_EXPENSE,
    }),
    addExpenseAttachment: build.mutation({
      query: ({ id, file }) => {
        const data = new FormData()
        data.append('file', file)
        return { url: `/expenses/${id}/attachments`, method: 'POST', data }
      },
      invalidatesTags: ['Expense', 'Audit'],
    }),
    removeExpenseAttachment: build.mutation({
      query: ({ id, attachmentId }) => ({ url: `/expenses/${id}/attachments/${attachmentId}`, method: 'DELETE' }),
      invalidatesTags: ['Expense', 'Audit'],
    }),

    getExpenseCategories: build.query({
      query: (params) => ({ url: '/expense-categories', params }),
      providesTags: ['ExpenseCategory'],
    }),
    createExpenseCategory: build.mutation({
      query: (body) => ({ url: '/expense-categories', method: 'POST', data: body }),
      invalidatesTags: ['ExpenseCategory', 'Audit'],
    }),
    updateExpenseCategory: build.mutation({
      query: ({ id, ...body }) => ({ url: `/expense-categories/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['ExpenseCategory', 'Expense', 'RecurringExpense', 'Audit'],
    }),

    getRecurringExpenses: build.query({
      query: (params) => ({ url: '/recurring-expenses', params }),
      providesTags: ['RecurringExpense'],
    }),
    createRecurringExpense: build.mutation({
      query: (body) => ({ url: '/recurring-expenses', method: 'POST', data: body }),
      invalidatesTags: ['RecurringExpense', 'Audit'],
    }),
    updateRecurringExpense: build.mutation({
      query: ({ id, ...body }) => ({ url: `/recurring-expenses/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['RecurringExpense', 'Audit'],
    }),
  }),
})

/** Abre un soporte en una pestaña nueva (se descarga con la sesión, no por enlace directo). */
export async function openExpenseAttachment(expenseId, attachmentId) {
  const response = await httpClient.get(`/expenses/${expenseId}/attachments/${attachmentId}/file`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export const {
  useGetExpensesQuery,
  useGetExpenseQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useCancelExpenseMutation,
  useAddExpenseAttachmentMutation,
  useRemoveExpenseAttachmentMutation,
  useGetExpenseCategoriesQuery,
  useCreateExpenseCategoryMutation,
  useUpdateExpenseCategoryMutation,
  useGetRecurringExpensesQuery,
  useCreateRecurringExpenseMutation,
  useUpdateRecurringExpenseMutation,
} = expensesApi
