import { useState } from 'react'
import { Check, CreditCard, MapPin } from 'lucide-react'
import type { Order, OrderStatus } from '../lib/types'
import { formatAddress, formatDateTime, formatMoney, itemName, orderStatusLabel, paymentMethodLabel } from '../lib/format'
import { PaymentBadge, Spinner, StatusBadge } from './ui'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

export const ORDER_SELECT = '*, order_items(*), order_status_history(*), email_notifications(kind, status, created_at, error)'

export function OrderItemsTable({ order }: { order: Order }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead className="bg-cream text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Producto</th>
            <th className="px-2 py-2 text-center font-semibold">Cant.</th>
            <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell">Unitario</th>
            <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {(order.order_items ?? []).map((i) => (
            <tr key={i.id}>
              <td className="px-3 py-2.5">
                <span className="font-semibold">{itemName(i)}</span>
                <span className="block text-xs text-muted sm:hidden">{formatMoney(i.unit_price)} c/u</span>
                {i.with_refill && (
                  <span className="hidden text-xs text-muted sm:block">
                    Envase {formatMoney(i.unit_base_price)} + carga {formatMoney(i.unit_refill_price)}
                  </span>
                )}
              </td>
              <td className="px-2 py-2.5 text-center">{i.quantity}</td>
              <td className="hidden px-2 py-2.5 text-right sm:table-cell">{formatMoney(i.unit_price)}</td>
              <td className="px-3 py-2.5 text-right font-semibold">{formatMoney(i.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-brand-50">
          <tr>
            <td colSpan={2} className="px-3 py-3 font-display font-bold sm:hidden">
              Total
            </td>
            <td colSpan={3} className="hidden px-3 py-3 font-display font-bold sm:table-cell">
              Total
            </td>
            <td className="px-3 py-3 text-right font-display text-lg font-extrabold">{formatMoney(order.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function OrderFacts({ order }: { order: Order }) {
  const a = order.delivery_address
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div className="rounded-xl bg-cream p-3">
        <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
          <MapPin className="size-3.5" /> Domicilio de entrega
        </dt>
        <dd className="mt-1 font-semibold">{formatAddress(a)}</dd>
        {a.reference && <dd className="text-xs text-muted">Ref.: {a.reference}</dd>}
        {a.lat != null && a.lng != null && (
          <dd className="mt-1">
            <a className="text-xs font-bold text-brand-800 underline" href={`https://www.google.com/maps?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer">
              Ver ubicación en el mapa
            </a>
          </dd>
        )}
      </div>
      <div className="rounded-xl bg-cream p-3">
        <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
          <CreditCard className="size-3.5" /> Medio y estado del pago
        </dt>
        <dd className="mt-1 font-semibold">{paymentMethodLabel[order.payment_method]}</dd>
        <dd className="mt-1">
          <PaymentBadge status={order.payment_status} />
        </dd>
        {order.payment_method === 'efectivo' && order.payment_status === 'pendiente' && order.status !== 'cancelado' && (
          <dd className="mt-1 text-xs text-ink-2">Abonás {formatMoney(order.total)} al repartidor al recibir el pedido.</dd>
        )}
      </div>
    </dl>
  )
}

const FLOW: OrderStatus[] = ['recibido', 'en_preparacion', 'en_camino', 'entregado']

export function OrderTimeline({ order }: { order: Order }) {
  if (order.status === 'cancelado') {
    return (
      <div className="rounded-xl bg-zinc-100 p-4 text-sm">
        <StatusBadge status="cancelado" />
        <p className="mt-2 text-ink-2">Este pedido fue cancelado{order.cancelled_at ? ` el ${formatDateTime(order.cancelled_at)}` : ''}.</p>
      </div>
    )
  }
  const steps: OrderStatus[] = order.payment_method === 'mercadopago' ? ['pendiente_pago', 'pago_confirmado', 'en_preparacion', 'en_camino', 'entregado'] : FLOW
  const current = Math.max(0, steps.indexOf(order.status))
  const history = [...(order.order_status_history ?? [])].sort((x, y) => x.created_at.localeCompare(y.created_at))
  const when = (s: OrderStatus) => history.find((h) => h.status === s)?.created_at

  return (
    <ol className="relative space-y-4 pl-1">
      {steps.map((s, i) => {
        const done = i <= current
        const t = when(s) ?? (i === 0 ? order.created_at : undefined)
        return (
          <li key={s} className="relative flex items-start gap-3">
            {i < steps.length - 1 && <span className={`absolute left-[13px] top-7 h-[calc(100%-4px)] w-0.5 ${i < current ? 'bg-ink' : 'bg-line'}`} aria-hidden />}
            <span className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-full ${done ? 'bg-ink text-brand' : 'border-2 border-line bg-white'}`}>
              {done && <Check className="size-4" />}
            </span>
            <span className="pt-0.5">
              <span className={`block text-sm font-bold ${done ? '' : 'text-muted'}`}>{orderStatusLabel[s]}</span>
              {done && t && <span className="block text-xs text-muted">{formatDateTime(t)}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function PayWithMercadoPago({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  async function go() {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('mp-create-preference', { body: { order_id: orderId } })
    const url = (data as { init_point?: string } | null)?.init_point
    if (error || !url) {
      setBusy(false)
      toast('error', 'El pago electrónico no está disponible en este momento. Probá más tarde o comunicate con nosotros.')
      return
    }
    window.location.assign(url)
  }
  return (
    <button className="btn bg-[#009ee3] text-white hover:opacity-90" onClick={go} disabled={busy}>
      {busy ? <Spinner className="size-5 text-white" /> : <CreditCard className="size-5" />} Pagar con Mercado Pago
    </button>
  )
}
