import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Package, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'
import { formatAddress, formatDate, formatDateTime, formatMoney, itemName, paymentMethodLabel } from '../lib/format'
import { EmptyState, PageLoader, PageTitle, PaymentBadge, StatusBadge } from '../components/ui'
import { ORDER_SELECT, OrderFacts, OrderItemsTable, OrderTimeline, PayWithMercadoPago } from '../components/OrderParts'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

function useReorder() {
  const { add, products } = useCart()
  const toast = useToast()
  const navigate = useNavigate()
  return (order: Order) => {
    const active = new Set(products.map((p) => p.id))
    let added = 0
    let skipped = 0
    for (const i of order.order_items ?? []) {
      if (active.has(i.product_id)) {
        add(i.product_id, i.with_refill, i.quantity)
        added++
      } else skipped++
    }
    if (added === 0) {
      toast('error', 'Los productos de este pedido ya no están disponibles.')
      return
    }
    toast('success', skipped ? 'Agregamos los productos disponibles. Algunos ya no se venden.' : 'Agregamos los productos al carrito con los precios actuales.')
    navigate('/carrito')
  }
}

export function MyOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const reorder = useReorder()
  const { session } = useAuth()
  const uid = session?.user.id

  useEffect(() => {
    supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', uid!)
      .order('created_at', { ascending: false })
      .then(({ data }) => setOrders((data as Order[]) ?? []))
  }, [uid])

  if (!orders) return <PageLoader />

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Mis pedidos" subtitle="Consultá el estado y el detalle de tus compras." />
      {orders.length === 0 ? (
        <EmptyState
          icon={<Package className="size-8" />}
          title="Todavía no hiciste pedidos"
          text="Cuando compres, vas a poder seguir la entrega desde acá."
          action={
            <Link to="/catalogo" className="btn-primary">
              Hacer mi primer pedido
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="card overflow-hidden">
              <Link to={`/mis-pedidos/${o.id}`} className="block p-4 hover:bg-brand-50/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-extrabold">{o.order_number}</p>
                    <p className="text-xs text-muted">{formatDate(o.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-extrabold">{formatMoney(o.total)}</p>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink-2">
                  {(o.order_items ?? []).map((i) => `${i.quantity} × ${itemName(i)}`).join(' · ')}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>{paymentMethodLabel[o.payment_method]}</span>
                  <PaymentBadge status={o.payment_status} />
                  <span className="w-full truncate sm:w-auto">· {formatAddress(o.delivery_address)}</span>
                </div>
              </Link>
              <div className="flex border-t border-line">
                <button className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-bold hover:bg-black/5" onClick={() => reorder(o)}>
                  <RotateCcw className="size-4" /> Volver a comprar
                </button>
                <Link to={`/mis-pedidos/${o.id}`} className="flex flex-1 items-center justify-center gap-1 border-l border-line py-2.5 text-sm font-bold hover:bg-black/5">
                  Ver detalle <ChevronRight className="size-4" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function MyOrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  const reorder = useReorder()

  useEffect(() => {
    supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', id!)
      .maybeSingle()
      .then(({ data }) => setOrder((data as Order) ?? null))
  }, [id])

  if (order === undefined) return <PageLoader />
  if (!order) return <EmptyState icon={<Package className="size-8" />} title="No encontramos el pedido" action={<Link to="/mis-pedidos" className="btn-primary">Ver mis pedidos</Link>} />

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title={`Pedido ${order.order_number}`} subtitle={`Realizado el ${formatDateTime(order.created_at)}`} back="/mis-pedidos" />
      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="mb-3 font-extrabold">Productos</h2>
            <OrderItemsTable order={order} />
          </section>
          <section className="card p-5">
            <OrderFacts order={order} />
            {order.notes && <p className="mt-3 text-sm text-ink-2"><b>Comentarios:</b> {order.notes}</p>}
            {order.payment_method === 'mercadopago' && order.payment_status !== 'pagado' && order.status !== 'cancelado' && (
              <div className="mt-4">
                <PayWithMercadoPago orderId={order.id} />
              </div>
            )}
          </section>
        </div>
        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="mb-1 font-extrabold">Seguimiento</h2>
            <div className="mb-4">
              <StatusBadge status={order.status} />
            </div>
            <OrderTimeline order={order} />
            {!['entregado', 'cancelado'].includes(order.status) && (
              <p className="mt-4 text-xs text-muted">
                Entrega {order.delivery_eta_label}
                {!order.delivery_eta_confirmed && ' (estimado)'}.
              </p>
            )}
          </section>
          <button className="btn-primary w-full" onClick={() => reorder(order)}>
            <RotateCcw className="size-4" /> Volver a comprar
          </button>
        </aside>
      </div>
    </div>
  )
}
