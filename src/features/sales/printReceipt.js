const PX_TO_MM = 25.4 / 96
const PAGE_WIDTH = { '58mm': 58, '80mm': 80 }

/**
 * Imprime el comprobante en una hoja del tamaño de la tirilla (D-VEN-10).
 * El navegador usa por defecto carta o A4; con @page size se le dice el ancho del rollo
 * (58 u 80 mm) y el largo exacto del comprobante, medido del que se ve en pantalla.
 * En carta se usa la hoja carta normal.
 */
export function printReceipt(paper, paperFormat) {
  const width = PAGE_WIDTH[paperFormat]
  const size = width && paper ? `${width}mm ${Math.ceil(paper.offsetHeight * PX_TO_MM) + 2}mm` : 'letter'
  const style = document.createElement('style')
  style.textContent = `@media print { @page { size: ${size}; margin: ${width ? 0 : '12mm'}; } }`
  document.head.appendChild(style)
  const cleanup = () => {
    style.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}
