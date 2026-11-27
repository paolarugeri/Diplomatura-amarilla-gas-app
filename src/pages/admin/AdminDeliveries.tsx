import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, MapPin, Navigation, Phone, Truck } from 'lucide-react'
import { friendlyError, supabase } from '../../lib/supabase'
import type { Order, OrderStatus } from '../../lib/types'
import { formatAddress, formatDateTime, formatMoney, itemName } from '../../lib/format'
import { EmptyState, PageTitle, PaymentBadge, Spinner, StatusBadge } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { requestStatusEmail } from '../../lib/hooks'
import { AdminOrderPanel } from './AdminOrderPanel'
import { AssignDriver, useDrivers } from './AssignDriver'

const PENDING: OrderStatus[] = ['recibido', 'pendiente_pago', 'pago_confirmado', 'en_preparacion', 'en_camino']

export default function AdminDeliveries() {
  const [params, setParams] = useSearchParams()
  const view = params.get('vista') === 'entregados' ? 'entregados' : 'pendientes'
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const toast = useToast()
  const drivers = useDrivers()

  const load = useCallback(async () => {
    setOrders(null)
    const q = supabase.from('orders').select('*, order_items(*)')
    const { data } =
      view === 'pendientes'
        ? await q.in('status', PENDING).order('created_at', { ascending: true })
        : await q.eq('status', 'entregado').order('delivered_at', { ascending: false }).limit(100)
    setOrders((data as Order[]) ?? [])
  }, [view])

  useEffect(() => {
    load()
  }, [load])

  async function advance(o: Order, next: OrderStatus, collect = false) {
    setBusyId(o.id)
    const { error } = await supabase.rpc('admin_update_order', {
      p_order_id: o.id,
      p_status: next,
      p_payment_status: collect ? 'pagado' : null,
      p_note: collect ? 'Entregado y cobrado en efectivo' : null,
    })
    if (error) {
      setBusyId(null)
      return toast('error', friendlyError(error))
    }
    await requestStatusEmail(o.id)
    setBusyId(null)
    toast('success', `${o.order_number}: ${next === 'entregado' ? 'entregado' : next === 'en_camino' ? 'en camino' : 'en preparación'}.`)
    load()
  }

  function nextAction(o: Order) {
    if (o.payment_method === 'mercadopago' && o.payment_status !== 'pagado') return <span className="text-xs font-semibold text-warn">Esperando pago de Mercado Pago</span>
    const busy = busyId === o.id
    if (o.status === 'en_camino')
      return (
        <button className="btn-dark flex-1 py-2.5 text-sm" disabled={busy} onClick={() => advance(o, 'entregado', o.payment_method === 'efectivo' && o.payment_status !== 'pagado')}>
          {busy ? <Spinner className="size-4 text-white" /> : <CheckCircle2 className="size-4" />}
          {o.payment_method === 'efectivo' && o.payment_status !== 'pagado' ? `Entregado y cobrado ${formatMoney(o.total)}` : 'Marcar entregado'}
        </button>
      )
    if (o.status === 'en_preparacion')
      return (
        <button className="btn-primary flex-1 py-2.5 text-sm" disabled={busy} onClick={() => advance(o, 'en_camino')}>
          {busy ? <Spinner className="size-4 text-ink" /> : <Truck className="size-4" />} Salió a reparto
        </button>
      )
    return (
      <button className="btn-primary flex-1 py-2.5 text-sm" disabled={busy} onClick={() => advance(o, 'en_preparacion')}>
        {busy ? <Spinner className="size-4 text-ink" /> : null} Pasar a preparación
      </button>
    )
  }

  return (
    <div>
      <PageTitle title="Entregas" subtitle="Organizá el reparto, asigná cada pedido a un repartidor y actualizá el estado de cada entrega." />
      <div className="mb-4 inline-flex rounded-xl bg-white p-1 shadow-card" role="tablist">
        {(['pendientes', 'entregados'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setParams(v === 'entregados' ? { vista: v } : {})}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${view === v ? 'bg-ink text-white' : 'text-ink-2'}`}
          >
            {v === 'pendientes' ? 'Pendientes' : 'Entregados'}
          </button>
        ))}
      </div>

      {!orders ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-8" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon={<Truck className="size-8" />} title={view === 'pendientes' ? 'No hay entregas pendientes' : 'Todavía no hay entregas realizadas'} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {orders.map((o) => {
            const a = o.delivery_address
            const maps = a.lat != null && a.lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(a))}`
            return (
              <li key={o.id} className="card flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <button className="text-left" onClick={() => setOpen(o.id)}>
                    <p className="font-display text-lg font-extrabold underline-offset-2 hover:underline">{o.order_number}</p>
                    <p className="text-xs text-muted">{formatDateTime(view === 'entregados' && o.delivered_at ? o.delivered_at : o.created_at)}</p>
                  </button>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" /> {formatAddress(a)}
                </p>
                {a.reference && <p className="ml-5.5 text-xs text-muted">Ref.: {a.reference}</p>}
                <p className="mt-2 text-sm text-ink-2">
                  {o.customer_name} ·{' '}
                  <a className="font-semibold text-brand-800" href={`tel:${o.customer_phone.replace(/[^0-9+]/g, '')}`}>
                    <Phone className="inline size-3.5" /> {o.customer_phone}
                  </a>
                </p>
                <p className="mt-1 text-xs text-ink-2">{(o.order_items ?? []).map((i) => `${i.quantity} × ${itemName(i)}`).join(' · ')}</p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="font-display text-base font-extrabold">{formatMoney(o.total)}</span>
                  <span className="text-muted">{o.payment_method === 'efectivo' ? 'Efectivo' : 'Mercado Pago'}</span>
                  <PaymentBadge status={o.payment_status} />
                </div>
                {o.notes && <p className="mt-2 rounded-lg bg-brand-50 p-2 text-xs">{o.notes}</p>}
                <div className="mt-3">
                  <AssignDriver order={o} drivers={drivers} onChanged={load} compact />
                </div>
                {view === 'pendientes' && (
                  <div className="mt-auto flex items-center gap-2 pt-3">
                    <a href={maps} target="_blank" rel="noreferrer" className="btn-outline px-3 py-2.5 text-sm" aria-label="Cómo llegar">
                      <Navigation className="size-4" />
                    </a>
                    {nextAction(o)}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {open && <AdminOrderPanel orderId={open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  )
}
