// Requisitos de contraseña para GUIAR al usuario mientras escribe.
// La regla oficial está en el backend (Backend/src/api/utils/credentialsPolicy.js),
// que siempre vuelve a validar. Si cambia allá, hay que actualizar esta lista.
const encoder = new TextEncoder()

export const PASSWORD_RULES = [
  { id: 'length', label: 'Al menos 8 caracteres', test: (value) => value.length >= 8 },
  { id: 'letter', label: 'Al menos una letra', test: (value) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(value) },
  { id: 'number', label: 'Al menos un número', test: (value) => /\d/.test(value) },
  { id: 'max', label: 'Máximo 72 caracteres', test: (value) => encoder.encode(value).length <= 72 },
]

export function passwordMeetsRules(value) {
  return PASSWORD_RULES.every((rule) => rule.test(value))
}
