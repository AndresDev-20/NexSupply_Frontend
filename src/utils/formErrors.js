/**
 * Separa un error de la API en errores por campo y un mensaje general.
 * VALIDATION_ERROR trae `details` con el campo; cualquier otro error se muestra arriba del formulario.
 */
export function splitApiError(error) {
  if (!error) return { fieldErrors: {}, formError: null }

  const fieldErrors = {}
  for (const detail of error.details ?? []) {
    if (detail.field && !fieldErrors[detail.field]) fieldErrors[detail.field] = detail.message
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0
  return {
    fieldErrors,
    formError: hasFieldErrors ? null : error.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.',
  }
}
