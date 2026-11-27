// Envía el correo de confirmación de un pedido al cliente.
// - Verifica que el pedido pertenezca al usuario que llama (o que sea admin).
// - Es idempotente: si ya se envió, no lo repite.
// - Proveedores soportados:
//     * Resend (RESEND_API_KEY)                    -> recomendado para producción
//     * SMTP, por ejemplo Gmail (SMTP_HOST, ...)    -> alternativa sencilla
//     * Mailpit (MAILPIT_URL)                       -> solo desarrollo local: buzón de prueba de Supabase
//   Si no hay ninguno configurado, lo registra como "no_configurado" y no simula el envío.
// - Destinatario: por defecto, el correo del cliente. Si se define EMAIL_TO, todas las
//   confirmaciones se envían a esa dirección (útil para demos o cuando el proveedor solo
//   permite enviar a una cuenta verificada).
import { adminClient, appUrl, corsHeaders, dateTime, escapeHtml, json, money, userClient } from '../_shared/common.ts'

interface Item {
  product_name: string
  category: string
  with_refill: boolean
  unit_price: number
  quantity: number
  subtotal: number
}

const methodLabel: Record<string, string> = {
  mercadopago: 'Pago electrónico (Mercado Pago)',
  efectivo: 'Efectivo contra entrega',
}
const payLabel: Record<string, string> = {
  pendiente: 'Pendiente de pago',
  pagado: 'Pagado',
  rechazado: 'Rechazado',
  reintegrado: 'Reintegrado',
}

function itemName(i: Item) {
  if (i.category !== 'envase') return i.product_name
  return `${i.product_name} ${i.with_refill ? '+ carga de GLP' : '(sin carga)'}`
}

// deno-lint-ignore no-explicit-any
function renderEmail(order: any, items: Item[]) {
  const a = order.delivery_address
  const address = `${a.street} ${a.number}${a.apartment ? `, ${a.apartment}` : ''}, ${a.city}, ${a.province} (CP ${a.postal_code})`
  const eta = `${order.delivery_eta_label}${order.delivery_eta_confirmed ? '' : ' (plazo estimado)'}`
  const url = appUrl()
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;color:#1f1f1c">${escapeHtml(itemName(i))}</td>
        <td style="padding:10px 6px;border-bottom:1px solid #eee;font-size:14px;text-align:center">${i.quantity}</td>
        <td style="padding:10px 6px;border-bottom:1px solid #eee;font-size:14px;text-align:right;white-space:nowrap">${money(i.unit_price)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:right;white-space:nowrap;font-weight:700">${money(i.subtotal)}</td>
      </tr>`,
    )
    .join('')

  const cashNote =
    order.payment_method === 'efectivo'
      ? `<p style="margin:12px 0 0;padding:12px;background:#fff8e8;border-radius:10px;font-size:13px;color:#77560d">Recordá que el importe de <b>${money(order.total)}</b> se abona en efectivo al repartidor al recibir los productos.</p>`
      : ''

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Pedido ${order.order_number}</title></head>
<body style="margin:0;background:#f6f5f1;font-family:Montserrat,Arial,Helvetica,sans-serif;color:#1f1f1c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden">
  <tr><td style="background:#ffb01d;padding:22px 24px" align="center">
    <img src="${url}/img/logo.png" alt="Amarilla Gas" width="150" style="display:block;background:#fff;border-radius:12px;padding:10px 14px">
  </td></tr>
  <tr><td style="padding:26px 24px 8px">
    <h1 style="margin:0;font-size:22px;line-height:1.25">¡Tu pedido fue recibido correctamente!</h1>
    <p style="margin:10px 0 0;font-size:15px">Hola <b>${escapeHtml(order.customer_name)}</b>, ¡gracias por elegirnos! Hemos registrado tu solicitud y ya estamos trabajando para coordinar la entrega.</p>
    <p style="margin:10px 0 0;font-size:15px">Recibirás tu pedido <b>${escapeHtml(eta)}</b> en el domicilio indicado.</p>
  </td></tr>
  <tr><td style="padding:16px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:12px">
      <tr>
        <td style="padding:12px 14px;font-size:12px;color:#6b6a64">Número de pedido<br><b style="font-size:18px;color:#1f1f1c;white-space:nowrap">${order.order_number}</b></td>
        <td style="padding:12px 14px;font-size:12px;color:#6b6a64" align="right">Fecha y hora<br><b style="font-size:14px;color:#1f1f1c">${dateTime(order.created_at)}</b></td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:12px;border-collapse:separate;overflow:hidden">
      <tr style="background:#1f1f1c;color:#fff">
        <th style="padding:10px 12px;font-size:12px;text-align:left">Producto</th>
        <th style="padding:10px 6px;font-size:12px">Cant.</th>
        <th style="padding:10px 6px;font-size:12px;text-align:right">Unitario</th>
        <th style="padding:10px 12px;font-size:12px;text-align:right">Subtotal</th>
      </tr>
      ${rows}
      <tr style="background:#fff8e8">
        <td colspan="3" style="padding:12px;font-size:15px;font-weight:700">Importe total</td>
        <td style="padding:12px;font-size:18px;font-weight:800;text-align:right;white-space:nowrap">${money(order.total)}</td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:16px 24px 4px;font-size:14px;line-height:1.6">
    <b>Domicilio de entrega:</b> ${escapeHtml(address)}${a.reference ? `<br><span style="color:#6b6a64">Referencias: ${escapeHtml(a.reference)}</span>` : ''}<br>
    <b>Medio de pago:</b> ${methodLabel[order.payment_method] ?? order.payment_method}<br>
    <b>Estado del pago:</b> ${payLabel[order.payment_status] ?? order.payment_status}<br>
    <b>Plazo estimado de entrega:</b> ${escapeHtml(eta)}
    ${cashNote}
  </td></tr>
  <tr><td style="padding:20px 24px" align="center">
    <a href="${url}/mis-pedidos/${order.id}" style="display:inline-block;background:#1f1f1c;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:12px;font-size:15px">Seguir mi pedido</a>
    <p style="margin:18px 0 0;font-size:15px;font-weight:700">¡Gracias por confiar en nosotros!</p>
  </td></tr>
  <tr><td style="background:#1f1f1c;color:#d6d4cc;padding:16px 24px;font-size:12px" align="center">
    Amarilla Gas · Comercialización, fraccionamiento y distribución de GLP<br>Este correo se generó automáticamente al registrar tu pedido.
  </td></tr>
</table></td></tr></table></body></html>`

  const text = [
    `¡Tu pedido fue recibido correctamente!`,
    `Hola ${order.customer_name}, gracias por elegirnos.`,
    `Pedido: ${order.order_number} · ${dateTime(order.created_at)}`,
    ...items.map((i) => `- ${i.quantity} x ${itemName(i)} (${money(i.unit_price)} c/u) = ${money(i.subtotal)}`),
    `Total: ${money(order.total)}`,
    `Domicilio: ${address}`,
    `Medio de pago: ${methodLabel[order.payment_method]} · Estado: ${payLabel[order.payment_status]}`,
    `Entrega: ${eta}`,
    `Seguí tu pedido: ${url}/mis-pedidos/${order.id}`,
  ].join('\n')

  return { html, text, subject: `Amarilla Gas · Confirmación de tu pedido ${order.order_number}` }
}

async function send(to: string, mail: { html: string; text: string; subject: string }): Promise<{ id?: string }> {
  const from = Deno.env.get('EMAIL_FROM') ?? 'Amarilla Gas <onboarding@resend.dev>'
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(body)}`)
    return { id: body.id }
  }
  const mailpit = Deno.env.get('MAILPIT_URL')
  if (mailpit) {
    const m = /^(.*)<(.+)>$/.exec(from)
    const res = await fetch(`${mailpit.replace(/\/$/, '')}/api/v1/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: m ? { Name: m[1].trim(), Email: m[2].trim() } : { Email: from },
        To: [{ Email: to }],
        Subject: mail.subject,
        HTML: mail.html,
        Text: mail.text,
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`Mailpit ${res.status}: ${JSON.stringify(body)}`)
    return { id: body.ID }
  }
  // SMTP: se carga solo si se usa
  const { default: nodemailer } = await import('npm:nodemailer@6.9.16')
  const host = Deno.env.get('SMTP_HOST')
  const port = Number(Deno.env.get('SMTP_PORT') ?? '465')
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: Deno.env.get('SMTP_USER') ? { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASS') } : undefined,
  })
  const info = await transport.sendMail({ from, to, subject: mail.subject, html: mail.html, text: mail.text })
  return { id: info.messageId }
}

/** Dirección a la que se envía la confirmación: EMAIL_TO si está definida, si no el correo del cliente. */
const recipient = (customerEmail: string) => Deno.env.get('EMAIL_TO')?.trim() || customerEmail

const configured = () => Boolean(Deno.env.get('RESEND_API_KEY') || Deno.env.get('MAILPIT_URL') || Deno.env.get('SMTP_HOST'))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const { order_id } = await req.json().catch(() => ({}))
  if (!order_id || typeof order_id !== 'string') return json({ error: 'Falta order_id' }, 400)

  // 1) El usuario solo puede pedir el correo de un pedido que puede ver (RLS)
  const { data: visible } = await userClient(req).from('orders').select('id').eq('id', order_id).maybeSingle()
  if (!visible) return json({ error: 'Pedido no encontrado' }, 404)

  const db = adminClient()

  // 2) Idempotencia
  const { data: prev } = await db
    .from('email_notifications')
    .select('status')
    .eq('order_id', order_id)
    .eq('kind', 'confirmacion_pedido')
    .order('created_at', { ascending: false })
    .limit(1)
  if (prev?.[0]?.status === 'enviado') return json({ status: 'enviado', repeated: true })

  const { data: order } = await db.from('orders').select('*, order_items(*)').eq('id', order_id).single()
  if (!order) return json({ error: 'Pedido no encontrado' }, 404)
  const to = recipient(order.customer_email)

  if (!configured()) {
    if (prev?.[0]?.status !== 'no_configurado') {
      await db.from('email_notifications').insert({
        order_id,
        to_email: to,
        status: 'no_configurado',
        error: 'No hay proveedor de correo configurado (RESEND_API_KEY o SMTP_HOST).',
      })
    }
    return json({ status: 'no_configurado' })
  }

  try {
    const mail = renderEmail(order, order.order_items as Item[])
    const { id } = await send(to, mail)
    await db.from('email_notifications').insert({ order_id, to_email: to, status: 'enviado', provider_message_id: id ?? null })
    return json({ status: 'enviado' })
  } catch (e) {
    console.error('Error enviando correo', e)
    await db.from('email_notifications').insert({ order_id, to_email: to, status: 'error', error: String(e).slice(0, 500) })
    return json({ status: 'error' }, 502)
  }
})
