import { useGetPaymentMethodsQuery } from '../../settings/settingsApi'

/**
 * Métodos de pago activos y el elegido. "Saldo a favor" (D-APA-4) solo aparece cuando se indica
 * el saldo del cliente y es mayor que cero (nunca en compras ni pagos a proveedores).
 */
export function usePaymentMethodInfo(paymentMethodId, { creditBalance = null } = {}) {
  const { data: methods = [] } = useGetPaymentMethodsQuery()
  const active = methods.filter((method) => method.isActive && (!method.isCustomerCredit || Number(creditBalance) > 0))
  const method = active.find((item) => String(item.id) === String(paymentMethodId)) ?? null
  return { methods: active, method }
}

/** Valida los datos del pago. Devuelve errores por campo. */
export function validatePayment(value, method) {
  const errors = {}
  if (!method) errors.paymentMethodId = 'Selecciona el método de pago'
  else {
    if (method.requiresReference && !value.paymentReference?.trim()) errors.paymentReference = `${method.name} pide el número de referencia`
  }
  return errors
}

/** El cuerpo que espera la API a partir de los campos. */
export function paymentBody(value, method) {
  return {
    paymentMethodId: Number(value.paymentMethodId),
    ...(method?.requiresReference && { paymentReference: value.paymentReference.trim() }),
  }
}

