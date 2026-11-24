// Recibe las notificaciones de Mercado Pago.
// Nunca confía en el contenido de la notificación: valida la firma (si MP_WEBHOOK_SECRET está configurado)
// y consulta el pago directamente a la API de Mercado Pago antes de actualizar el pedido.
import { adminClient, json } from '../_shared/common.ts'

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: true })

  const token = Deno.env.get('MP_ACCESS_TOKEN')
  if (!token) return json({ error: 'Mercado Pago no configurado' }, 503)

  const url = new URL(req.url)
  const body = await req.json().catch(() => ({}))
  const type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? body.type ?? body.topic
  const dataId = String(url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? body?.data?.id ?? '')

  if (type !== 'payment' || !dataId) return json({ ignored: true })

  // Validación de firma (recomendado por Mercado Pago)
  const secret = Deno.env.get('MP_WEBHOOK_SECRET')
  if (secret) {
    const header = req.headers.get('x-signature') ?? ''
    const requestId = req.headers.get('x-request-id') ?? ''
    const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]))
    const idForManifest = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
    const manifest = `id:${idForManifest};request-id:${requestId};ts:${parts.ts};`
    const expected = await hmacHex(secret, manifest)
    if (!parts.v1 || !safeEqual(expected, parts.v1)) {
      console.warn('Firma de Mercado Pago inválida')
      return json({ error: 'Firma inválida' }, 401)
    }
  }

  // Consulta el pago real a la pasarela
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    console.error('No se pudo consultar el pago', dataId, res.status)
    return json({ error: 'Pago no encontrado' }, 502)
  }
  const payment = await res.json()
  const orderId = payment.external_reference ?? payment.metadata?.order_id
  if (!orderId) return json({ ignored: true, reason: 'sin referencia de pedido' })
  if (payment.currency_id && payment.currency_id !== 'ARS') return json({ error: 'Moneda inesperada' }, 422)

  const { error } = await adminClient().rpc('apply_mp_payment', {
    p_order_id: orderId,
    p_payment_id: String(payment.id),
    p_status: payment.status,
    p_status_detail: payment.status_detail ?? null,
    p_amount: payment.transaction_amount ?? null,
    p_raw: {
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      transaction_amount: payment.transaction_amount,
      payment_method_id: payment.payment_method_id,
      payment_type_id: payment.payment_type_id,
      date_approved: payment.date_approved,
      live_mode: payment.live_mode,
    },
  })
  if (error) {
    console.error('Error aplicando pago', error)
    return json({ error: error.message }, 500)
  }
  return json({ ok: true })
})
