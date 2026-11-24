// Crea una preferencia de pago de Mercado Pago (Checkout Pro) para un pedido del cliente.
// Requiere el secreto MP_ACCESS_TOKEN. Sin él responde 503 y la app informa que el pago
// electrónico no está disponible (no se simula ninguna operación).
import { adminClient, appUrl, corsHeaders, json, userClient } from '../_shared/common.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const token = Deno.env.get('MP_ACCESS_TOKEN')
  if (!token) return json({ error: 'Mercado Pago no está configurado (falta MP_ACCESS_TOKEN).' }, 503)

  const { order_id } = await req.json().catch(() => ({}))
  if (!order_id) return json({ error: 'Falta order_id' }, 400)

  // El pedido debe pertenecer a quien llama (RLS)
  const { data: order } = await userClient(req).from('orders').select('*, order_items(*)').eq('id', order_id).maybeSingle()
  if (!order) return json({ error: 'Pedido no encontrado' }, 404)
  if (order.payment_method !== 'mercadopago') return json({ error: 'El pedido no es de pago electrónico.' }, 409)
  if (order.payment_status === 'pagado') return json({ error: 'El pedido ya está pagado.' }, 409)
  if (order.status === 'cancelado') return json({ error: 'El pedido está cancelado.' }, 409)

  const app = appUrl()
  const back = `${app}/pago/resultado?order=${order.id}`
  const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`

  const preference = {
    external_reference: order.id,
    // deno-lint-ignore no-explicit-any
    items: order.order_items.map((i: any) => ({
      id: i.sku,
      title: i.category === 'envase' ? `${i.product_name} ${i.with_refill ? '+ carga' : '(sin carga)'}` : i.product_name,
      quantity: i.quantity,
      unit_price: Number(i.unit_price),
      currency_id: 'ARS',
    })),
    payer: { name: order.customer_name, email: order.customer_email },
    back_urls: { success: back, pending: back, failure: back },
    auto_return: 'approved',
    notification_url: notificationUrl,
    statement_descriptor: 'AMARILLA GAS',
    metadata: { order_id: order.id, order_number: order.order_number },
  }

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `pref-${order.id}-${order.updated_at}`,
    },
    body: JSON.stringify(preference),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('Mercado Pago rechazó la preferencia', res.status, body)
    return json({ error: 'No se pudo iniciar el pago con Mercado Pago.' }, 502)
  }

  await adminClient()
    .from('payments')
    .insert({ order_id: order.id, provider: 'mercadopago', provider_preference_id: body.id, status: 'preferencia_creada', amount: order.total })

  return json({ init_point: body.init_point, preference_id: body.id })
})
