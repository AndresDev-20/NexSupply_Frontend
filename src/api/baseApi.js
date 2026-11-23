// RTK Query sobre Axios (decisión D26).
// Cada módulo agrega sus endpoints con baseApi.injectEndpoints(), así todo
// comparte un solo caché, un solo reducer y un solo middleware.
import { createApi } from '@reduxjs/toolkit/query/react'
import { httpClient } from './httpClient'

/**
 * baseQuery que usa Axios. Entrega a los endpoints solo `data` del sobre
 * estándar { success, data, meta, message } y deja `message` y la paginación
 * en el `meta` de RTK Query (accesible en transformResponse).
 */
export function axiosBaseQuery() {
  return async ({ url, method = 'GET', data, params, headers, signal }) => {
    try {
      const response = await httpClient.request({ url, method, data, params, headers, signal })
      // Una página HTML en lugar del JSON de la API (ej. VITE_API_BASE_URL mal configurada y el
      // hosting devolviendo index.html): es un error, no una respuesta vacía (D-DEP-1)
      if (typeof response.data === 'string' && response.data.trim() !== '') {
        return { error: { status: response.status, code: 'INVALID_RESPONSE', message: 'El servidor respondió algo inesperado. Revisa la dirección de la API (VITE_API_BASE_URL).', details: [], requestId: null } }
      }
      const body = response.data || {}
      return {
        data: body.data ?? null,
        meta: {
          message: body.message ?? null,
          pagination: body.meta ?? null,
          requestId: response.headers?.['x-request-id'] ?? null,
        },
      }
    } catch (error) {
      // httpClient ya entrega el error normalizado
      return { error }
    }
  }
}

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery(),
  // Etiquetas para invalidar el caché tras crear o editar. Cada fase agrega las suyas.
  tagTypes: [
    'Porter',
    'Quote',
    'Backup',
    'PriceList',
    'AnimalLot',
    'PurchaseGroup',
    'Health',
    'User',
    'Role',
    'Branch',
    'Audit',
    'Notification',
    'Settings',
    'Branding',
    'Preferences',
    'PaymentMethod',
    'Unit',
    'Sequence',
    'Category',
    'Supplier',
    'Product',
    'Movement',
    'PriceHistory',
    'CashRegister',
    'CashSession',
    'CashMovement',
    'CashClosedDay',
    'CashHistory',
    'Purchase',
    'Payable',
    'Batch',
    'InventoryCount',
    'ProductDocument',
    'Customer',
    'Receivable',
    'CustomerPayment',
    'Sale',
    'Layaway',
    'CustomerCredit',
    'SaleReturn',
    'Quarantine',
    'Expense',
    'ExpenseCategory',
    'RecurringExpense',
    'Transfer',
  ],
  endpoints: () => ({}),
})
