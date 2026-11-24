import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'
import { formatMoney } from '../lib/format'
import { PageLoader, PaymentBadge } from '../components/ui'
import { PayWithMercadoPago } from '../components/OrderParts'

/**
 * Página de regreso desde Mercado Pago.
 * No confía en los parámetros de la URL: consulta el estado real del pedido en la base,
 * que solo se actualiza cuando el servidor recibe la notificación válida de la pasarela.
 */
export default function PaymentResult() {
  const [params] = useSearchParams()
  const orderId = params.get('order') ?? params.get('external_reference')
  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    if (!orderId) {
      setOrder(null)
      return
    }
    let timer: ReturnType<typeof setTimeout>
    const load = async () => {
      const { data } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
      const o = (data as Order) ?? null
      setOrder(o)
      if (o && o.payment_status === 'pendiente' && tries < 10) timer = setTimeout(() => setTries((t) => t + 1), 3000)
    }
    load()
    return () => clearTimeout(timer)
  }, [orderId, tries])

  if (order === undefined) return <PageLoader />
  if (!order)
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-muted">No encontramos el pedido asociado al pago.</p>
        <Link to="/mis-pedidos" className="btn-primary mt-4">
          Ver mis pedidos
        </Link>
      </div>
    )

  const paid = order.payment_status === 'pagado'
  const rejected = order.payment_status === 'rechazado'
  const Icon = paid ? CheckCircle2 : rejected ? XCircle : Clock

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6 text-center">
        <Icon className={`mx-auto size-14 ${paid ? 'text-ok' : rejected ? 'text-bad' : 'text-warn'}`} />
        <h1 className="mt-3 text-2xl font-extrabold">{paid ? '¡Pago acreditado!' : rejected ? 'El pago fue rechazado' : 'Estamos esperando la confirmación del pago'}</h1>
        <p className="mt-2 text-sm text-ink-2">
          Pedido <b>{order.order_number}</b> · {formatMoney(order.total)}
        </p>
        <div className="mt-2">
          <PaymentBadge status={order.payment_status} />
        </div>
        {!paid && !rejected && (
          <p className="mt-3 text-xs text-muted">
            Mercado Pago puede demorar unos minutos en informarnos el resultado. Esta pantalla se actualiza sola.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          {paid ? (
            <Link to={`/pedido/${order.id}/confirmado`} className="btn-primary">
              Ver confirmación del pedido
            </Link>
          ) : (
            <>
              {rejected && <PayWithMercadoPago orderId={order.id} />}
              <Link to={`/mis-pedidos/${order.id}`} className="btn-outline">
                Ver mi pedido
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
