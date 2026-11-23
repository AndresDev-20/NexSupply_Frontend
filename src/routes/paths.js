// Direcciones de la aplicación. Están en español porque las ve el usuario
// en la barra del navegador y en los enlaces de los correos (decisión D-FRONT-6).
// El backend construye el enlace de recuperación con ROUTES.resetPassword:
// si se cambia aquí, hay que cambiarlo también en Backend/src/api/services/auth.service.js.
/** Ruta de un producto: productPath(12) → '/inventario/productos/12' */
export const productPath = (id) => `/inventario/productos/${id}`

/** Compra: purchasePath(12) → '/compras/12' (borrador: editor; confirmada: detalle) */
export const purchasePath = (id) => `/compras/${id}`
/** Compra con varios proveedores: purchaseGroupPath(3) → '/compras/grupos/3' */
export const purchaseGroupPath = (id) => `/compras/grupos/${id}`

/** Turno de caja: cashSessionPath(8) → '/caja/turnos/8' */
export const cashSessionPath = (id) => `/caja/turnos/${id}`

/** Inventario físico: inventoryCountPath(3) → '/inventario/conteos/3' */
export const inventoryCountPath = (id) => `/inventario/conteos/${id}`

/** Cotero: porterPath(3) → '/gastos/coteros/3' */
export const porterPath = (id) => `/gastos/coteros/${id}`

/** Cotización: quotePath(5) → '/ventas/cotizaciones/5' */
export const quotePath = (id) => `/ventas/cotizaciones/${id}`

/** Lista de precios: priceListPath(2) → '/clientes/listas-de-precios/2' */
export const priceListPath = (id) => `/clientes/listas-de-precios/${id}`

/** Cliente: customerPath(4) → '/clientes/4' */
export const customerPath = (id) => `/clientes/${id}`

export const ROUTES = Object.freeze({
  home: '/',
  login: '/iniciar-sesion',
  forgotPassword: '/recuperar-contrasena',
  resetPassword: '/restablecer-contrasena',
  changePassword: '/cambiar-contrasena',
  users: '/administracion/usuarios',
  roles: '/administracion/roles',
  branches: '/administracion/sucursales',
  audit: '/administracion/auditoria',
  businessSettings: '/configuracion/negocio',
  taxSettings: '/configuracion/impuestos',
  paymentMethods: '/configuracion/metodos-de-pago',
  units: '/configuracion/unidades',
  sequences: '/configuracion/consecutivos',
  backups: '/configuracion/copias-de-seguridad',
  products: '/inventario/productos',
  productDetail: '/inventario/productos/:id',
  categories: '/inventario/categorias',
  suppliers: '/inventario/proveedores',
  productImport: '/inventario/importar',
  bulkPrices: '/inventario/cambiar-precios',
  labels: '/inventario/etiquetas',
  cash: '/caja',
  cashSessions: '/caja/turnos',
  cashSession: '/caja/turnos/:id',
  cashHistory: '/caja/historial',
  cashRegisters: '/caja/cajas',
  purchases: '/compras',
  purchaseNew: '/compras/nueva',
  purchaseDetail: '/compras/:id',
  purchaseGroup: '/compras/grupos/:id',
  payables: '/compras/cuentas-por-pagar',
  reorder: '/compras/pedido-sugerido',
  batches: '/inventario/lotes',
  inventoryCounts: '/inventario/conteos',
  inventoryCount: '/inventario/conteos/:id',
  alertSettings: '/configuracion/avisos',
  salesSettings: '/configuracion/cotizaciones-y-apartados',
  appearanceSettings: '/configuracion/apariencia',
  pos: '/ventas/punto-de-venta',
  sales: '/ventas',
  customers: '/clientes',
  customerDetail: '/clientes/:id',
  receivables: '/cartera',
  priceLists: '/clientes/listas-de-precios',
  priceList: '/clientes/listas-de-precios/:id',
  layaways: '/apartados',
  layawayDetail: '/apartados/:id',
  quotes: '/ventas/cotizaciones',
  prescriptions: '/ventas/formulas',
  quoteDetail: '/ventas/cotizaciones/:id',
  saleReturns: '/ventas/devoluciones',
  quarantine: '/inventario/cuarentena',
  expenses: '/gastos',
  recurringExpenses: '/gastos/fijos',
  porters: '/gastos/coteros',
  porterDetail: '/gastos/coteros/:id',
  reports: '/informes',
  // Fase 18 (el backend enlaza aquí sus avisos)
  transfers: '/inventario/transferencias',
})
