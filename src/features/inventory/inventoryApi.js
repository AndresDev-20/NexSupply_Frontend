// Endpoints de la Fase 5: categorías, proveedores, productos, presentaciones,
// existencia inicial, kárdex, historial de precios e importación desde Excel.
import { baseApi } from '../../api/baseApi'
import { httpClient } from '../../api/httpClient'

const paginated = (data, meta) => ({ rows: data ?? [], pagination: meta?.pagination ?? null })

// Lo que cambia un producto afecta su detalle, la lista y la auditoría
const productTags = (id) => [{ type: 'Product', id }, { type: 'Product', id: 'LIST' }, 'Audit']

export const inventoryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ---------- Categorías ----------
    getCategories: build.query({
      query: ({ includeInactive = false } = {}) => ({ url: '/categories', params: includeInactive ? { includeInactive: 'true' } : undefined }),
      providesTags: ['Category'],
    }),
    createCategory: build.mutation({
      query: (body) => ({ url: '/categories', method: 'POST', data: body }),
      invalidatesTags: ['Category', 'Audit'],
    }),
    updateCategory: build.mutation({
      query: ({ id, ...body }) => ({ url: `/categories/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['Category', { type: 'Product', id: 'LIST' }, 'Audit'],
    }),
    setCategoryActive: build.mutation({
      query: ({ id, active }) => ({ url: `/categories/${id}/${active ? 'activate' : 'deactivate'}`, method: 'POST' }),
      invalidatesTags: ['Category', 'Audit'],
    }),

    // ---------- Proveedores ----------
    getSuppliers: build.query({
      query: (params) => ({ url: '/suppliers', params }),
      transformResponse: paginated,
      providesTags: ['Supplier'],
    }),
    createSupplier: build.mutation({
      query: (body) => ({ url: '/suppliers', method: 'POST', data: body }),
      invalidatesTags: ['Supplier', 'Audit'],
    }),
    updateSupplier: build.mutation({
      query: ({ id, ...body }) => ({ url: `/suppliers/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['Supplier', { type: 'Product', id: 'LIST' }, 'Audit'],
    }),
    setSupplierActive: build.mutation({
      query: ({ id, active }) => ({ url: `/suppliers/${id}/${active ? 'activate' : 'deactivate'}`, method: 'POST' }),
      invalidatesTags: ['Supplier', 'Audit'],
    }),

    // ---------- Productos ----------
    getProducts: build.query({
      query: (params) => ({ url: '/products', params }),
      transformResponse: paginated,
      providesTags: [{ type: 'Product', id: 'LIST' }],
    }),
    getProduct: build.query({
      query: (id) => ({ url: `/products/${id}` }),
      providesTags: (result, error, id) => [{ type: 'Product', id }],
    }),
    createProduct: build.mutation({
      query: (body) => ({ url: '/products', method: 'POST', data: body }),
      invalidatesTags: [{ type: 'Product', id: 'LIST' }, 'Category', 'Supplier', 'Audit'],
    }),
    updateProduct: build.mutation({
      // confirmBelowCost: el usuario confirmó un precio menor al costo (D-INV-10)
      query: ({ id, ...body }) => ({ url: `/products/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: (result, error, { id }) => [...productTags(id), 'Category', 'Supplier', 'PriceHistory'],
    }),
    setProductActive: build.mutation({
      query: ({ id, active }) => ({ url: `/products/${id}/${active ? 'activate' : 'deactivate'}`, method: 'POST' }),
      // El servidor puede avisar (desactivar con existencias): se devuelve junto con el producto
      transformResponse: (data, meta) => ({ product: data, message: meta?.message ?? null }),
      invalidatesTags: (result, error, { id }) => [...productTags(id), 'Category'],
    }),
    addPresentation: build.mutation({
      query: ({ productId, ...body }) => ({ url: `/products/${productId}/presentations`, method: 'POST', data: body }),
      invalidatesTags: (result, error, { productId }) => [...productTags(productId), 'PriceHistory'],
    }),
    updatePresentation: build.mutation({
      query: ({ productId, presentationId, ...body }) => ({ url: `/products/${productId}/presentations/${presentationId}`, method: 'PATCH', data: body }),
      invalidatesTags: (result, error, { productId }) => [...productTags(productId), 'PriceHistory'],
    }),
    setPresentationActive: build.mutation({
      query: ({ productId, presentationId, active }) => ({
        url: `/products/${productId}/presentations/${presentationId}/${active ? 'activate' : 'deactivate'}`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, { productId }) => productTags(productId),
    }),
    loadInitialStock: build.mutation({
      query: ({ productId, ...body }) => ({ url: `/products/${productId}/initial-stock`, method: 'POST', data: body }),
      invalidatesTags: (result, error, { productId }) => [...productTags(productId), 'Movement'],
    }),
    // Ajuste de existencia con motivo (D-INV-14)
    adjustStock: build.mutation({
      query: ({ productId, ...body }) => ({ url: `/products/${productId}/adjustments`, method: 'POST', data: body }),
      invalidatesTags: (result, error, { productId }) => [...productTags(productId), 'Movement'],
    }),
    getMovements: build.query({
      query: ({ productId, ...params }) => ({ url: `/products/${productId}/movements`, params }),
      transformResponse: paginated,
      providesTags: ['Movement'],
    }),
    getPriceHistory: build.query({
      query: (productId) => ({ url: `/products/${productId}/price-history` }),
      providesTags: ['PriceHistory'],
    }),

    // ---------- Documentos del producto (D-INV-18) ----------
    getProductDocuments: build.query({
      query: (productId) => ({ url: `/products/${productId}/documents` }),
      providesTags: (result, error, productId) => [{ type: 'ProductDocument', id: productId }],
    }),
    uploadProductDocument: build.mutation({
      query: ({ productId, file, documentType, title, expiresOn }) => {
        const data = new FormData()
        data.append('documentType', documentType)
        data.append('title', title)
        if (expiresOn) data.append('expiresOn', expiresOn)
        data.append('file', file)
        return { url: `/products/${productId}/documents`, method: 'POST', data }
      },
      invalidatesTags: (result, error, { productId }) => [{ type: 'ProductDocument', id: productId }, 'Audit'],
    }),
    removeProductDocument: build.mutation({
      query: ({ productId, documentId }) => ({ url: `/products/${productId}/documents/${documentId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { productId }) => [{ type: 'ProductDocument', id: productId }, 'Audit'],
    }),

    // ---------- Importación ----------
    importProducts: build.mutation({
      query: ({ file, dryRun }) => {
        const data = new FormData()
        data.append('file', file)
        return { url: '/products/import', method: 'POST', data, params: dryRun ? { dryRun: 'true' } : undefined }
      },
      invalidatesTags: (result, error, { dryRun }) => (dryRun ? [] : [{ type: 'Product', id: 'LIST' }, 'Category', 'Supplier', 'Audit']),
    }),
  }),
})

/** Abre un documento del producto en una pestaña nueva (lo descarga con la sesión). */
export async function openProductDocument(productId, documentId) {
  const response = await httpClient.get(`/products/${productId}/documents/${documentId}/file`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

/** Descarga la plantilla de Excel y la guarda con su nombre. */
export async function downloadImportTemplate() {
  const response = await httpClient.get('/products/import/template', { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = 'plantilla-productos-nexsupply.xlsx'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const {
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useSetCategoryActiveMutation,
  useGetSuppliersQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useSetSupplierActiveMutation,
  useGetProductsQuery,
  useGetProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useSetProductActiveMutation,
  useAddPresentationMutation,
  useUpdatePresentationMutation,
  useSetPresentationActiveMutation,
  useLoadInitialStockMutation,
  useAdjustStockMutation,
  useGetMovementsQuery,
  useGetPriceHistoryQuery,
  useImportProductsMutation,
  useGetProductDocumentsQuery,
  useUploadProductDocumentMutation,
  useRemoveProductDocumentMutation,
} = inventoryApi
