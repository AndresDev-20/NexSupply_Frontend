import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { useRemoveInventoryCountItemMutation, useSetInventoryCountItemMutation } from './countsApi'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { QUANTITY_PATTERN, toApiNumber } from '../../../utils/numberInput'

/**
 * Lo contado de un producto: cantidad en la unidad base o en una presentación (bultos).
 * "Guardar" escribe o corrige (toma una nueva foto de la existencia); "Sumar" agrega a lo
 * ya contado y conserva la foto del primer conteo (D-INV-15). Enter = guardar.
 */
export function CountRowEditor({ countId, row, inputRef }) {
  const toast = useToast()
  const { product, count } = row
  const packs = product.presentations ?? []
  const [quantity, setQuantity] = useState('')
  const [presentationId, setPresentationId] = useState('')
  const [setItem, { isLoading }] = useSetInventoryCountItemMutation()
  const [removeItem, removeState] = useRemoveInventoryCountItemMutation()

  const save = async (mode) => {
    const value = toApiNumber(quantity)
    const pack = packs.find((item) => String(item.id) === presentationId)
    if (!QUANTITY_PATTERN.test(value)) {
      toast.error('Escribe la cantidad contada (puede ser 0)')
      return
    }
    if (!pack && !product.unit?.allowsDecimals && !/^\d+$/.test(value)) {
      toast.error(`La unidad ${product.unit.symbol} solo admite cantidades enteras`)
      return
    }
    try {
      await setItem({ id: countId, productId: product.id, quantity: value, ...(pack && { presentationId: pack.id }), mode }).unwrap()
      setQuantity('')
    } catch (saveError) {
      toast.error(saveError.message)
    }
  }

  const remove = async () => {
    try {
      await removeItem({ id: countId, productId: product.id }).unwrap()
    } catch (removeError) {
      toast.error(removeError.message)
    }
  }

  return (
    <form
      className="count-editor"
      onSubmit={(event) => {
        event.preventDefault()
        save('set')
      }}
      noValidate
    >
      <input
        ref={inputRef}
        className="count-editor__input"
        inputMode="decimal"
        placeholder={count ? 'Corregir' : 'Contado'}
        aria-label={`Cantidad contada de ${product.name}`}
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        disabled={isLoading}
      />
      {packs.length > 0 && (
        <select className="count-editor__unit" aria-label={`Unidad de ${product.name}`} value={presentationId} onChange={(event) => setPresentationId(event.target.value)}>
          <option value="">{product.unit?.symbol}</option>
          {packs.map((pack) => (
            <option key={pack.id} value={pack.id}>
              {pack.name}
            </option>
          ))}
        </select>
      )}
      <IconButton type="submit" icon={Check} tone="success" label={count ? `Corregir ${product.name}` : `Guardar ${product.name}`} disabled={isLoading || !quantity} />
      {count && (
        <>
          <IconButton icon={Plus} label={`Sumar a lo contado de ${product.name}`} onClick={() => save('add')} disabled={isLoading || !quantity} />
          <IconButton icon={X} tone="danger" label={`Quitar el conteo de ${product.name}`} onClick={remove} disabled={removeState.isLoading} />
        </>
      )}
    </form>
  )
}
