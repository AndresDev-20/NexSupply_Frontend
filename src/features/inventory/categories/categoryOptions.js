// Convierte el árbol de categorías en opciones planas para una lista desplegable:
// "Alimentos", "Alimentos › Cerdos", "Alimentos › Bovinos", "Medicamentos"…

export function categoryOptions(tree = []) {
  return tree.flatMap((category) => [
    { value: String(category.id), label: category.name, category },
    ...category.children.map((child) => ({ value: String(child.id), label: `${category.name} › ${child.name}`, category: child })),
  ])
}

/** Busca una categoría (o subcategoría) por id dentro del árbol. */
export function findCategory(tree = [], id) {
  return categoryOptions(tree).find((option) => option.value === String(id))?.category ?? null
}
