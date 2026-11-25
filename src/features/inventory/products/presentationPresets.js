// Atajos para crear presentaciones con las medidas de una agropecuaria (D-INV-22).
// El factor es cuántas unidades base trae cada una (la existencia siempre va en la unidad base, D11).

const ROUND = (value) => String(Number(value.toFixed(3)))

// Medidas por unidad base. La arroba colombiana es de 12,5 kg (25 libras).
const BY_UNIT = {
  kg: [
    { name: 'Libra', factor: 0.5 },
    { name: 'Arroba', factor: 12.5 },
    { name: 'Bulto 40 kg', factor: 40 },
  ],
  g: [
    { name: 'Libra', factor: 500 },
    { name: 'Kilo', factor: 1000 },
    { name: 'Arroba', factor: 12500 },
  ],
  lb: [
    { name: 'Kilo', factor: 2 },
    { name: 'Arroba', factor: 25 },
  ],
  L: [
    { name: 'Medio litro', factor: 0.5 },
    { name: 'Galón', factor: 3.785 },
  ],
}

/**
 * Atajos para el producto: las medidas de su unidad base más «Medio bulto» si ya tiene un bulto.
 * Sin los que ya existen (mismo contenido o mismo nombre). [{ name, factor }]
 */
export function presentationPresets(product) {
  const existing = product.presentations ?? []
  const presets = [...(BY_UNIT[product.unit?.symbol] ?? [])]
  const bulk = [...existing].filter((row) => /bulto/i.test(row.name)).sort((a, b) => Number(b.factor) - Number(a.factor))[0]
  if (bulk) presets.push({ name: `Medio ${bulk.name.charAt(0).toLowerCase()}${bulk.name.slice(1)}`, factor: Number(bulk.factor) / 2 })
  return presets
    .map((preset) => ({ name: preset.name, factor: ROUND(preset.factor) }))
    .filter((preset) => !existing.some((row) => Number(row.factor) === Number(preset.factor) || row.name.trim().toLowerCase() === preset.name.toLowerCase()))
}
