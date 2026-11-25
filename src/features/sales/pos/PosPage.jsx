import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Banknote, FileText, Landmark, Percent, ShieldAlert, ShoppingCart, TriangleAlert, Wallet, X } from 'lucide-react'
import { useGetCashSessionsQuery } from '../../cash/cashApi'
import { useCan } from '../../../hooks/usePermissions'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { formatCurrency, formatDateTime } from '../../../utils/format'
import { toApiNumber, toInputNumber } from '../../../utils/numberInput'
import { ROUTES, quotePath } from '../../../routes/paths'
import { usePreviewSaleMutation, useLazySearchSaleCatalogQuery } from '../salesApi'
import { quotesApi } from '../../quotes/quotesApi'
import { customersApi } from '../../customers/customersApi'
import '../../quotes/quotes.css'
import { readPosSession, writePosSession } from '../saleOptions'
import { PosSearch } from './PosSearch'
import { PosCart } from './PosCart'
import { PosCustomer } from './PosCustomer'
import { PosPriceList } from './PosPriceList'
import { CheckoutPanel } from './CheckoutPanel'
import { PosFreight } from './PosFreight'
import { useAnimatedNumber } from './useAnimatedNumber'
import { SaleReceiptModal } from '../SaleReceiptModal'
import { LayawayReceiptModal } from '../../layaways/LayawayReceiptModal'
import '../../admin/admin.css'
import '../../cash/cash.css'
import './pos.css'

let lineCounter = 0

/** Lo que se manda al servidor a partir del carrito (las cantidades vacías no cuentan). */
function toRequestItems(lines) {
  return lines
    .filter((line) => Number(toApiNumber(line.quantity)) > 0)
    .map((line) => ({
      productId: line.product.id,
      ...(line.presentationId && { presentationId: Number(line.presentationId) }),
      // Animal (D-ANI-1): el lote que escogió el cajero; sin lote el servidor pide escogerlo
      ...(line.animalLotId && { animalLotId: Number(line.animalLotId) }),
      quantity: toApiNumber(line.quantity),
      ...(toApiNumber(line.discountValue) && { discountType: line.discountType, discountValue: toApiNumber(line.discountValue) }),
    }))
}

function TotalAmount({ value }) {
  const animated = useAnimatedNumber(value)
  return <strong className="pos-totals__amount">{formatCurrency(String(animated))}</strong>
}

/**
 * Punto de venta (Fase 10, D-VEN-10). Arriba la caja y el cliente; a la izquierda
 * "Buscar o escanear"; a la derecha la venta con su pago. Pensado para el lector de código
 * de barras: escanear → el producto entra a la venta; F2 cobra. Los totales los calcula el servidor.
 */
export default function PosPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const canViewCash = useCan('cash.view')
  const searchRef = useRef(null)
  const payRef = useRef(null)
  const [sessionId, setSessionId] = useState(readPosSession)
  const [lines, setLines] = useState([])
  const [customer, setCustomer] = useState(null)
  // Lista de precios (D-PRE-1): undefined = la del cliente; null = precio normal; un id = otra lista
  const [priceListChoice, setPriceListChoice] = useState(undefined)
  // Cotizaciones (D-COT-1): modo «Cotizar» del cobro y la cotización que se está vendiendo
  const [payMode, setPayMode] = useState('cash')
  const [quoteSale, setQuoteSale] = useState(null) // { id, number }
  // Flete con conductor (D-FLE-1): solo en ventas de contado o fiadas, con caja abierta
  const canAddFreight = useCan('porters.trips')
  const [freight, setFreight] = useState({ isOpen: false, porterId: '', amount: '' })
  const [fetchQuote] = quotesApi.useLazyGetQuoteQuery()
  const [fetchCustomer] = customersApi.useLazyGetCustomerQuery()
  const [searchCatalog] = useLazySearchSaleCatalogQuery()
  const quoteToLoad = location.state?.quoteId ?? null
  // Sin caja abierta solo se puede cotizar (una cotización no mueve dinero)
  const canQuote = useCan('quotes.create')
  const [quoteOnly, setQuoteOnly] = useState(false)
  const [globalDiscount, setGlobalDiscount] = useState('')
  const [previewResult, setPreview] = useState(null)
  const [previewFailure, setPreviewError] = useState(null)
  const [round, setRound] = useState(1) // cada venta nueva monta un cobro nuevo (otra clave)
  const [completed, setCompleted] = useState(null) // { id, change } | { layawayId }
  const { data: sessionsData, isLoading: isLoadingSessions } = useGetCashSessionsQuery({ status: 'open', pageSize: 50 }, { skip: !canViewCash })
  const [runPreview, previewState] = usePreviewSaleMutation()
  const sessions = sessionsData?.rows ?? []
  const session = sessions.find((row) => String(row.id) === String(sessionId)) ?? (sessions.length === 1 ? sessions[0] : null)

  const items = toRequestItems(lines)
  const freightMode = payMode === 'cash' || payMode === 'credit'
  const freightApplies = canAddFreight && freightMode && freight.isOpen && Boolean(freight.porterId) && Number(toApiNumber(freight.amount)) > 0
  const request = {
    items,
    ...(toApiNumber(globalDiscount) && { globalDiscount: toApiNumber(globalDiscount) }),
    // El cliente define los precios de su lista; el servidor los calcula
    ...(customer && { customerId: customer.id }),
    ...(priceListChoice !== undefined && { priceListId: priceListChoice }),
    // Cotizar no exige existencia; vender una cotización vigente respeta sus precios
    ...(payMode === 'quote' && { forQuote: true }),
    ...(quoteSale && payMode !== 'quote' && { quoteId: quoteSale.id }),
    ...(freightApplies && { freight: { porterId: Number(freight.porterId), amount: toApiNumber(freight.amount) } }),
  }
  const pricing = { ...(customer && { customerId: customer.id }), ...(priceListChoice !== undefined && { priceListId: priceListChoice ?? 'none' }) }
  const requestKey = useDebouncedValue(JSON.stringify(request), 300)
  // Con el carrito vacío no se muestra ninguna vista previa anterior
  const preview = items.length > 0 ? previewResult : null
  const previewError = items.length > 0 ? previewFailure : null

  // Totales oficiales del servidor cada vez que cambia la venta
  useEffect(() => {
    const body = JSON.parse(requestKey)
    if (body.items.length === 0) return undefined
    let cancelled = false
    runPreview(body)
      .unwrap()
      .then((result) => {
        if (cancelled) return
        setPreview(result)
        setPreviewError(null)
      })
      .catch((error) => {
        if (!cancelled) setPreviewError(error.details?.[0]?.message ?? error.message)
      })
    return () => {
      cancelled = true
    }
  }, [requestKey, runPreview])

  const focusSearch = () => setTimeout(() => searchRef.current?.focus(), 50)

  // «Vender esta cotización»: llena la venta con sus productos, cantidades y descuentos
  useEffect(() => {
    if (!quoteToLoad) return undefined
    let cancelled = false
    navigate(location.pathname, { replace: true, state: null })
    ;(async () => {
      try {
        const quote = await fetchQuote(quoteToLoad).unwrap()
        const buyer = quote.customer.id ? await fetchCustomer(quote.customer.id).unwrap() : null
        const loaded = []
        for (const item of quote.items) {
          const found = await searchCatalog({ search: item.productCode, ...(buyer && { customerId: buyer.id }) }).unwrap()
          const product = found.find((row) => row.id === item.productId)
          if (!product) continue
          lineCounter += 1
          loaded.push({
            key: `l${lineCounter}`,
            product,
            presentationId: item.presentationId ? String(item.presentationId) : '',
            animalLotId: '',
            quantity: toInputNumber(item.quantity),
            discountType: item.discountType ?? 'percent',
            discountValue: Number(item.discountValue) > 0 ? toInputNumber(item.discountValue) : '',
          })
        }
        if (cancelled) return
        setLines(loaded)
        setCustomer(buyer)
        setPriceListChoice(undefined)
        setGlobalDiscount(Number(quote.globalDiscount) > 0 ? toInputNumber(quote.globalDiscount) : '')
        if (quote.state === 'open') {
          setQuoteSale({ id: quote.id, number: quote.number })
          toast.info(`Cotización ${quote.number} cargada con sus precios`)
        } else {
          setQuoteSale(null)
          toast.info(`La cotización ${quote.number} venció: se cargó con los precios de hoy`)
        }
        if (loaded.length < quote.items.length) toast.error('Algún producto de la cotización ya no está activo y no se cargó')
      } catch (loadError) {
        if (!cancelled) toast.error(loadError.message ?? 'No se pudo cargar la cotización')
      }
    })()
    return () => {
      cancelled = true
    }
    // Solo cuando se llega con una cotización
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteToLoad])

  const addProduct = useCallback((product, presentationId) => {
    // Un animal con un solo lote lo toma de una vez; con varios, el cajero escoge (D-ANI-1)
    const lots = product.productKind === 'animal' ? (product.animalLots ?? []) : []
    const animalLotId = lots.length === 1 ? String(lots[0].id) : ''
    setLines((current) => {
      const same = current.find((line) => line.product.id === product.id && String(line.presentationId) === String(presentationId ?? '') && (lots.length === 0 || line.animalLotId === animalLotId))
      if (same) return current.map((line) => (line === same ? { ...line, quantity: toInputNumber(String((Number(toApiNumber(line.quantity)) || 0) + 1)) } : line))
      lineCounter += 1
      return [{ key: `l${lineCounter}`, product, presentationId: presentationId ? String(presentationId) : '', animalLotId, quantity: '1', discountType: 'percent', discountValue: '' }, ...current]
    })
  }, [])

  const clearSale = () => {
    setLines([])
    setCustomer(null)
    setPriceListChoice(undefined)
    setQuoteSale(null)
    setGlobalDiscount('')
    setFreight({ isOpen: false, porterId: '', amount: '' })
    setRound((value) => value + 1)
    focusSearch()
  }

  const isPreviewCurrent = Boolean(preview) && requestKey === JSON.stringify(request) && !previewState.isLoading
  const canCheckout = Boolean((session || payMode === 'quote') && items.length > 0 && isPreviewCurrent && !previewError)

  // Atajos: F2 cobra (como el botón), "/" lleva al buscador
  useEffect(() => {
    const handleKey = (event) => {
      if (completed) return
      if (event.key === 'F2') {
        event.preventDefault()
        if (canCheckout) payRef.current?.requestSubmit()
      } else if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [canCheckout, completed])

  if (!canViewCash) {
    return <StatusMessage icon={Wallet} title="Necesitas ver la caja para vender" description="Toda venta va en un turno de caja abierto. Pide al administrador el permiso de ver la caja." />
  }
  if (!isLoadingSessions && sessions.length === 0 && !quoteOnly) {
    return (
      <StatusMessage icon={Wallet} title="No hay ninguna caja abierta" description={canQuote ? 'Toda venta va en un turno de caja. Abre un turno para vender, o haz solo una cotización.' : 'Toda venta va en un turno de caja. Abre un turno para empezar a vender.'}>
        <Link className="button button--primary button--md" to={ROUTES.cash}>
          <Banknote className="button__icon" aria-hidden="true" />
          <span className="button__label">Ir a Mis cajas de hoy</span>
        </Link>
        {canQuote && (
          <button type="button" className="button button--secondary button--md" onClick={() => setQuoteOnly(true)}>
            <FileText className="button__icon" aria-hidden="true" />
            <span className="button__label">Hacer una cotización</span>
          </button>
        )}
      </StatusMessage>
    )
  }

  const totals = preview?.totals
  const count = lines.length
  return (
    <div className="pos-shell">
      <section className="pos-head" aria-label="Caja y cliente">
        <label className="pos-head__field">
          <span className="pos-head__icon" aria-hidden="true">
            <Landmark />
          </span>
          <span className="pos-head__body">
            <span className="pos-label">Caja</span>
            <span className="pos-select">
              <select
                value={session ? String(session.id) : ''}
                onChange={(event) => {
                  setSessionId(event.target.value)
                  writePosSession(event.target.value)
                }}
              >
                {!session && <option value="">Escoge la caja…</option>}
                {sessions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.register?.name} · abierta {formatDateTime(row.openedAt)}
                  </option>
                ))}
              </select>
            </span>
            <span className="pos-head__hint">
              <span className="pos-live" aria-hidden="true" /> El efectivo entra a esta caja.
            </span>
          </span>
        </label>
        <PosCustomer
          customer={customer}
          onChange={(next) => {
            setCustomer(next)
            setPriceListChoice(undefined)
          }}
        />
      </section>
      {quoteSale && (
        <div className="pos-quote-banner" role="status">
          <span>
            <FileText aria-hidden="true" />
            Vendiendo la cotización <strong>{quoteSale.number}</strong> con sus precios.
          </span>
          <button type="button" className="pay__link" onClick={() => setQuoteSale(null)}>
            <X aria-hidden="true" /> Vender al precio de hoy
          </button>
        </div>
      )}
      <PosPriceList customer={customer} applied={items.length > 0 ? (preview?.priceList ?? null) : undefined} choice={priceListChoice} onChange={setPriceListChoice} />

      <div className="pos">
        <PosSearch ref={searchRef} onPick={addProduct} pricing={pricing} />

        <section className="pos-panel pos-panel--sale" aria-label="Venta">
          <header className="pos-panel__head">
            <span className="pos-panel__icon" aria-hidden="true">
              <ShoppingCart />
            </span>
            <span className="pos-panel__titles">
              <strong>Venta</strong>
              <small>{count === 0 ? 'Aún no hay productos.' : `${count} ${count === 1 ? 'producto' : 'productos'}`}</small>
            </span>
            <span className={`pos-panel__count${count ? ' pos-panel__count--on' : ''}`} key={count}>
              {count}
            </span>
          </header>

          <PosCart lines={lines} computed={preview?.lines} onChange={(key, changes) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...changes } : line)))} onRemove={(key) => setLines((current) => current.filter((line) => line.key !== key))} />

          <label className="pos-discount-all">
            <Percent aria-hidden="true" />
            <span>Descuento a toda la venta</span>
            <span className="pos-discount-all__input">
              <span aria-hidden="true">$</span>
              <input inputMode="decimal" placeholder="0" value={globalDiscount} onChange={(event) => setGlobalDiscount(event.target.value)} aria-label="Descuento general en pesos" />
            </span>
          </label>

          {canAddFreight && freightMode && session && <PosFreight value={freight} onChange={setFreight} />}

          <div className="pos-totals" aria-live="polite">
            <div className="pos-totals__row">
              <span>Subtotal</span>
              <span>{formatCurrency(totals?.subtotal ?? '0')}</span>
            </div>
            {Number(totals?.discountTotal ?? 0) > 0 && (
              <div className="pos-totals__row">
                <span>Descuentos</span>
                <span>−{formatCurrency(totals.discountTotal)}</span>
              </div>
            )}
            {preview?.taxEnabled && (
              <div className="pos-totals__row">
                <span>IVA</span>
                <span>{formatCurrency(totals?.taxTotal ?? '0')}</span>
              </div>
            )}
            {Number(totals?.roundingAdjustment ?? 0) !== 0 && (
              <div className="pos-totals__row">
                <span>Redondeo</span>
                <span>{formatCurrency(totals.roundingAdjustment)}</span>
              </div>
            )}
            {Number(totals?.freight ?? 0) > 0 && (
              <div className="pos-totals__row">
                <span>Flete (va al conductor)</span>
                <span>{formatCurrency(totals.freight)}</span>
              </div>
            )}
            <div className="pos-totals__total">
              <span>Total a cobrar</span>
              <TotalAmount value={totals?.total ?? 0} />
            </div>
          </div>

          {previewError && (
            <p className="pos-notice pos-notice--danger">
              <TriangleAlert aria-hidden="true" /> {previewError}
            </p>
          )}
          {preview?.requires.discount && (
            <p className="pos-notice">
              <ShieldAlert aria-hidden="true" />
              {preview.warnings.belowCost.length > 0 ? `Queda bajo el costo: ${preview.warnings.belowCost.map((item) => item.name).join(', ')}.` : 'El descuento pasa tu tope.'} Al cobrar se pedirá autorización.
            </p>
          )}
          {preview?.warnings.expired.length > 0 && (
            <p className="pos-notice">
              <TriangleAlert aria-hidden="true" /> Incluye producto vencido: {preview.warnings.expired.map((item) => item.name).join(', ')}.{preview.requires.expired ? ' Se pedirá autorización.' : ''}
            </p>
          )}
          {!session && !quoteOnly && <p className="pos-notice">Escoge arriba la caja donde vendes.</p>}
          {quoteOnly && <p className="pos-notice">No hay caja abierta: solo se puede cotizar.</p>}

          <CheckoutPanel
            key={round}
            ref={payRef}
            total={totals?.total ?? '0'}
            disabled={!canCheckout}
            request={{ ...request, cashSessionId: session?.id }}
            customer={customer}
            onClear={clearSale}
            onModeChange={setPayMode}
            quoteOnly={quoteOnly && sessions.length === 0}
            prescriptionProducts={[...new Set(lines.filter((line) => line.product.requiresPrescription).map((line) => line.product.name))]}
            onCompleted={(sale, { change, kind }) => {
              if (kind === 'quote') {
                toast.success(sale.replayed ? `La cotización ${sale.number} ya estaba registrada` : `Cotización ${sale.number} lista`)
                clearSale()
                navigate(quotePath(sale.id))
                return
              }
              if (kind === 'layaway') {
                setCompleted({ layawayId: sale.id })
                toast.success(sale.replayed ? `El apartado ${sale.number} ya estaba registrado` : `Apartado ${sale.number} registrado`)
                return
              }
              setCompleted({ id: sale.id, change: sale.saleType === 'cash' ? change : null })
              if (sale.prescriptionMissing) toast.info(`Venta ${sale.number} registrada sin fórmula veterinaria: quedó en el libro de fórmulas`)
              else if (sale.creditWarning) toast.info(`Venta ${sale.number} registrada. Ojo: ${sale.creditWarning}`)
              else toast.success(sale.replayed ? `La venta ${sale.number} ya estaba registrada` : `Venta ${sale.number} registrada`)
            }}
          />
        </section>
      </div>

      {completed?.layawayId && (
        <LayawayReceiptModal
          layawayId={completed.layawayId}
          onClose={() => {
            setCompleted(null)
            clearSale()
          }}
          onNewSale={() => {
            setCompleted(null)
            clearSale()
          }}
        />
      )}
      {completed?.id && (
        <SaleReceiptModal
          saleId={completed.id}
          change={completed.change}
          onClose={() => {
            setCompleted(null)
            clearSale()
          }}
          onNewSale={() => {
            setCompleted(null)
            clearSale()
          }}
        />
      )}
    </div>
  )
}
