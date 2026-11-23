import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

const EAN13 = /^\d{13}$/

/**
 * Código de barras en SVG (D-INV-21). EAN-13 si son 13 dígitos (los internos «20…» y los de
 * fábrica); si no, Code 128, que lee cualquier texto. Con los números debajo.
 */
export function Barcode({ value, height = 34, width = 1.4, fontSize = 11 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !value) return
    const options = { height, width, fontSize, margin: 0, textMargin: 1, background: 'transparent' }
    try {
      JsBarcode(ref.current, value, { ...options, format: EAN13.test(value) ? 'EAN13' : 'CODE128' })
    } catch {
      // Un EAN con el dígito de control malo: se dibuja como Code 128 (también lo lee el lector)
      JsBarcode(ref.current, value, { ...options, format: 'CODE128' })
    }
  }, [value, height, width, fontSize])
  return <svg ref={ref} role="img" aria-label={`Código de barras ${value}`} />
}
