# NexSupply — Frontend

Aplicación web del sistema administrativo para agropecuaria NexSupply.

*Desarrollado por Nexoon.*

## Tecnologías

React 19 · Vite 8 · React Router DOM 7 · Redux Toolkit (RTK Query) · Axios · lucide-react · Plus Jakarta Sans · Vitest + Testing Library

## Inicio rápido

Requiere el backend corriendo en `http://127.0.0.1:4001` (ver [Backend/README.md](../Backend/README.md)).

```bash
npm install
npm run dev     # http://localhost:5173
npm test
```

Guía completa: [docs/INSTALACION_LOCAL.md](../docs/INSTALACION_LOCAL.md)

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente (puerto 5173) |
| `npm run build` | Compilación de producción en `dist/` |
| `npm run preview` | Sirve la compilación de producción (puerto 4173) |
| `npm run lint` | Revisión de código con ESLint |
| `npm test` | Pruebas (una corrida) |
| `npm run test:watch` | Pruebas en modo observación |

## Variables de entorno

Documentadas en [`.env.example`](.env.example). Solo las variables `VITE_*` llegan al navegador: **nunca** se ponen secretos en ellas.

| Variable | Por defecto | Uso |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | Ruta base de la API |
| `VITE_API_TIMEOUT_MS` | `15000` | Tiempo máximo de una petición |
| `VITE_DEV_API_TARGET` | `http://127.0.0.1:4001` | Solo desarrollo: destino del proxy de Vite |

## Estructura

```
src/
├── main.jsx                 # Punto de entrada: estilos globales + <App />
├── App.jsx                  # Provider de Redux + RouterProvider
├── app/
│   ├── store.js             # Store de Redux (makeStore para pruebas)
│   ├── router.jsx           # Árbol de rutas, carga diferida y página de error
│   └── navigation.js        # Entradas del menú lateral
├── routes/                  # paths.js, SessionGate, RequireAuth / PublicOnly
├── hooks/                   # useRouteTitle, usePermissions, useDebouncedValue
├── api/
│   ├── httpClient.js        # Instancia de Axios (cookies, cabecera anti-CSRF, errores normalizados)
│   ├── apiError.js          # Normaliza errores al formato { status, code, message, details, requestId }
│   └── baseApi.js           # RTK Query sobre Axios; cada módulo inyecta sus endpoints
├── config/env.js            # Lectura de variables VITE_*
├── features/                # Un módulo por funcionalidad
│   ├── auth/                # Sesión: authApi, authSlice, páginas de acceso, requisitos de contraseña
│   ├── admin/               # Usuarios (con documento y eliminación definitiva), roles, sucursales y auditoría
│   ├── settings/            # Configuración: negocio, logo, IVA, métodos de pago, unidades, consecutivos, tema
│   ├── inventory/           # Productos, categorías, proveedores, kárdex e importación desde Excel
│   ├── notifications/       # Campana de notificaciones
│   └── system/              # Inicio, estado del sistema, 404 y error
├── components/
│   ├── ui/                  # Button, IconButton, Spinner, TextField, PasswordField, SelectField, Checkbox,
│   │                        # Badge, Modal, ConfirmDialog, DataTable, Pagination, SecretValue
│   ├── layout/              # AppShell, Sidebar, Topbar, UserMenu, AuthLayout, PageHeader, FilterBar
│   ├── feedback/            # LoadingScreen, StatusMessage, Alert, Toast, WelcomeOverlay
│   └── brand/               # NexoonCredit ("Desarrollado por Nexoon")
├── styles/
│   ├── tokens.css           # Design tokens (colores, tipografía, espacios, temas)
│   ├── base.css             # Reset y elementos HTML
│   └── index.css            # Orden de importación
├── utils/format.js          # Formato de moneda (COP) y fechas (Bogotá)
├── assets/brand/            # Emblema optimizado de NexSupply
└── test/                    # Configuración y utilidades de pruebas
```

Cada componente vive en su carpeta con su `.jsx`, su `.css` y, cuando aplica, su `.test.jsx`.

## Estilos: BEM mobile-first (decisión D26)

- **CSS normal con BEM**: `bloque`, `bloque__elemento`, `bloque--modificador`. Un archivo `.css` por componente, importado desde el propio componente.
- **Mobile-first**: los estilos base son para celular; luego se agregan:

  ```css
  @media (min-width: 768px)  { /* tablet */ }
  @media (min-width: 1024px) { /* laptop */ }
  @media (min-width: 1440px) { /* escritorio grande */ }
  ```

- **Nunca colores directos** en los componentes: siempre variables de `tokens.css` (`var(--color-primary)`). Así funcionan el modo oscuro y los temas de temporada.
- Prohibidos los estilos en línea (`style={{…}}`).
- Animaciones con `var(--duration-*)`: se anulan solas con `prefers-reduced-motion`.

## Datos del servidor (RTK Query)

Cada módulo agrega sus endpoints al `baseApi`:

```js
// features/products/productsApi.js (ejemplo de cómo se hará en la Fase 5)
export const productsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProducts: build.query({ query: (params) => ({ url: '/products', params }) }),
  }),
})
```

- `data` contiene solo el campo `data` de la respuesta estándar de la API.
- Los errores llegan como `{ status, code, message, details, requestId }`; `message` ya está en español y se puede mostrar al usuario.

## Sesión y rutas protegidas

- Al abrir la aplicación, `SessionGate` consulta `/auth/me`. Sin sesión, cualquier ruta interna lleva a `/iniciar-sesion`.
- Si el token de acceso vence, `httpClient` renueva la sesión solo y repite la petición. Si no puede, vuelve al inicio de sesión con el aviso "Tu sesión expiró".
- Con cambio de contraseña pendiente, todo lleva a `/cambiar-contrasena`.
- Las direcciones están en `src/routes/paths.js`.
- **Para agregar una pantalla interna:** se declara como hija de `AppShell` en `src/app/router.jsx`; queda protegida automáticamente.

## Permisos en la interfaz

```jsx
const canCreate = useCan('users.create')        // ¿tiene el permiso?
const hasAudit = useHasFeature('audit')          // ¿el plan lo incluye?
{canCreate && <Button>Nuevo usuario</Button>}
```

Solo adapta lo que se ve: el backend vuelve a verificar cada petición. `canAccess` acepta un permiso o una lista (basta tener uno, como en Informes). Las pantallas se protegen con `guarded(...)` en `app/router.jsx` y el menú se filtra solo según `app/navigation.js`.

## Pantallas de acceso (Fase 2)

| Ruta | Sesión | Pantalla |
|---|---|---|
| `/iniciar-sesion` | Sin sesión | Usuario o correo y contraseña; con sesión redirige a Inicio |
| `/recuperar-contrasena` | Sin sesión | Pide el correo; la respuesta es la misma exista o no (no revela usuarios) |
| `/restablecer-contrasena#token=…` | Sin sesión | Enlace del correo: nueva contraseña. El token va en `#` para que no llegue a los registros del servidor |
| `/cambiar-contrasena` | Con sesión | Obligatoria si la contraseña es temporal (todo lo demás redirige aquí) |

## Administración (Fase 3)

| Ruta | Permiso | Pantalla |
|---|---|---|
| `/administracion/usuarios` | `users.view` | Usuarios: crear, editar, activar, restablecer contraseña. Nadie administra a alguien con más permisos que él (Fase 16) |
| `/administracion/roles` | `roles.view` | Roles y permisos. Nadie da permisos que no tiene ni edita su propio rol (Fase 16) |
| `/administracion/sucursales` | `branches.view` | Sucursales (una en el plan básico) |
| `/administracion/auditoria` | `audit.view` (funcionalidad `audit`) | Quién hizo qué, cuándo y qué cambió |

## Componentes de administración

| Componente | Uso |
|---|---|
| `DataTable` | Tabla desde 1280 px; tarjetas por debajo. Estados de carga, error y vacío incluidos |
| `Modal` / `ConfirmDialog` | Ventanas accesibles (foco atrapado, Escape). En celular suben como hoja inferior |
| `Pagination` | Usa el `meta` de la API |
| `Stepper` | Pasos de un formulario largo ("Persona → Acceso") |
| `FormSection` | Grupo de campos con ícono, título y descripción; dos columnas desde tablet |
| `FormWithPreview` | Formulario + vista previa en vivo a la derecha (desde 1024 px) |
| `useToast()` | `toast.success(…)`, `toast.error(…)` |

**Patrón de formulario (D-FRONT-10):** `Modal` con `icon` y `size="xl"` → `FormWithPreview` → `Stepper` (si hay pasos) → `FormSection`(s). Los campos con `required` muestran el asterisco solos. Ejemplos: `features/admin/users/UserFormModal.jsx`, `roles/RoleFormModal.jsx`, `branches/BranchFormModal.jsx`.

## Configuración (Fase 4)

| Ruta | Permiso | Pantalla |
|---|---|---|
| `/configuracion/negocio` | `settings.update` | Datos del negocio, logo, comprobante y envío por correo |
| `/configuracion/impuestos` | `settings.tax` | IVA y redondeo |
| `/configuracion/metodos-de-pago` | `payment_methods.manage` | Métodos de pago |
| `/configuracion/unidades` | `units.manage` | Unidades de medida |
| `/configuracion/consecutivos` | `document_sequences.manage` | Consecutivos |

| Pieza | Uso |
|---|---|
| `features/settings/settingsApi.js` | Endpoints de la fase y `logoUrl(logo)` |
| `features/settings/useSettingsForm.js` | Estado de una pantalla de ajustes: `values`, `setValue`, `changedKeys`, `save()`, `discard()`, `fieldErrors` por clave |
| `features/settings/useThemePreference.js` | Tema del usuario: `{ theme, setTheme }` |
| `features/settings/BusinessBrand.jsx` | Logo y nombre del negocio (pantalla de inicio de sesión) |
| `components/ui/Switch` | Interruptor para ajustes booleanos |
| `components/ui/OptionCards` | Opciones excluyentes como tarjetas (radios) |
| `components/ui/TextAreaField` | Texto largo con contador |
| `components/ui/SaveBar` | Barra de "cambios sin guardar" |

**Usar un ajuste en otra pantalla** (ej. el POS): `const { data } = useGetSettingsQuery()` y leer `data.values['rounding.increment']`.

## Inventario (Fase 5)

| Ruta | Permiso | Pantalla |
|---|---|---|
| `/inventario/productos` | `inventory.view` | Lista con búsqueda (nombre, código, código de barras) y filtros |
| `/inventario/productos/:id` | `inventory.view` | Ficha: resumen, presentaciones, proveedores, kárdex, historial de precios |
| `/inventario/categorias` | `categories.manage` | Árbol de categorías y subcategorías |
| `/inventario/proveedores` | `suppliers.view` | Proveedores (registrar y editar con `suppliers.manage`) |
| `/inventario/importar` | `inventory.import` | Plantilla, revisión y carga desde Excel |

| Pieza | Uso |
|---|---|
| `features/inventory/inventoryApi.js` | Endpoints de la fase y `downloadImportTemplate()` |
| `features/inventory/inventoryOptions.js` | Tarifas de IVA, políticas de vencidos, `toApiNumber()` / `toInputNumber()` |
| `features/inventory/products/useBelowCostConfirmation.js` | Flujo de confirmación de precio bajo el costo |
| `features/inventory/categories/categoryOptions.js` | Árbol de categorías → opciones "Alimentos › Cerdos" |
| `features/inventory/categories/CategoryPicker.jsx` | Selector de categoría con buscador y dos niveles (formulario de producto y filtro) |
| `features/inventory/categories/categoryVisuals.js` · `CategoryBadge.jsx` · `categoryTones.css` | Ícono y color por categoría y por especie (solo visual) |
| `features/inventory/products/profitPreview.js` | Vista previa de la ganancia (solo lectura) y del precio del bulto con enteros (`BigInt`); el valor oficial lo da el backend (D-INV-13) |
| `features/inventory/products/AdjustStockModal.jsx` | Ajuste de existencia con motivo, en kg o en bultos (`inventory.adjust`, D-INV-14) |
| `components/ui/Tabs` | Pestañas accesibles |
| `utils/format.js` | `formatQuantity("12.500")` → "12,5"; `formatPercent("23.81")` → "23,8 %" |
| `utils/identityDocument.js` | Cédula, NIT y teléfono (usuarios y proveedores) |

## Caja (Fase 6, rediseñada)

| Ruta | Permiso | Pantalla |
|---|---|---|
| `/caja` | `cash.view` | Mis cajas de hoy: tarjetas con el efectivo, la línea de vida y la acción que toca; turnos por recibir |
| `/caja/turnos` | `cash.view` | Turnos con filtro por estado: ver, cerrar, contar y recibir |
| `/caja/turnos/:id` | `cash.view` | Turno: avance, efectivo, medios de pago, movimientos y arqueo imprimible |
| `/caja/historial` | `cash.view` | Cuadre por día, mes o año |
| `/caja/cajas` | `cash.manage` | Cajas (base del día, horario, automática) y días sin abrir |

| Pieza | Uso |
|---|---|
| `features/cash/cashApi.js` | Endpoints de cajas y turnos |
| `features/cash/cashOptions.js` | Estado visible de un turno, horario, tipos de movimiento y `differenceInfo()` |
| `features/cash/OpeningCountModal.jsx` | Abrir turno o confirmar la base de una caja abierta por el sistema |
| `features/cash/sessions/CountSessionModal.jsx` | Contar la caja en dos pasos (contar y confirmar) |
| `features/cash/sessions/SessionActions.jsx` | Diálogos de cerrar turno, contar y recibir, compartidos por las pantallas |
| `features/cash/useSessionPermissions.js` | Qué acciones puede hacer el usuario con un turno |
| `features/cash/Lifecycle.jsx` | Línea de vida: Abierto → Cerrado → Contado → Recibido |
| `utils/moneyPreview.js` | Cuentas de vista previa con enteros (`previewSubtract`); usadas por la ganancia y el arqueo |
| `utils/numberInput.js` | `toApiNumber`, `toInputNumber`, `toInputMoney` ("150000.00" → "150.000") y patrones |

## Compras (Fase 7)

| Ruta | Permiso | Pantalla |
|---|---|---|
| `/compras` | `purchases.view` | Compras con filtros por estado, proveedor y pago |
| `/compras/nueva` | `purchases.create` | Editor de una compra a un solo proveedor (botón «Compra a un proveedor») |
| `/compras/grupos/:id` | `purchases.view` | Compra con varios proveedores (D-COMP-9): cada proveedor con sus productos y su total, total de todo y «Revisar y confirmar» por proveedor |
| `/compras/:id` | `purchases.view` | Borrador: editor (con `purchases.create`). Confirmada o anulada: detalle con pagos |
| `/compras/cuentas-por-pagar` | `purchases.view` | Saldo por proveedor, estado de cuenta y compras por pagar |
| `/inventario/lotes` | `inventory.view` (+ plan `purchases`) | Lotes por vencer y vencidos |

| Pieza | Uso |
|---|---|
| `features/purchases/purchasesApi.js` | Endpoints de compras, compras agrupadas (`/purchase-groups`), pagos, cuentas por pagar y lotes; `openPurchaseAttachment()` |
| `features/purchases/groups/` | `NewPurchaseGroupModal` («Nueva compra») y `PurchaseGroupPage` (detalle de una compra con varios proveedores) |
| `features/inventory/products/ProductFormModal.jsx` | Nuevo y editar producto. «¿Cómo lo compras?» (suelto o en empaque, D-INV-20), «Empaque y cantidad» y «¿A qué compra va?» (D-COMP-9) |
| `features/cash/DenominationCounter.jsx` · `denominations.js` · `sessions/CashClosingPaper.jsx` | Conteo por billetes y monedas e informe de cierre impreso (D-CAJA-14); reabrir turno en `CashSessionPage.jsx` (D-CAJA-15) |
| `features/reports/AccountingBook.jsx` | Libro para el contador (D-CON-1), arriba en Informes |
| `features/expenses/porters/` | Coteros (D-CTR-1): lista, ficha con viajes y pagos, modales de cotero, viaje y pago; «Lo lleva un cotero» está en `SaleReceiptModal.jsx` |
| `features/inventory/labels/` | Etiquetas con código de barras (D-INV-21) en hoja carta; `Barcode.jsx` usa JsBarcode |
| `features/sales/PrescriptionsPage.jsx` | Libro de fórmulas veterinarias (D-VET-1); los campos de la fórmula están en `CheckoutPanel.jsx` |
| `features/purchases/reorder/ReorderPage.jsx` | Pedido sugerido al proveedor (D-COMP-10): cantidades editables, compra en borrador y WhatsApp |
| `features/quotes/` | Cotizaciones (D-COT-1): lista, ficha con PDF, WhatsApp, correo, Vender y Anular; el modo «Cotizar» está en `CheckoutPanel.jsx` y la carga de una cotización en `PosPage.jsx` |
| `features/settings/backups/` | Copias de seguridad (D-SEG-1): estado, lista, descargar y «Sacar copia ahora» |
| `features/inventory/products/BulkPricesPage.jsx` | Cambiar precios en bloque (D-PRE-2): filtros, % o $, vista previa, desmarcar y aplicar |
| `features/customers/priceLists/` | Precios por tipo de cliente (D-PRE-1): Listas de precios, detalle con precios especiales, `priceListOptions.js` (vista previa del precio de la lista) |
| `features/sales/pos/PosPriceList.jsx` | Franja del punto de venta con la lista de la venta; con `sales.change_price_list`, selector para cambiarla |
| `features/inventory/products/AnimalLots.jsx` · `animalPricing.js` | Animales (D-ANI-1): pestaña Lotes, Recibir lote, Registrar muerte, Corregir precio y vista previa del precio que sube cada día |
| `features/purchases/detail/PurchaseEditor.jsx` | Editor del borrador (buscador, líneas, lotes, resumen y cálculo del sistema) |
| `features/purchases/detail/ConfirmPurchaseModal.jsx` | Confirmar de contado o a crédito |
| `features/purchases/detail/PaymentFields.jsx` · `paymentHelpers.js` | Método, referencia y caja de un pago a proveedor |
| `features/purchases/detail/PurchaseModals.jsx` | Registrar pago y modal de motivo (anular compra o pago) |
| `features/inventory/products/BatchesTab.jsx` | Pestaña de lotes del producto |
| `utils/moneyPreview.js` | `previewMultiply` y `previewSum` para el subtotal en vivo de las líneas |

## Ventas y punto de venta (Fase 10)

| Ruta | Permiso | Pantalla |
|---|---|---|
| `/ventas/punto-de-venta` | `sales.create` (+ `cash.view` para escoger el turno) | Punto de venta: caja, cliente, buscador/escáner, carrito, totales del servidor, cobro (F2), autorización y comprobante |
| `/ventas` | `sales.view` | Historial con resumen del periodo (ventas, vendido, fiado y utilidad con `inventory.cost_view`) y comprobante de cada venta |

Cómo funciona el punto de venta:
- **Buscador / escáner:** el lector escribe el código y envía Enter; con un solo resultado el producto entra al carrito (con la presentación del código si es la de un bulto). Al escribir se listan coincidencias; ↑ ↓ y Enter para agregar.
- **Totales:** cada cambio del carrito pide `POST /sales/preview` (300 ms después): IVA, redondeo y descuentos los calcula el servidor; la pantalla avisa si se pedirá autorización.
- **Orden de la pantalla:** arriba caja y cliente; a la izquierda "Buscar o escanear"; a la derecha "Venta" con productos, totales y la sección **Pago** siempre visible.
- **Cobro:** contado (métodos como botones; efectivo con "Recibido", valores rápidos y cambio grande; o varios métodos) o fiado (paga una parte o nada; el resto en abonos libres o cuotas). F2 o "Cobrar $X" registra. La clave de idempotencia se crea con cada venta nueva y se conserva en los reintentos.
- **Autorización:** si el servidor responde `AUTHORIZATION_REQUIRED`, se abre la clave de supervisor y la venta se reintenta sola con el código de un solo uso.
- **Comprobante:** 58 mm, 80 mm o carta según la configuración; Imprimir (solo el comprobante), PDF, WhatsApp y correo (si está activado).
- El turno escogido se recuerda en ese equipo (`localStorage`).

| Pieza | Uso |
|---|---|
| `features/sales/salesApi.js` | Endpoints de ventas; `openSalePdf()` |
| `features/sales/pos/PosPage.jsx` | Punto de venta |
| `features/sales/pos/PosSearch.jsx` · `PosCart.jsx` · `PosCustomer.jsx` | Buscador/escáner, carrito y cliente |
| `features/sales/pos/CheckoutPanel.jsx` · `AuthorizationModal.jsx` | Sección Pago y clave de supervisor |
| `features/sales/pos/useAnimatedNumber.js` | Total y cambio que "cuentan" (respeta el movimiento reducido) |
| `features/sales/SaleReceiptModal.jsx` | Comprobante (imprimir, PDF, WhatsApp, correo) |
| `features/sales/SalesPage.jsx` | Historial |
| `features/sales/saleOptions.js` | Clave de idempotencia y turno del equipo |
| `features/sales/shareReceipt.js` | Envía el PDF del comprobante por WhatsApp con "Compartir" (D-VEN-11) |

En **Roles** se edita el tope de descuento de cada rol (paso Información).

## Apariencia, temporadas y atajos (Fase 15)

- **Paletas** (`styles/palettes.css`): Campo (la original), Bosque, Cosecha, Río y Tierra. Cada una redefine las escalas de marca (`--palette-green-*`, `--palette-yellow-*`) y los tintes del modo oscuro (`--dark-*`); los colores de estado (éxito, advertencia, peligro, información) son fijos y no cambian. Se aplica con `data-palette` en `<html>` (`features/settings/appearance.js`); una copia queda en el navegador para pintarla antes de la primera pantalla.
- **Configuración > Apariencia** (`/configuracion/apariencia`, `settings.update`): escoger paleta con vista previa en vivo (al salir sin guardar vuelve la guardada) e interruptor de adornos, con el calendario de temporadas.
- **Adornos de temporada** (`components/brand/Seasonal`): guirnalda en SVG (luces, estrellas, corazones, banderines, flores) en la bienvenida del dashboard, el inicio de sesión y el menú, más el mensaje de la temporada. La temporada llega en `/branding`. No reciben clics, los lectores de pantalla los ignoran y no se animan si el sistema pide menos movimiento.
- **Transiciones y carga:** cada pantalla entra con una animación suave (`AppShell`). `components/ui/Skeleton` (`Skeleton`, `TableSkeleton`, `CardsSkeleton`, `PageSkeleton`) reemplaza el círculo girando en tablas, configuración, dashboard y carga de pantallas.
- **Atajos de teclado** (`app/shortcuts.js`, `hooks/useGlobalShortcuts.js`): `g` y una letra para ir a una pantalla (i Inicio, v Punto de venta, s Ventas, a Apartados, p Productos, o Compras, c Caja, k Clientes, e Gastos, n Informes), solo si la persona puede entrar; `?` abre la ayuda (también el botón del teclado en la barra superior, desde laptop). No funcionan mientras se escribe en un campo ni con una ventana abierta.

## Dashboard (Fase 14)

La ruta `/` (Inicio) muestra el dashboard si el plan incluye `dashboard`; si no, la bienvenida con el estado del sistema (Fase 1). Recharts se descarga solo al abrir el dashboard.

- **Arriba:** saludo, fecha, estado del servidor (punto verde o rojo), botones Hoy / Semana / Mes / Año, hora del último dato y "Actualizar". Se refresca solo cada 5 minutos y al volver a la pestaña (D-DASH-5).
- **Cifras:** ventas (vendido, número, promedio, fiado) y ganancias (bruta, gastos, neta) con su variación contra el periodo anterior. Verde si mejora, rojo si empeora; en gastos subir es malo; el fiado va en gris.
- **Gráficas:** ventas con el periodo anterior punteado; ingresos frente a costo y gastos (no en "Hoy"); dona de ventas por categoría.
- **Paneles:** "Requiere atención" (solo avisos con algo pendiente, cada uno lleva a su pantalla), más vendidos, cajas (o "Mi caja") y por cobrar / por pagar.
- Solo se dibuja lo que manda el servidor: cada bloque llega `null` si la persona no tiene permiso.

| Pieza | Uso |
|---|---|
| `features/dashboard/dashboardApi.js` | `useGetDashboardQuery(period)` |
| `features/dashboard/DashboardPage.jsx` | Página: bienvenida, periodos y bloques |
| `features/dashboard/DashboardCharts.jsx` | Gráficas con Recharts; los colores salen de los tokens del tema (claro/oscuro) |
| `features/dashboard/DashboardWidgets.jsx` | Tarjetas de cifras, avisos, más vendidos, cajas y saldos |
| `features/dashboard/dashboardOptions.js` | Periodos, nombres de horas/días/meses, saludo y `plot()` (texto → número solo para dibujar) |

## Informes (Fase 13)

| Ruta | Permiso | Pantalla |
|---|---|---|
| `/informes` | cualquiera de `reports.sales`, `reports.profit`, `reports.inventory`, `reports.cash`, `reports.purchases_expenses`, `reports.receivables` | Tarjetas por área con los informes permitidos. `?informe=clave` abre uno |

- **Un informe:** atajos de periodo, filtros (fechas, categoría, vendedor, proveedor, caja, días, orden, estado) según lo que el informe acepta, tarjetas de resumen, tabla con totales.
- **Excel y PDF** (`reports.export`): solo aparecen si el catálogo los marca para ese usuario.
- Los errores del servidor (por ejemplo, más de 5.000 filas) se muestran con "Reintentar".

| Pieza | Uso |
|---|---|
| `features/reports/reportsApi.js` | Catálogo, opciones de filtros, datos; `downloadReport()` guarda el archivo |
| `features/reports/ReportsPage.jsx` | Centro de informes por área |
| `features/reports/ReportView.jsx` | Pantalla genérica de un informe (filtros, resumen, tabla, descargas) |
| `features/reports/reportOptions.js` | Ícono y color por área, formato de celdas y atajos de fechas |

## Avisos de la licencia de NexCore (N2)

- **De dónde sale:** `/auth/me` trae `plan.license` (`source`, `status`, `readOnly`, `readOnlyReason`, `graceUntil`, `trialDaysLeft`, `offline`). Con NexCore apagado (`source: 'env'`) no hay avisos.
- **Qué aviso y a quién:** `features/auth/licenseNotice.js`. Solo lectura (suspendida, cancelada, terminó la prueba o sin conexión demasiado tiempo): para todos, en rojo y sin botón para cerrar. Pago pendiente, días de prueba y sin conexión con gracia: solo para administradores y soporte, y se pueden ocultar durante la sesión del navegador.
- **Dónde:** `components/layout/LicenseBanner`, arriba del contenido en `AppShell`. Con NexCore activo vuelve a pedir `/auth/me` cada 30 minutos: si NexCore cambia la licencia, la pantalla se entera sin recargar.
- **Solo lectura:** la interfaz no necesita lógica aparte: el backend quita los permisos de escritura y los botones de crear o editar desaparecen solos. Si algo se intenta igual, el backend responde `LICENSE_READ_ONLY` con el mensaje.
- **Límite de sucursales:** "Tu plan Básico permite 1 sucursal. Para agregar más, contacta a Nexoon."

## Consolidado y cartera multisede (Fase 19, plan intermedio)

- **Selector «Esta sucursal / Todas»:** `components/layout/BranchScopeToggle`. Solo aparece si el plan incluye la funcionalidad (`consolidated_reports` en informes y dashboard, `multi_branch` en Cartera) y la persona entra a más de una sucursal (`useCanSeeAllBranches` en `branchScope.js`). `branchParams(scope)` agrega `branch=all` a la petición.
- **Informes:** el selector va al inicio de los filtros; la descarga usa los mismos parámetros. Con «Todas» el pie dice qué sucursales se sumaron. «Ventas y ganancia por sede» abre de una vez con «Todas».
- **Dashboard:** el selector va junto a los periodos; con «Todas» aparece el panel «Comparación por sucursal» (`BranchesPanel`) y cada turno de caja dice su sucursal.
- **Cartera:** «Todas» en las deudas y en el resumen, con la columna Sucursal. El estado de cuenta del cliente muestra la sucursal de cada movimiento cuando hay más de una, y el recibo de un abono dice de qué sucursal era cada deuda que bajó.
- **Pruebas:** `testTimeout` de 15 s (las pruebas largas de pantallas pasaban de 5 s con toda la suite a la vez) y `restoreApi()` deja la red "sin conexión" en vez de restaurar las peticiones reales.

## Transferencias entre sedes (Fase 18, plan intermedio)

- **Pantalla:** `features/transfers/TransfersPage.jsx` en `/inventario/transferencias` (menú Inventario → Transferencias). Solo con la funcionalidad `branch_transfers` y alguno de `transfers.view`, `.send` o `.receive`. Pestañas: Por recibir, Enviadas, Recibidas y Todas, con el resumen de lo que espera la sede.
- **Enviar:** `SendTransferModal`. Las sedes de destino salen de `GET /transfers/destinations` (no exige administrar sucursales). Los productos se agregan con el buscador de compras; cada línea propone la presentación más grande y muestra lo disponible (existencia − apartado). Los lotes salen solos por FEFO. Una clave `idempotencyKey` por formulario evita el doble envío.
- **Detalle y recibir:** `TransferDetailModal`. Recibir empieza con "todo llegó bien"; si lo bueno más lo dañado no da lo enviado, muestra el faltante y pide el motivo. Las cantidades van en la misma presentación del envío.
- **Anular:** solo lo enviado por la sede activa que sigue en camino, con `ReasonModal`.
- **Cuarentena:** la columna "Viene de" muestra la devolución o la transferencia.

## Varias sucursales (Fase 17)

- **Sucursal activa:** `features/auth/authSlice.js` guarda `branches` (las que llegan en `/auth/me` y el login) y `activeBranchId`. Al abrir sesión se usa la escogida en esta pestaña (`features/auth/activeBranch.js`, `sessionStorage`), si sigue disponible; si no, la principal del usuario.
- **Cabecera:** `httpClient` agrega `X-Branch-Id` a cada petición (menos las de `/auth`). El store le da la sucursal con `setBranchProvider` en `app/store.js`. El backend verifica el acceso en cada petición: la cabecera es solo la elección del usuario.
- **Selector:** `components/layout/BranchSwitcher`, en la barra superior. Solo aparece con dos o más sucursales (en el plan básico no se ve). Pide confirmación, despacha `selectBranch` (borra el caché de RTK Query) y `AppShell` vuelve a montar la pantalla y la barra con la sucursal nueva: lo no guardado se pierde.
- **Usuarios:** el formulario envía `branchId` (principal) y `branchIds` (otras) solo si hay varias sucursales. Las sucursales a las que quien edita no entra salen bloqueadas; con un rol del sistema no se escogen (entra a todas). La lista filtra por sucursal (`?branchId=`, también desde el botón de Sucursales).

## Doble registro (Fase 16)

Los formularios que crean dinero (venta, apartado, devolución, abono y gasto) mandan `idempotencyKey`, generada con `utils/idempotencyKey.js` una vez por formulario abierto: un doble clic o un reintento devuelven el mismo registro en vez de crear otro.

## Gastos (Fase 12)

| Ruta | Permiso | Pantalla |
|---|---|---|
| `/gastos` | `expenses.view` | Resumen del periodo (gastado, número, salió de la caja, sin soporte), barras "¿En qué se fue la plata?" por categoría, filtros y lista. Aviso si hay gastos fijos por pagar |
| `/gastos/fijos` | `expenses.view` | Tarjetas de gastos fijos: pagado este mes, "¡Toca pagarlo!" o pendiente. "Registrar pago" abre el formulario lleno |

- **Registrar gasto** (`expenses.create`): categoría, fecha, descripción, beneficiario, valor y método. Con efectivo aparece **"Salió de la caja"** (escoge el turno). Los soportes se eligen en el mismo formulario y se suben al guardar.
- **Detalle** (clic en el número): datos, soportes (ver con la sesión, adjuntar, quitar), **Editar** (el valor y el método se bloquean si salió de la caja) y **Anular**.
- **Categorías** (`expenses.manage`): crear, renombrar y activar o desactivar, desde el botón "Categorías".
- Cada categoría tiene un color fijo (`categoryTone`) en la lista, el resumen y los gastos fijos.

| Pieza | Uso |
|---|---|
| `features/expenses/expensesApi.js` | Endpoints; `openExpenseAttachment()` |
| `features/expenses/ExpensesPage.jsx` · `RecurringExpensesPage.jsx` | Gastos y gastos fijos |
| `features/expenses/ExpenseFormModal.jsx` · `ExpenseDetailModal.jsx` | Registrar o editar, y detalle con soportes |
| `features/expenses/ExpenseCategoriesModal.jsx` | Categorías |
| `features/expenses/expenseOptions.js` | Archivos aceptados, colores de categoría y nombre del mes |

## Devoluciones, anulaciones y cuarentena (Fase 11)

| Ruta | Permiso | Pantalla |
|---|---|---|
| `/ventas` | `sales.view` | Cada venta tiene **Devolver** (si queda algo por devolver) y **Anular** (si no tiene devoluciones y no es entrega de apartado). Sin el permiso propio, quien vende puede hacerlo con la clave de un supervisor |
| `/ventas/devoluciones` | `sales.view` | Devoluciones con resumen (número, valor, dinero devuelto, saldo a favor) y su comprobante |
| `/inventario/cuarentena` | `inventory.view` (decidir: `inventory.quarantine`) | Producto en cuarentena: "Vuelve a la venta" o "Dar de baja" |

- **Devolver:** se escoge cuánto de cada producto (con −/+), si vuelve a la venta o va a cuarentena, el motivo y cómo se reintegra (dinero desde la caja o saldo a favor; en fiado primero baja la deuda). El valor que se ve es aproximado: el oficial lo calcula el servidor.
- **Clave de supervisor:** si el servidor responde `AUTHORIZATION_REQUIRED` (sin permiso, fuera del plazo o anular sin permiso), se abre la ventana de la clave y se reintenta solo con la misma clave de la devolución.
- **Comprobantes:** el de devolución (franja ámbar) se imprime en tirilla; el de una venta anulada muestra "Venta anulada".

| Pieza | Uso |
|---|---|
| `features/returns/returnsApi.js` | Endpoints de devoluciones, anulación y cuarentena |
| `features/returns/ReturnModals.jsx` | Devolver (`ReturnModal`) y anular (`CancelSaleModal`) |
| `features/returns/ReturnReceipt.jsx` | Comprobante de devolución (tirilla) |
| `features/returns/SaleReturnsPage.jsx` · `QuarantinePage.jsx` | Lista de devoluciones y cuarentena |

## Apartados y saldo a favor (Fase 10b)

| Ruta | Permiso | Pantalla |
|---|---|---|
| `/ventas/punto-de-venta` | `layaways.create` | En "Pago", la opción **Apartar**: cliente obligatorio, abono inicial con su mínimo (`GET /layaways/terms`), abonos libres o cuotas. Al apartar abre el comprobante de apartado |
| `/apartados` | `layaways.view` | Lista con resumen (pagando, vencidos, por entregar, falta por cobrar), filtros por estado y barra de avance de pago |
| `/apartados/:id` | `layaways.view` | Detalle: productos, abonos, plazo o cuotas. Acciones: Abonar, Entregar (abre el comprobante de la venta), Ampliar plazo, Cancelar (reparte lo abonado) y Comprobante de apartado |

- **Saldo a favor:** `usePaymentMethodInfo(id, { creditBalance })` solo incluye "Saldo a favor" cuando el cliente tiene saldo (nunca en compras). Aparece en el cobro del punto de venta, en "Recibir abono" y en el abono de un apartado; el cliente muestra su saldo en el punto de venta y una pestaña "Saldo a favor" con el historial.
- **Cliente:** pestaña "Apartados" con los del cliente.
- **Comprobante de apartado:** tirilla con el mismo diseño del comprobante de venta (lo apartado, lo abonado, lo que falta y la fecha límite). La venta de una entrega dice "Pagado con abonos del apartado APA-…".

| Pieza | Uso |
|---|---|
| `features/layaways/layawaysApi.js` | Endpoints de apartados y del saldo a favor |
| `features/layaways/LayawaysPage.jsx` · `LayawayPage.jsx` | Lista y detalle |
| `features/layaways/LayawayModals.jsx` | Abonar, Entregar (con clave de supervisor si se venció), Ampliar plazo y Cancelar |
| `features/layaways/LayawayReceiptModal.jsx` · `LayawayReceiptPaper.jsx` | Comprobante de apartado (imprimir en tirilla) |
| `features/layaways/CustomerLayawayTabs.jsx` | Pestañas "Apartados" y "Saldo a favor" del cliente |
| `features/sales/pos/CheckoutPanel.jsx` | Modo "Apartar" y `PlanFields` (abonos libres o cuotas, compartido con el fiado) |

## Clientes y cartera (Fase 9)

| Ruta | Permiso | Pantalla |
|---|---|---|
| `/clientes` | `customers.view` | Clientes con lo que deben (con `receivables.view`), resumen de cartera, filtros con deuda, vencidos, cumpleaños próximos e inactivos. Nuevo cliente: `customers.manage` |
| `/clientes/:id` | `customers.view` | Ficha: datos, edad, cumpleaños, cuenta (debe, vencido, cupo), deudas con sus cuotas, abonos con recibo y estado de cuenta. Registrar deuda (`receivables.create`), recibir abono (`receivables.collect`), anular abono (`receivables.cancel_payment`), recordar por WhatsApp |
| `/cartera` | `receivables.view` | Deudas por cobrar, vencidas, pagadas y anuladas; abonos recibidos con su recibo |

Avisos en el escritorio con sonido (D-CLI-8): en la campana, cada equipo activa los avisos de Windows (pide el permiso del navegador) y el sonido; la preferencia se guarda en ese navegador (`localStorage`). Cuando sube el contador de la campana se buscan los avisos nuevos y se muestran (máximo 3 a la vez). Funciona mientras NexSupply esté abierto, aunque esté minimizado.

| Pieza | Uso |
|---|---|
| `features/customers/customersApi.js` | Endpoints de clientes, cartera y abonos |
| `features/customers/CustomersPage.jsx` · `CustomerPage.jsx` · `ReceivablesPage.jsx` | Pantallas |
| `features/customers/CustomerFormModal.jsx` | Crear y editar un cliente |
| `features/customers/DebtModal.jsx` | Saldo inicial: abonos libres o cuotas calculadas y editables (la suma se revisa en vivo) |
| `features/customers/PaymentModal.jsx` | Recibir abono: deuda automática o escogida, "Lo vencido" / "Todo", turno de caja en efectivo |
| `features/customers/PaymentReceiptModal.jsx` | Recibo del abono: imprimir (solo el recibo, 80 mm) y enviar por WhatsApp |
| `features/customers/customerOptions.js` | Estados, cumpleaños y enlaces `wa.me` (celulares de 10 dígitos con 57) |
| `features/notifications/desktopAlerts.js` | Preferencias, permiso, sonido (Web Audio, sin archivos) y notificación del sistema |

## Inventario avanzado (Fase 8)

| Ruta | Permiso | Pantalla |
|---|---|---|
| `/inventario/conteos` | `inventory.view` | Inventarios físicos: el que está en conteo (con su avance) y el historial por estado. Abrir uno: `inventory.count` |
| `/inventario/conteos/:id` | `inventory.view` | Contar (`inventory.count`): buscar o escanear, escribir lo contado en la unidad o en bultos, corregir o sumar. Diferencias en unidades y en pesos (`inventory.cost_view`). Aplicar o anular: `inventory.count_apply` |
| `/configuracion/avisos` | `settings.update` | Días de aviso de lotes, documentos y cuentas por pagar; resumen diario de existencias bajas |

En la ficha del producto: pestañas **Ficha veterinaria** (productos de categorías veterinarias) y **Documentos** (ver con `inventory.view`; agregar y quitar con `inventory.update`); insignias "Veterinario" y "Requiere fórmula". El formulario del producto agrega el paso **Ficha veterinaria** cuando la categoría (o su categoría principal) es veterinaria. El ajuste de salida de un producto con lotes permite escoger el lote. La categoría principal tiene el interruptor "Categoría veterinaria"; la subcategoría lo hereda.

| Pieza | Uso |
|---|---|
| `features/inventory/counts/countsApi.js` | Endpoints del inventario físico |
| `features/inventory/counts/CountsPage.jsx` | Lista, banner del conteo en curso y modal para abrir uno |
| `features/inventory/counts/CountPage.jsx` | Detalle: avance, resumen, filtros, búsqueda/escáner, aplicar y anular |
| `features/inventory/counts/CountRowEditor.jsx` | Casilla de conteo de cada producto (Enter = guardar; "+" = sumar; "×" = quitar) |
| `features/inventory/counts/countOptions.js` | Filtros, estados y formato de diferencias (`+2`, `−5`) |
| `features/inventory/products/VeterinaryTab.jsx` | Ficha veterinaria (solo lectura) |
| `features/inventory/products/DocumentsTab.jsx` | Documentos: lista, agregar (PDF/JPG/PNG, 5 MB), ver y quitar |
| `features/settings/alerts/AlertSettingsPage.jsx` | Configuración → Avisos |

## Pruebas

`src/test/setup.js` trae un `ResizeObserver` vacío porque jsdom no lo tiene y Recharts lo usa.

**Accesibilidad:** `src/test/axe.js` corre axe-core (solo en pruebas) con las reglas WCAG 2.1 A y AA. Si encuentra algo, la prueba falla y dice qué regla, en qué elemento y cómo corregirlo:

```js
await expectAccessible(document.body)
```

El contraste de colores no se revisa ahí (jsdom no calcula estilos): se revisa en el navegador.

Las pruebas simulan el backend con `src/test/mockApi.js`, que reemplaza el *adapter* de Axios. Así pasan por los interceptores reales (normalización de errores y renovación de la sesión):

```js
mockApi({
  'GET /auth/me': ok({ user: buildUser() }),
  'POST /auth/login': fail(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos'),
})
renderApp('/iniciar-sesion')
```

## Dinero y fechas

- `formatCurrency('1500000.00')` → `$ 1.500.000`. **Solo muestra**: los cálculos de dinero los hace el backend. Única excepción: vistas previas en vivo con `utils/moneyPreview.js` (enteros, nunca decimales de JavaScript).
- `formatDate` / `formatDateTime` muestran en hora de Bogotá los instantes UTC que envía la API.

## Problemas frecuentes

Ver la sección de frontend en [docs/INSTALACION_LOCAL.md](../docs/INSTALACION_LOCAL.md#problemas-frecuentes).
