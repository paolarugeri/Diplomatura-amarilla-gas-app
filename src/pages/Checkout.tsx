import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Banknote, CreditCard, Home, Lock, MapPin, Plus, ShieldCheck } from 'lucide-react'
import { Alert, PageLoader, PageTitle, Spinner, TextAreaField } from '../components/ui'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { friendlyError, supabase } from '../lib/supabase'
import { etaText, requestOrderEmail, useSettings } from '../lib/hooks'
import { formatAddress, formatMoney } from '../lib/format'
import type { Address, Order, PaymentMethod, PaymentMethodRow } from '../lib/types'

const IDEMP_KEY = 'amarilla-gas:checkout-key'

/** Clave de idempotencia ligada al contenido del pedido: si se reintenta lo mismo, el servidor no duplica. */
function checkoutKey(signature: string): string {
  try {
    const saved = JSON.parse(sessionStorage.getItem(IDEMP_KEY) ?? 'null') as { sig: string; key: string } | null
    if (saved?.sig === signature) return saved.key
    const key = crypto.randomUUID()
    sessionStorage.setItem(IDEMP_KEY, JSON.stringify({ sig: signature, key }))
    return key
  } catch {
    return crypto.randomUUID()
  }
}

export default function Checkout() {
  const { priced, total, count, clear, productsLoading } = useCart()
  const settings = useSettings()
  const { session } = useAuth()
  const uid = session?.user.id
  const navigate = useNavigate()
  const toast = useToast()

  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [methods, setMethods] = useState<PaymentMethodRow[]>([])
  const [addressId, setAddressId] = useState<string>('')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitted = useRef(false)

  useEffect(() => {
    supabase
      .from('addresses')
      .select('*')
      .eq('user_id', uid!)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = (data as Address[]) ?? []
        setAddresses(list)
        setAddressId((cur) => cur || list[0]?.id || '')
      })
    supabase
      .from('payment_methods')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setMethods((data as PaymentMethodRow[]) ?? []))
  }, [uid])

  const signature = useMemo(
    () => JSON.stringify([priced.map((l) => [l.product_id, l.with_refill, l.quantity]), addressId, method]),
    [priced, addressId, method],
  )

  if (productsLoading || addresses === null || !settings) return <PageLoader />
  if (priced.length === 0 && !submitted.current) return <Navigate to="/carrito" replace />

  const mpAvailable = settings.mp_enabled
  const selectedAddress = addresses.find((a) => a.id === addressId)

  async function confirm() {
    setError('')
    if (!addressId) return setError('Elegí o cargá el domicilio de entrega.')
    if (!method) return setError('Elegí cómo querés pagar.')
    if (method === 'mercadopago' && !mpAvailable) return setError('El pago electrónico todavía no está disponible.')
    if (busy) return
    setBusy(true)

    const { data, error } = await supabase.rpc('create_order', {
      p_items: priced.map((l) => ({ product_id: l.product_id, with_refill: l.with_refill, quantity: l.quantity })),
      p_address_id: addressId,
      p_payment_method: method,
      p_idempotency_key: checkoutKey(signature),
      p_notes: notes.trim() || null,
    })

    if (error || !data) {
      setBusy(false)
      setError(friendlyError(error))
      return
    }
    const order = data as Order
    submitted.current = true
    try {
      sessionStorage.removeItem(IDEMP_KEY)
    } catch {
      /* sin almacenamiento de sesión */
    }

    // Correo de confirmación (el servidor lo registra y no lo duplica)
    await requestOrderEmail(order.id)

    if (order.payment_method === 'mercadopago') {
      const { data: pref, error: prefErr } = await supabase.functions.invoke('mp-create-preference', { body: { order_id: order.id } })
      clear()
      const url = (pref as { init_point?: string } | null)?.init_point
      if (prefErr || !url) {
        toast('error', 'Registramos tu pedido, pero no pudimos abrir Mercado Pago. Podés reintentar el pago desde el detalle del pedido.')
        navigate(`/pedido/${order.id}/confirmado`, { replace: true })
        return
      }
      window.location.assign(url)
      return
    }

    clear()
    navigate(`/pedido/${order.id}/confirmado`, { replace: true })
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title="Confirmar pedido" subtitle="Revisá los datos y elegí cómo pagar." back="/carrito" />

      <div className="grid gap-5 md:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          {/* 1. Domicilio */}
          <section className="card p-5" aria-labelledby="h-dom">
            <h2 id="h-dom" className="flex items-center gap-2 text-lg font-extrabold">
              <span className="grid size-7 place-items-center rounded-full bg-brand text-sm">1</span> Domicilio de entrega
            </h2>
            {addresses.length === 0 ? (
              <div className="mt-4">
                <Alert tone="warn">Necesitamos un domicilio para entregarte el pedido.</Alert>
                <Link to="/domicilios/nuevo?volver=/confirmar" className="btn-primary mt-3">
                  <Plus className="size-4" /> Agregar domicilio
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition ${addressId === a.id ? 'border-ink bg-brand-50' : 'border-line hover:border-ink/30'}`}
                  >
                    <input type="radio" name="address" className="mt-1 size-4 accent-ink" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <Home className="size-4" /> {a.label}
                        {a.is_default && <span className="chip bg-ink px-2 py-0.5 text-[10px] text-white">Habitual</span>}
                        {a.lat != null && <MapPin className="size-3.5 text-ok" aria-label="Con ubicación en mapa" />}
                      </span>
                      <span className="block text-sm text-ink-2">{formatAddress(a)}</span>
                      {a.reference && <span className="block text-xs text-muted">Ref.: {a.reference}</span>}
                    </span>
                  </label>
                ))}
                <Link to="/domicilios/nuevo?volver=/confirmar" className="btn-ghost -ml-2 text-sm">
                  <Plus className="size-4" /> Usar otro domicilio
                </Link>
              </div>
            )}
          </section>

          {/* 2. Medio de pago */}
          <section className="card p-5" aria-labelledby="h-pago">
            <h2 id="h-pago" className="flex items-center gap-2 text-lg font-extrabold">
              <span className="grid size-7 place-items-center rounded-full bg-brand text-sm">2</span> Medio de pago
            </h2>
            <div className="mt-4 space-y-2">
              {methods.map((m) => {
                const disabled = m.code === 'mercadopago' && !mpAvailable
                const Icon = m.code === 'mercadopago' ? CreditCard : Banknote
                return (
                  <label
                    key={m.code}
                    className={`flex items-start gap-3 rounded-xl border-2 p-3 transition ${
                      disabled ? 'cursor-not-allowed border-dashed border-line opacity-70' : 'cursor-pointer'
                    } ${method === m.code ? 'border-ink bg-brand-50' : disabled ? '' : 'border-line hover:border-ink/30'}`}
                  >
                    <input type="radio" name="method" className="mt-1 size-4 accent-ink" disabled={disabled} checked={method === m.code} onChange={() => setMethod(m.code)} />
                    <Icon className="mt-0.5 size-5 shrink-0" />
                    <span>
                      <span className="block text-sm font-bold">{m.label}</span>
                      <span className="block text-sm text-ink-2">{m.description}</span>
                      {disabled && (
                        <span className="mt-1 block text-xs font-semibold text-warn">
                          Todavía no está habilitado: la empresa debe conectar su cuenta de Mercado Pago.
                        </span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
            {method === 'efectivo' && (
              <div className="mt-3">
                <Alert tone="warn">
                  <b>Pago en efectivo:</b> el importe de <b>{formatMoney(total)}</b> se abona al repartidor al recibir los productos. Tu pedido quedará
                  registrado como <b>pendiente de pago</b> hasta la entrega.
                </Alert>
              </div>
            )}
            {method === 'mercadopago' && (
              <div className="mt-3">
                <Alert tone="info">
                  Al confirmar te vamos a redirigir a Mercado Pago. El pedido se marca como <b>pagado</b> solo cuando Mercado Pago nos confirma la
                  operación.
                </Alert>
              </div>
            )}
          </section>

          <section className="card p-5">
            <TextAreaField label="Comentarios para la entrega (opcional)" name="notes" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. tocar timbre fuerte, llamar al llegar…" />
          </section>
        </div>

        {/* 3. Resumen */}
        <aside className="card h-fit p-5 md:sticky md:top-20">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <span className="grid size-7 place-items-center rounded-full bg-brand text-sm">3</span> Resumen
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {priced.map((l) => (
              <li key={l.key} className="flex justify-between gap-3">
                <span className="text-ink-2">
                  {l.quantity} × {l.product.name}
                  {l.product.category === 'envase' ? (l.with_refill ? ' + carga' : ' (sin carga)') : ''}
                  <span className="block text-xs text-muted">{formatMoney(l.unitPrice)} c/u</span>
                </span>
                <span className="whitespace-nowrap font-semibold">{formatMoney(l.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="font-display font-bold">Total ({count})</span>
            <span className="font-display text-2xl font-extrabold">{formatMoney(total)}</span>
          </div>
          {selectedAddress && (
            <p className="mt-3 rounded-xl bg-cream p-3 text-xs text-ink-2">
              <b>Entrega:</b> {formatAddress(selectedAddress)}
              <br />
              <b>Plazo:</b> {etaText(settings.delivery_eta_label, settings.delivery_eta_confirmed)}
            </p>
          )}
          {error && (
            <div className="mt-3">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
          <button className="btn-primary mt-4 w-full py-4 text-base" onClick={confirm} disabled={busy || !addressId || !method}>
            {busy ? (
              <>
                <Spinner className="size-5 text-ink" /> Procesando…
              </>
            ) : (
              <>
                <Lock className="size-4" /> Confirmar pedido
              </>
            )}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1 text-xs text-muted">
            <ShieldCheck className="size-3.5" /> Tus datos viajan cifrados
          </p>
        </aside>
      </div>
    </div>
  )
}
