import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarClock, Clock, Mail, MailWarning, PartyPopper } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { requestOrderEmail } from '../lib/hooks'
import { formatLongDateTime, formatMoney, paymentMethodLabel } from '../lib/format'
import type { Order } from '../lib/types'
import { EmptyState, PageLoader, PaymentBadge } from '../components/ui'
import { ORDER_SELECT, OrderFacts, OrderItemsTable, PayWithMercadoPago } from '../components/OrderParts'

export default function OrderConfirmation() {
  const { id } = useParams()
  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)
  const asked = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('orders').select(ORDER_SELECT).eq('id', id!).maybeSingle()
      if (cancelled) return
      const o = (data as Order) ?? null
      setOrder(o)
      if (!o) return
      const last = [...(o.email_notifications ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      if (last) setEmailStatus(last.status)
      else if (!asked.current) {
        // Si el correo no se pidió todavía (p. ej. se cerró la pestaña), se solicita ahora.
        asked.current = true
        setEmailStatus(await requestOrderEmail(o.id))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (order === undefined) return <PageLoader />
  if (!order) return <EmptyState icon={<Clock className="size-8" />} title="No encontramos el pedido" action={<Link to="/mis-pedidos" className="btn-primary">Ver mis pedidos</Link>} />

  const firstName = order.customer_name.split(' ')[0]
  const etaLabel = order.delivery_eta_label

  return (
    <div className="mx-auto max-w-2xl">
      <section className="relative overflow-hidden rounded-3xl bg-brand px-6 pb-8 pt-8 text-center">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/20" aria-hidden />
        <div className="absolute -bottom-16 -left-10 size-48 rounded-full bg-white/15" aria-hidden />
        <div className="relative">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-ink text-brand shadow-lg">
            <PartyPopper className="size-8" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold leading-tight md:text-3xl">¡Tu pedido fue recibido correctamente!</h1>
          <p className="mt-1 font-display text-lg font-bold">¡Gracias por elegirnos, {firstName}!</p>
          <div className="mx-auto mt-4 max-w-md space-y-2 text-[15px] text-ink/85">
            <p>Hemos registrado tu solicitud y ya estamos trabajando para coordinar la entrega.</p>
            <p className="font-semibold text-ink">
              Recibirás tu pedido {etaLabel} en el domicilio indicado.
              {!order.delivery_eta_confirmed && <span className="block text-xs font-normal text-ink/70">Plazo estimado, sujeto a disponibilidad operativa.</span>}
            </p>
            {emailStatus === 'enviado' && <p>Te enviamos un correo electrónico con el detalle de tu compra y la confirmación de tu pedido.</p>}
            <p className="font-display font-bold">¡Gracias por confiar en nosotros!</p>
          </div>
        </div>
      </section>

      {emailStatus && emailStatus !== 'enviado' && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-white p-3 text-xs text-ink-2 shadow-card">
          <MailWarning className="mt-0.5 size-4 shrink-0 text-warn" />
          {emailStatus === 'no_configurado'
            ? 'El envío automático de correos todavía no está configurado en este entorno, por eso no recibirás el correo de confirmación. Podés consultar tu pedido en "Mis pedidos".'
            : 'No pudimos enviar el correo de confirmación. Tu pedido está registrado y podés consultarlo en "Mis pedidos".'}
        </p>
      )}
      {emailStatus === 'enviado' && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <Mail className="size-4" /> Correo enviado a {order.customer_email}
        </p>
      )}

      <section className="card mt-4 p-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Número de pedido</p>
            <p className="font-display text-xl font-extrabold">{order.order_number}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Importe total</p>
            <p className="font-display text-xl font-extrabold">{formatMoney(order.total)}</p>
          </div>
          <div className="col-span-2 flex items-center gap-2 text-ink-2">
            <CalendarClock className="size-4" /> {formatLongDateTime(order.created_at)}
          </div>
          <div className="col-span-2 flex flex-wrap items-center gap-2">
            <span className="text-ink-2">{paymentMethodLabel[order.payment_method]}:</span>
            <PaymentBadge status={order.payment_status} />
          </div>
        </div>

        <div className="mt-4">
          <OrderItemsTable order={order} />
        </div>
        <div className="mt-4">
          <OrderFacts order={order} />
        </div>

        {order.payment_method === 'mercadopago' && order.payment_status !== 'pagado' && order.status !== 'cancelado' && (
          <div className="mt-4 rounded-xl bg-sky-50 p-4 text-sm ring-1 ring-sky-200">
            <p className="mb-3">Tu pago electrónico todavía no fue confirmado por Mercado Pago.</p>
            <PayWithMercadoPago orderId={order.id} />
          </div>
        )}
      </section>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link to={`/mis-pedidos/${order.id}`} className="btn-dark flex-1">
          Seguir mi pedido
        </Link>
        <Link to="/catalogo" className="btn-outline flex-1">
          Volver al catálogo
        </Link>
      </div>
    </div>
  )
}
