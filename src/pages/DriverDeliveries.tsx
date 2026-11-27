import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Banknote, CheckCircle2, MapPin, Navigation, Phone, Truck } from 'lucide-react'
import { friendlyError, supabase } from '../lib/supabase'
import type { Order } from '../lib/types'
import { formatAddress, formatDateTime, formatMoney, itemName } from '../lib/format'
import { EmptyState, PageTitle, Spinner, StatusBadge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { requestStatusEmail } from '../lib/hooks'

/**
 * Pantalla del repartidor: ve solo los pedidos que tiene asignados (lo garantiza la base con RLS)
 * y los marca "En camino" y "Entregado". Cada cambio dispara el aviso por correo al cliente.
 */
export default function DriverDeliveries() {
  const { session, profile } = useAuth()
  const uid = session?.user.id
  const [params, setParams] = useSearchParams()
  const view = params.get('vista') === 'entregados' ? 'entregados' : 'pendientes'
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    if (!uid) return
    setOrders(null)
    const q = supabase.from('orders').select('*, order_items(*)').eq('assigned_to', uid)
    const { data } =
      view === 'pendientes'
        ? await q.not('status', 'in', '(entregado,cancelado)').order('created_at', { ascending: true })
        : await q.eq('status', 'entregado').order('delivered_at', { ascending: false }).limit(50)
    setOrders((data as Order[]) ?? [])
  }, [uid, view])

  useEffect(() => {
    load()
  }, [load])

  async function advance(o: Order, next: 'en_camino' | 'entregado') {
    setBusyId(o.id)
    const { error } = await supabase.rpc('driver_update_order', { p_order_id: o.id, p_status: next })
    if (error) {
      setBusyId(null)
      return toast('error', friendlyError(error))
    }
    await requestStatusEmail(o.id) // aviso por correo al cliente
    setBusyId(null)
    toast('success', `${o.order_number}: ${next === 'entregado' ? 'entregado' : 'en camino'}. Le avisamos al cliente por correo.`)
    load()
  }

  const toCollect = (o: Order) => o.payment_method === 'efectivo' && o.payment_status !== 'pagado'

  function action(o: Order) {
    const busy = busyId === o.id
    if (o.payment_method === 'mercadopago' && o.payment_status !== 'pagado')
      return <span className="text-xs font-semibold text-warn">Pago electrónico pendiente: consultá con la administración.</span>
    if (o.status === 'en_camino')
      return (
        <button className="btn-dark flex-1 py-3 text-sm" disabled={busy} onClick={() => advance(o, 'entregado')}>
          {busy ? <Spinner className="size-4 text-white" /> : <CheckCircle2 className="size-4" />}
          {toCollect(o) ? `Entregado y cobrado ${formatMoney(o.total)}` : 'Marcar entregado'}
        </button>
      )
    return (
      <button className="btn-primary flex-1 py-3 text-sm" disabled={busy} onClick={() => advance(o, 'en_camino')}>
        {busy ? <Spinner className="size-4 text-ink" /> : <Truck className="size-4" />} Salgo a entregar (En camino)
      </button>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Mis entregas" subtitle={`Hola${profile ? `, ${profile.full_name.split(' ')[0]}` : ''}. Estos son los pedidos que tenés asignados.`} />
      <div className="mb-4 inline-flex rounded-xl bg-white p-1 shadow-card" role="tablist">
        {(['pendientes', 'entregados'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setParams(v === 'entregados' ? { vista: v } : {})}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${view === v ? 'bg-ink text-white' : 'text-ink-2'}`}
          >
            {v === 'pendientes' ? 'Por entregar' : 'Entregados'}
          </button>
        ))}
      </div>

      {!orders ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-8" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Truck className="size-8" />}
          title={view === 'pendientes' ? 'No tenés entregas pendientes' : 'Todavía no hiciste entregas'}
          text={view === 'pendientes' ? 'Cuando la administración te asigne un pedido, lo vas a ver acá.' : undefined}
        />
      ) : (
        <ul className="grid gap-3">
          {orders.map((o) => {
            const a = o.delivery_address
            const maps =
              a.lat != null && a.lng != null
                ? `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(a))}`
            return (
              <li key={o.id} className="card flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg font-extrabold">{o.order_number}</p>
                    <p className="text-xs text-muted">{formatDateTime(view === 'entregados' && o.delivered_at ? o.delivered_at : o.created_at)}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>

                <p className="mt-3 flex items-start gap-1.5 text-base font-bold">
                  <MapPin className="mt-1 size-4 shrink-0 text-brand-700" /> {formatAddress(a)}
                </p>
                {a.reference && <p className="ml-5.5 text-sm text-ink-2">Ref.: {a.reference}</p>}

                <p className="mt-2 text-sm text-ink-2">
                  {o.customer_name} ·{' '}
                  <a className="font-bold text-brand-800" href={`tel:${o.customer_phone.replace(/[^0-9+]/g, '')}`}>
                    <Phone className="inline size-3.5" /> {o.customer_phone}
                  </a>
                </p>
                <p className="mt-1 text-xs text-ink-2">{(o.order_items ?? []).map((i) => `${i.quantity} × ${itemName(i)}`).join(' · ')}</p>
                {o.notes && <p className="mt-2 rounded-lg bg-brand-50 p-2 text-xs">{o.notes}</p>}

                <div className={`mt-3 flex items-center justify-between gap-2 rounded-xl p-3 ${toCollect(o) ? 'bg-brand-50' : 'bg-cream'}`}>
                  <span className="flex items-center gap-1.5 text-sm font-bold">
                    <Banknote className="size-4" />
                    {toCollect(o) ? 'Total a cobrar en efectivo' : 'Ya está pagado: no hay que cobrar'}
                  </span>
                  <span className={`font-display font-extrabold ${toCollect(o) ? 'text-xl' : 'text-sm text-muted line-through'}`}>{formatMoney(o.total)}</span>
                </div>

                {view === 'pendientes' && (
                  <div className="mt-3 flex items-center gap-2">
                    <a href={maps} target="_blank" rel="noreferrer" className="btn-outline px-3 py-3 text-sm" aria-label="Cómo llegar">
                      <Navigation className="size-4" />
                    </a>
                    {action(o)}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
