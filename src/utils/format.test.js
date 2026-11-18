import { formatCurrency, formatDate, formatDateTime } from './format'

describe('formatCurrency', () => {
  it.each([
    ['1500000', '$ 1.500.000'],
    ['1500000.00', '$ 1.500.000'],
    ['0', '$ 0'],
    ['999', '$ 999'],
    ['1000', '$ 1.000'],
    ['42017.5', '$ 42.018'],
    ['42017.49', '$ 42.017'],
    ['999.5', '$ 1.000'],
    ['-25000', '-$ 25.000'],
    [2500, '$ 2.500'],
  ])('formatCurrency(%p) = %s', (value, expected) => {
    expect(formatCurrency(value)).toBe(expected)
  })

  it('con decimales usa coma decimal', () => {
    expect(formatCurrency('1234.5', { decimals: 2 })).toBe('$ 1.234,50')
    expect(formatCurrency('0.999', { decimals: 2 })).toBe('$ 1,00')
  })

  it('no redondea con errores de punto flotante', () => {
    // En float, 1.005 * 100 = 100.49999…; aquí se redondea sobre el texto
    expect(formatCurrency('1.005', { decimals: 2 })).toBe('$ 1,01')
  })

  it.each([[null], [undefined], [''], ['abc'], ['1e5'], [Number.NaN]])('muestra "—" para %p', (value) => {
    expect(formatCurrency(value)).toBe('—')
  })
})

describe('fechas en hora de Bogotá', () => {
  it('formatDate convierte el instante UTC al día de Bogotá', () => {
    // 01:00 UTC del 17 = 8:00 p. m. del 16 en Bogotá
    expect(formatDate('2026-11-17T01:00:00.000Z')).toBe('16/11/2026')
  })

  it('formatDateTime muestra la hora de Bogotá', () => {
    expect(formatDateTime('2026-11-17T01:00:00.000Z')).toMatch(/^16\/11\/2026,? 8:00\sp\.\s?m\.$/)
  })

  it('valores inválidos muestran "—"', () => {
    expect(formatDate('no-es-fecha')).toBe('—')
    expect(formatDateTime(undefined)).toBe('—')
  })
})
