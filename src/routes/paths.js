// Direcciones de la aplicación. Están en español porque las ve el usuario
// en la barra del navegador y en los enlaces de los correos (decisión D-FRONT-6).
// El backend construye el enlace de recuperación con ROUTES.resetPassword:
// si se cambia aquí, hay que cambiarlo también en Backend/src/api/services/auth.service.js.
/** Ruta de un producto: productPath(12) → '/inventario/productos/12' */
export const productPath = (id) => `/inventario/productos/${id}`

/** Compra: purchasePath(12) → '/compras/12' (borrador: editor; confirmada: detalle) */
export const purchasePath = (id) => `/compras/${id}`

/** Turno de caja: cashSessionPath(8) → '/caja/turnos/8' */
export const cashSessionPath = (id) => `/caja/turnos/${id}`

/** Inventario físico: inventoryCountPath(3) → '/inventario/conteos/3' */
export const inventoryCountPath = (id) => `/inventario/conteos/${id}`

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
  products: '/inventario/productos',
  productDetail: '/inventario/productos/:id',
  categories: '/inventario/categorias',
  suppliers: '/inventario/proveedores',
  productImport: '/inventario/importar',
  cash: '/caja',
  cashSessions: '/caja/turnos',
  cashSession: '/caja/turnos/:id',
  cashHistory: '/caja/historial',
  cashRegisters: '/caja/cajas',
  purchases: '/compras',
  purchaseNew: '/compras/nueva',
  purchaseDetail: '/compras/:id',
  payables: '/compras/cuentas-por-pagar',
  batches: '/inventario/lotes',
  inventoryCounts: '/inventario/conteos',
  inventoryCount: '/inventario/conteos/:id',
  alertSettings: '/configuracion/avisos',
  appearanceSettings: '/configuracion/apariencia',
  pos: '/ventas/punto-de-venta',
  sales: '/ventas',
  customers: '/clientes',
  customerDetail: '/clientes/:id',
  receivables: '/cartera',
  layaways: '/apartados',
  layawayDetail: '/apartados/:id',
  saleReturns: '/ventas/devoluciones',
  quarantine: '/inventario/cuarentena',
  expenses: '/gastos',
  recurringExpenses: '/gastos/fijos',
  reports: '/informes',
  // Fase 18 (el backend enlaza aquí sus avisos)
  transfers: '/inventario/transferencias',
})
