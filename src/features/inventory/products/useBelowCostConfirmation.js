import { useState } from 'react'

/**
 * Flujo de "precio por debajo del costo" (D-INV-10):
 * 1. Se guarda normalmente.
 * 2. Si el servidor responde CONFIRMATION_REQUIRED, se pide confirmar.
 * 3. Al confirmar, se repite el guardado con confirmBelowCost: true.
 *
 *   const belowCost = useBelowCostConfirmation()
 *   await belowCost.run((confirm) => save({ ...body, ...(confirm && { confirmBelowCost: true }) }))
 *   <ConfirmDialog isOpen={belowCost.isOpen} onConfirm={belowCost.confirm} onCancel={belowCost.cancel} … />
 */
export function useBelowCostConfirmation() {
  const [pending, setPending] = useState(null)

  /** Ejecuta save(false). Devuelve su resultado, o null si quedó esperando confirmación. */
  const run = async (save) => {
    try {
      return await save(false)
    } catch (error) {
      if (error?.code !== 'CONFIRMATION_REQUIRED') throw error
      setPending(() => save)
      return null
    }
  }

  const confirm = async () => {
    const save = pending
    try {
      return await save(true)
    } finally {
      setPending(null)
    }
  }

  return { isOpen: Boolean(pending), run, confirm, cancel: () => setPending(null) }
}
