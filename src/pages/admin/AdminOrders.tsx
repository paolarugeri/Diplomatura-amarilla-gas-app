import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Order, OrderStatus } from '../../lib/types'
import { ORDER_STATUSES, formatDateTime, formatMoney, orderStatusLabel, paymentMethodLabel } from '../../lib/format'
import { EmptyState, PageTitle, PaymentBadge, Spinner, StatusBadge } from '../../components/ui'
import { AdminOrderPanel } from './AdminOrderPanel'

const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
/** Inicio/fin de un día de Argentina (UTC-3) en ISO. */
const dayStart = (d: string) => `${d}T00:00:00-03:00`
const dayEnd = (d: string) => `${d}T23:59:59.999-03:00`

export default function AdminOrders() {
  const [params] = useSearchParams()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [number, setNumber] = useState('')
  const [customer, setCustomer] = useState(params.get('cliente') ?? '')
  const [from, setFrom] = useState(params.get('hoy') ? todayISO() : '')
  const [to, setTo] = useState(params.get('hoy') ? todayISO() : '')
  const [status, setStatus] = useState<OrderStatus | ''>((params.get('estado') as OrderStatus) ?? '')
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    setOrders(null)
    let q = supabase.from('orders').select('*, order_items(quantity)').order('created_at', { ascending: false }).limit(200)
    const n = number.trim().toUpperCase().replace(/^#/, '')
    if (n) q = q.ilike('order_number', `%${n}%`)
    if (status) q = q.eq('status', status)
    if (from) q = q.gte('created_at', dayStart(from))
    if (to) q = q.lte('created_at', dayEnd(to))
    const c = customer.trim().replace(/[%,()]/g, '')
    if (c) q = q.or(`customer_name.ilike.%${c}%,customer_email.ilike.%${c}%,customer_phone.ilike.%${c}%`)
    const { data } = await q
    setOrders((data as Order[]) ?? [])
  }, [number, status, from, to, customer])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const hasFilters = number || customer || from || to || status
  const clear = () => {
    setNumber('')
    setCustomer('')
    setFrom('')
    setTo('')
    setStatus('')
  }

  return (
    <div>
      <PageTitle title="Pedidos" subtitle="Buscá, filtrá y gestioná todos los pedidos recibidos." />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative lg:col-span-1">
          <span className="sr-only">Número de pedido</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="N° de pedido" value={number} onChange={(e) => setNumber(e.target.value)} />
        </label>
        <label className="lg:col-span-1">
          <span className="sr-only">Cliente</span>
          <input className="input" placeholder="Cliente, correo o teléfono" value={customer} onChange={(e) => setCustomer(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-12 shrink-0 text-muted">Desde</span>
          <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-12 shrink-0 text-muted">Hasta</span>
          <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">Estado</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')}>
            <option value="">Todos los estados</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {orderStatusLabel[s]}
              </option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button className="btn-ghost w-fit text-sm sm:col-span-2 lg:col-span-5" onClick={clear}>
            <X className="size-4" /> Limpiar filtros
          </button>
        )}
      </div>

      {!orders ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-8" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon={<Search className="size-8" />} title="No hay pedidos con esos filtros" />
      ) : (
        <>
          <p className="mb-2 text-xs text-muted">
            {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'} · Total {formatMoney(orders.filter((o) => o.status !== 'cancelado').reduce((s, o) => s + Number(o.total), 0))}
          </p>
          {/* Tabla en escritorio */}
          <div className="card hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead className="bg-cream text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Localidad</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => (
                  <tr key={o.id} className="cursor-pointer hover:bg-brand-50/60" onClick={() => setOpen(o.id)}>
                    <td className="whitespace-nowrap px-4 py-3 font-display font-bold">{o.order_number}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-2">{formatDateTime(o.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{o.customer_name}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{o.delivery_address.city}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatMoney(o.total)}</td>
                    <td className="px-4 py-3">
                      <span className="block text-xs text-muted">{o.payment_method === 'efectivo' ? 'Efectivo' : 'Mercado Pago'}</span>
                      <PaymentBadge status={o.payment_status} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Tarjetas en celular */}
          <ul className="space-y-2 lg:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <button className="card w-full p-4 text-left" onClick={() => setOpen(o.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display font-extrabold">{o.order_number}</p>
                      <p className="text-xs text-muted">{formatDateTime(o.created_at)}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-2 text-sm font-semibold">{o.customer_name}</p>
                  <p className="text-xs text-muted">
                    {o.delivery_address.street} {o.delivery_address.number}, {o.delivery_address.city}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-ink-2">
                      {paymentMethodLabel[o.payment_method]} · <PaymentBadge status={o.payment_status} />
                    </span>
                    <span className="font-display font-extrabold">{formatMoney(o.total)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {open && <AdminOrderPanel orderId={open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  )
}
