import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareReceiptPdf } from './shareReceipt'

const sale = { number: 'V-000031', customer: { isFinalConsumer: false, phone: '300 123 4567' } }
const file = new File(['%PDF-'], 'comprobante-V-000031.pdf', { type: 'application/pdf' })

describe('enviar el comprobante en PDF por WhatsApp (D-VEN-11)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete navigator.canShare
    delete navigator.share
  })

  it('comparte el archivo PDF cuando el equipo lo permite', async () => {
    navigator.canShare = vi.fn(() => true)
    navigator.share = vi.fn(() => Promise.resolve())
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    expect(await shareReceiptPdf({ file, sale, businessName: 'Mi agropecuaria' })).toBe('shared')
    expect(navigator.share).toHaveBeenCalledWith(expect.objectContaining({ files: [file] }))
    expect(open).not.toHaveBeenCalled()
  })

  it('si la persona cierra la ventana de compartir no hace nada más', async () => {
    navigator.canShare = vi.fn(() => true)
    navigator.share = vi.fn(() => Promise.reject(Object.assign(new Error('cancelado'), { name: 'AbortError' })))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    expect(await shareReceiptPdf({ file, sale })).toBe('cancelled')
    expect(open).not.toHaveBeenCalled()
  })

  it('sin compartir archivos: descarga el PDF y abre el chat del cliente', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    expect(await shareReceiptPdf({ file, sale, businessName: 'Mi agropecuaria' })).toBe('downloaded')
    expect(click).toHaveBeenCalled()
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/573001234567\?text=/), '_blank', 'noopener')
  })
})
