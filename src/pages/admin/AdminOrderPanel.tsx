import { useEffect, useState } from 'react'
import { Phone, X } from 'lucide-react'
import { supabase, friendlyError } from '../../lib/supabase'
import type { Order, OrderStatus, PaymentStatus } from '../../lib/types'
import { ORDER_STATUSES, formatDateTime, orderStatusLabel, paymentStatusLabel } from '../../lib/format'
import { ORDER_SELECT, OrderFacts, OrderItemsTable } from '../../components/OrderParts'
import { Alert, PageLoader, SelectField, Spinner, StatusBadge, TextAreaField } from '../../components/ui'
import { useToast } from '../../context/ToastContext'

const sourceLabel = { cliente: 'Cliente', admin: 'Empresa', pasarela: 'Mercado Pago', sistema: 'Sistema' }

export function AdminOrderPanel({ orderId, onClose, onChanged }: { orderId: string; onClose: () => void; onChanged: () => void }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [status, setStatus] = useState<OrderStatus>('recibido')
  const [pay, setPay] = useState<PaymentStatus>('pendiente')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  async function load() {
    const { data } = await supabase.from('orders').select(ORDER_SELECT).eq('id', orderId).single()
    const o = data as Order
    setOrder(o)
    setStatus(o.status)
    setPay(o.payment_status)
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save() {
    if (!order) return
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('admin_update_order', {
      p_order_id: order.id,
      p_status: status,
      p_payment_status: pay,
      p_note: note || null,
    })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    toast('success', `Pedido ${order.order_number} actualizado.`)
    setNote('')
    await load()
    onChanged()
  }

  const final = order && ['entregado', 'cancelado'].includes(order.status)
  const isMp = order?.payment_method === 'mercadopago'

  return (
    <div className="fixed inset-0 z-[1500] flex justify-end bg-black/40" onClick={onClose} role="dialog" aria-modal="true" aria-label="Detalle del pedido">
      <div className="h-full w-full max-w-xl overflow-y-auto bg-cream" onClick={(e) => e.stopPropagation()}>
        {!order ? (
          <PageLoader />
        ) : (
          <>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-brand px-5 py-4">
              <div>
                <p className="font-display text-xl font-extrabold">{order.order_number}</p>
                <p className="text-xs text-ink/75">{formatDateTime(order.created_at)}</p>
              </div>
              <button className="grid size-10 place-items-center rounded-full bg-white/70 hover:bg-white" onClick={onClose} aria-label="Cerrar">
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <section className="card p-4">
                <p className="text-xs font-bold uppercase text-muted">Cliente</p>
                <p className="font-bold">{order.customer_name}</p>
                <p className="text-sm text-ink-2">{order.customer_email}</p>
                <a href={`tel:${order.customer_phone.replace(/[^0-9+]/g, '')}`} className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-brand-800">
                  <Phone className="size-4" /> {order.customer_phone}
                </a>
              </section>

              <section className="card p-4">
                <OrderItemsTable order={order} />
                <div className="mt-3">
                  <OrderFacts order={order} />
                </div>
                {order.notes && (
                  <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm">
                    <b>Comentarios del cliente:</b> {order.notes}
                  </p>
                )}
              </section>

              <section className="card space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold">Actualizar estado</h3>
                  <StatusBadge status={order.status} />
                </div>
                {final ? (
                  <Alert tone="info">El pedido está {orderStatusLabel[order.status].toLowerCase()} y ya no admite cambios de estado.</Alert>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SelectField label="Estado del pedido" name="status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {orderStatusLabel[s]}
                          </option>
                        ))}
                      </SelectField>
                      <SelectField label="Estado del pago" name="pay" value={pay} onChange={(e) => setPay(e.target.value as PaymentStatus)} disabled={isMp}>
                        {(Object.keys(paymentStatusLabel) as PaymentStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {paymentStatusLabel[s]}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    {isMp ? (
                      <p className="text-xs text-muted">El estado de un pago electrónico lo informa únicamente Mercado Pago.</p>
                    ) : (
                      <p className="text-xs text-muted">Pago en efectivo: marcá “Pagado” cuando el repartidor cobre el importe.</p>
                    )}
                    <TextAreaField label="Nota interna (opcional)" name="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
                    {error && <Alert tone="error">{error}</Alert>}
                    <button className="btn-dark w-full" onClick={save} disabled={busy || (status === order.status && pay === order.payment_status)}>
                      {busy ? <Spinner className="size-5 text-white" /> : 'Guardar cambios'}
                    </button>
                  </>
                )}
              </section>

              <section className="card p-4">
                <h3 className="mb-3 font-extrabold">Historial</h3>
                <ol className="space-y-3 border-l-2 border-line pl-4">
                  {[...(order.order_status_history ?? [])]
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .map((h) => (
                      <li key={h.id} className="text-sm">
                        <p className="font-bold">
                          {orderStatusLabel[h.status]} · <span className="font-semibold text-ink-2">{paymentStatusLabel[h.payment_status]}</span>
                        </p>
                        <p className="text-xs text-muted">
                          {formatDateTime(h.created_at)} · {sourceLabel[h.source]}
                        </p>
                        {h.note && <p className="text-xs text-ink-2">{h.note}</p>}
                      </li>
                    ))}
                </ol>
                {(order.email_notifications ?? []).map((m, i) => (
                  <p key={i} className="mt-3 text-xs text-muted">
                    Correo de confirmación: <b>{m.status === 'enviado' ? 'enviado' : m.status === 'no_configurado' ? 'servicio no configurado' : 'error'}</b> ({formatDateTime(m.created_at)})
                  </p>
                ))}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
