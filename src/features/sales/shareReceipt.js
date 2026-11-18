import { whatsappNumber } from '../customers/customerOptions'

/**
 * Envía el comprobante en PDF por WhatsApp (D-VEN-11).
 * 1. Si el equipo permite compartir archivos (celular, o Windows con la app de WhatsApp), abre la
 *    ventana "Compartir" con el PDF adjunto: la persona escoge WhatsApp y el contacto.
 * 2. Si no, descarga el PDF y abre el chat del cliente en WhatsApp para adjuntarlo.
 * Devuelve 'shared', 'cancelled' o 'downloaded'.
 */
export async function shareReceiptPdf({ file, sale, businessName }) {
  const text = `${businessName ?? 'Agropecuaria'} · Comprobante ${sale.number}. ¡Gracias por su compra!`
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Comprobante ${sale.number}`, text })
      return 'shared'
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled'
      // NotAllowedError u otro: se sigue con la descarga
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  const number = sale.customer && !sale.customer.isFinalConsumer ? whatsappNumber(sale.customer.phone) : null
  window.open(`https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  return 'downloaded'
}
