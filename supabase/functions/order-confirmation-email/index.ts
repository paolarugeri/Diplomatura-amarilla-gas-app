// Envía los correos de un pedido al cliente:
//   * { order_id }                  -> confirmación del pedido (al comprar)
//   * { order_id, kind: 'estado' }  -> aviso del estado ACTUAL del pedido (en preparación, en camino,
//                                      entregado, cancelado, pago confirmado)
// - Verifica que el pedido pertenezca al usuario que llama (o que sea admin).
// - Es idempotente: cada correo (confirmación o aviso de un estado) se envía una sola vez.
// - El estado se lee de la base de datos: nadie puede pedir un aviso de un estado que el pedido no tiene.
// - Proveedores soportados:
//     * Resend (RESEND_API_KEY)                    -> recomendado para producción
//     * SMTP, por ejemplo Gmail (SMTP_HOST, ...)    -> alternativa sencilla
//     * Mailpit (MAILPIT_URL)                       -> solo desarrollo local: buzón de prueba de Supabase
//   Si no hay ninguno configurado, lo registra como "no_configurado" y no simula el envío.
// - Avisos internos para el negocio (a ADMIN_EMAIL o, si no está, a SMTP_USER):
//     * pedido nuevo, junto con la confirmación al cliente
//     * cancelación hecha por el cliente, con el motivo
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
type Order = any

function addressText(order: Order) {
  const a = order.delivery_address
  return `${a.street} ${a.number}${a.apartment ? `, ${a.apartment}` : ''}, ${a.city}, ${a.province} (CP ${a.postal_code})`
}

/** Estructura común de todos los correos (encabezado con logo, número de pedido, botón y pie). */
function layout(order: Order, opts: { title: string; intro: string; body: string; footer: string; buttonUrl?: string; buttonText?: string }) {
  const url = appUrl()
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Pedido ${order.order_number}</title></head>
<body style="margin:0;background:#f6f5f1;font-family:Montserrat,Arial,Helvetica,sans-serif;color:#1f1f1c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden">
  <tr><td style="background:#ffb01d;padding:22px 24px" align="center">
    <img src="${url}/img/logo.png" alt="Amarilla Gas" width="150" style="display:block;background:#fff;border-radius:12px;padding:10px 14px">
  </td></tr>
  <tr><td style="padding:26px 24px 8px">
    <h1 style="margin:0;font-size:22px;line-height:1.25">${opts.title}</h1>
    ${opts.intro}
  </td></tr>
  <tr><td style="padding:16px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:12px">
      <tr>
        <td style="padding:12px 14px;font-size:12px;color:#6b6a64">Número de pedido<br><b style="font-size:18px;color:#1f1f1c;white-space:nowrap">${order.order_number}</b></td>
        <td style="padding:12px 14px;font-size:12px;color:#6b6a64" align="right">Fecha y hora<br><b style="font-size:14px;color:#1f1f1c">${dateTime(order.created_at)}</b></td>
      </tr>
    </table>
  </td></tr>
  ${opts.body}
  <tr><td style="padding:20px 24px" align="center">
    <a href="${opts.buttonUrl ?? `${url}/mis-pedidos/${order.id}`}" style="display:inline-block;background:#1f1f1c;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:12px;font-size:15px">${opts.buttonText ?? 'Seguir mi pedido'}</a>
    ${opts.buttonUrl ? '' : '<p style="margin:18px 0 0;font-size:15px;font-weight:700">¡Gracias por confiar en nosotros!</p>'}
  </td></tr>
  <tr><td style="background:#1f1f1c;color:#d6d4cc;padding:16px 24px;font-size:12px" align="center">
    Amarilla Gas · Comercialización, fraccionamiento y distribución de GLP<br>${opts.footer}
  </td></tr>
</table></td></tr></table></body></html>`
}

function renderEmail(order: Order, items: Item[]) {
  const a = order.delivery_address
  const address = addressText(order)
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

  const html = layout(order, {
    title: '¡Tu pedido fue recibido correctamente!',
    intro: `<p style="margin:10px 0 0;font-size:15px">Hola <b>${escapeHtml(order.customer_name)}</b>, ¡gracias por elegirnos! Hemos registrado tu solicitud y ya estamos trabajando para coordinar la entrega.</p>
    <p style="margin:10px 0 0;font-size:15px">Recibirás tu pedido <b>${escapeHtml(eta)}</b> en el domicilio indicado.</p>`,
    body: `<tr><td style="padding:0 24px">
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
  </td></tr>`,
    footer: 'Este correo se generó automáticamente al registrar tu pedido.',
  })

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

/** Estados que generan un aviso por correo. "Recibido" y "Pendiente de pago" ya los cubre la confirmación. */
const STATUS_NOTICES: Record<string, { label: string; subject: string; title: string; message: (order: Order, byCustomer: boolean) => string }> = {
  pago_confirmado: {
    label: 'Pago confirmado',
    subject: 'Recibimos tu pago',
    title: '¡Recibimos tu pago!',
    message: (o) => `Mercado Pago nos confirmó el pago de <b>${money(o.total)}</b>. En breve empezamos a preparar tu pedido.`,
  },
  en_preparacion: {
    label: 'En preparación',
    subject: 'Estamos preparando tu pedido',
    title: 'Estamos preparando tu pedido',
    message: () => 'Ya estamos armando tu pedido. Te avisamos apenas salga para tu domicilio.',
  },
  en_camino: {
    label: 'En camino',
    subject: 'Tu pedido está en camino',
    title: '¡Tu pedido está en camino!',
    message: (o) =>
      `El repartidor ya salió hacia <b>${escapeHtml(addressText(o))}</b>. Asegurate de que haya alguien para recibirlo.` +
      (o.payment_method === 'efectivo' && o.payment_status !== 'pagado'
        ? `<br><br>Tené a mano <b>${money(o.total)}</b> para abonar en efectivo al recibir el pedido.`
        : ''),
  },
  entregado: {
    label: 'Entregado',
    subject: 'Tu pedido fue entregado',
    title: '¡Tu pedido fue entregado!',
    message: () => 'Registramos la entrega de tu pedido. Esperamos que todo haya llegado bien. ¡Te esperamos en tu próxima compra!',
  },
  cancelado: {
    label: 'Cancelado',
    subject: 'Tu pedido fue cancelado',
    title: 'Tu pedido fue cancelado',
    message: (o, byCustomer) =>
      (byCustomer
        ? 'Confirmamos la cancelación que hiciste desde la app. No tenés que abonar nada.'
        : 'Tuvimos que cancelar tu pedido. Si tenés dudas, respondé este correo o comunicate con nosotros.') +
      (o.payment_status === 'pagado' || o.payment_status === 'reintegrado'
        ? '<br><br>Como el pedido ya estaba pagado, vamos a gestionar el reintegro del importe.'
        : ''),
  },
}

function renderStatusEmail(order: Order, byCustomer: boolean) {
  const n = STATUS_NOTICES[order.status]
  const message = n.message(order, byCustomer)
  const html = layout(order, {
    title: n.title,
    intro: `<p style="margin:10px 0 0;font-size:15px">Hola <b>${escapeHtml(order.customer_name)}</b>,</p>
    <p style="margin:10px 0 0;font-size:15px;line-height:1.5">${message}</p>`,
    body: `<tr><td style="padding:0 24px;font-size:14px;line-height:1.6">
    <b>Estado actual:</b> ${n.label}<br>
    <b>Importe total:</b> ${money(order.total)} · ${methodLabel[order.payment_method] ?? order.payment_method}${order.status === 'cancelado' ? '' : ` (${payLabel[order.payment_status] ?? order.payment_status})`}
  </td></tr>`,
    footer: 'Este correo se generó automáticamente al cambiar el estado de tu pedido.',
  })
  const text = [
    n.title,
    `Hola ${order.customer_name},`,
    message.replace(/<br>/g, '\n').replace(/<[^>]+>/g, ''),
    `Pedido: ${order.order_number} · Total: ${money(order.total)}`,
    `Seguí tu pedido: ${appUrl()}/mis-pedidos/${order.id}`,
  ].join('\n')
  return { html, text, subject: `Amarilla Gas · ${n.subject} (${order.order_number})` }
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

const configured = () => Boolean(Deno.env.get('RESEND_API_KEY') || Deno.env.get('MAILPIT_URL') || Deno.env.get('SMTP_HOST'))

/** Correo interno del negocio: ADMIN_EMAIL o, si no está, la cuenta que envía los correos (SMTP_USER). */
const businessEmail = () => (Deno.env.get('ADMIN_EMAIL') || Deno.env.get('SMTP_USER') || '').trim()

/** Aviso interno para el negocio: pedido nuevo o cancelación hecha por el cliente. */
function renderBusinessEmail(order: Order, items: Item[], type: 'pedido' | 'cancelado', reason: string | null) {
  const a = order.delivery_address
  const rows = items.map((i) => `<li>${i.quantity} × ${escapeHtml(itemName(i))} · ${money(i.subtotal)}</li>`).join('')
  const isNew = type === 'pedido'
  const comment = isNew ? order.notes : reason
  const html = layout(order, {
    title: isNew ? 'Nuevo pedido recibido' : 'Un cliente canceló su pedido',
    intro: `<p style="margin:10px 0 0;font-size:15px;line-height:1.5"><b>${escapeHtml(order.customer_name)}</b> ${isNew ? 'hizo un pedido nuevo desde la app.' : 'canceló su pedido desde la app.'}</p>
    ${comment ? `<p style="margin:12px 0 0;padding:12px;background:#fff8e8;border-radius:10px;font-size:14px;color:#77560d"><b>${isNew ? 'Comentario del cliente' : 'Motivo de la cancelación'}:</b> ${escapeHtml(comment)}</p>` : isNew ? '' : '<p style="margin:12px 0 0;font-size:14px;color:#6b6a64">El cliente no indicó un motivo.</p>'}`,
    body: `<tr><td style="padding:0 24px;font-size:14px;line-height:1.6">
    <b>Cliente:</b> ${escapeHtml(order.customer_name)} · ${escapeHtml(order.customer_phone)} · ${escapeHtml(order.customer_email)}<br>
    <b>Domicilio:</b> ${escapeHtml(addressText(order))}${a.reference ? ` (${escapeHtml(a.reference)})` : ''}<br>
    <b>Pago:</b> ${methodLabel[order.payment_method] ?? order.payment_method} · ${payLabel[order.payment_status] ?? order.payment_status}<br>
    <b>Total:</b> ${money(order.total)}
    <ul style="margin:8px 0 0;padding-left:18px">${rows}</ul>
  </td></tr>`,
    footer: 'Aviso interno generado automáticamente por la app.',
    buttonUrl: `${appUrl()}/admin/pedidos`,
    buttonText: 'Ver en el panel',
  })
  const text = [
    isNew ? 'Nuevo pedido recibido' : 'Un cliente canceló su pedido',
    `Pedido: ${order.order_number} · ${dateTime(order.created_at)}`,
    `Cliente: ${order.customer_name} · ${order.customer_phone} · ${order.customer_email}`,
    `Domicilio: ${addressText(order)}`,
    ...items.map((i) => `- ${i.quantity} x ${itemName(i)} = ${money(i.subtotal)}`),
    `Total: ${money(order.total)} · ${methodLabel[order.payment_method]}`,
    comment ? `${isNew ? 'Comentario' : 'Motivo'}: ${comment}` : '',
  ].filter(Boolean).join('\n')
  const subject = isNew
    ? `Nuevo pedido ${order.order_number} · ${order.customer_name} · ${money(order.total)}`
    : `Pedido ${order.order_number} cancelado por el cliente`
  return { html, text, subject: `Amarilla Gas · ${subject}` }
}

/** Quien llama con la clave de servicio es otra función del servidor (por ejemplo, el aviso de Mercado Pago). */
function isServiceCall(req: Request) {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  return Boolean(key) && req.headers.get('Authorization') === `Bearer ${key}`
}

type Mail = { html: string; text: string; subject: string }

/** Envía un correo una sola vez por pedido y tipo, y deja registro en email_notifications. */
async function sendOnce(db: ReturnType<typeof adminClient>, orderId: string, kind: string, to: string, build: () => Mail | Promise<Mail>) {
  const { data: prev } = await db
    .from('email_notifications')
    .select('status')
    .eq('order_id', orderId)
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .limit(1)
  if (prev?.[0]?.status === 'enviado') return { status: 'enviado', kind, repeated: true }

  if (!configured()) {
    if (prev?.[0]?.status !== 'no_configurado') {
      await db.from('email_notifications').insert({
        order_id: orderId,
        kind,
        to_email: to,
        status: 'no_configurado',
        error: 'No hay proveedor de correo configurado (RESEND_API_KEY o SMTP_HOST).',
      })
    }
    return { status: 'no_configurado', kind }
  }

  try {
    const { id } = await send(to, await build())
    await db.from('email_notifications').insert({ order_id: orderId, kind, to_email: to, status: 'enviado', provider_message_id: id ?? null })
    return { status: 'enviado', kind }
  } catch (e) {
    console.error('Error enviando correo', kind, e)
    await db.from('email_notifications').insert({ order_id: orderId, kind, to_email: to, status: 'error', error: String(e).slice(0, 500) })
    return { status: 'error', kind }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const { order_id, kind: requested } = await req.json().catch(() => ({}))
  if (!order_id || typeof order_id !== 'string') return json({ error: 'Falta order_id' }, 400)
  const isStatus = requested === 'estado'

  // 1) El usuario solo puede pedir correos de un pedido que puede ver (RLS)
  if (!isServiceCall(req)) {
    const { data: visible } = await userClient(req).from('orders').select('id').eq('id', order_id).maybeSingle()
    if (!visible) return json({ error: 'Pedido no encontrado' }, 404)
  }

  const db = adminClient()
  const { data: order } = await db.from('orders').select('*, order_items(*)').eq('id', order_id).single()
  if (!order) return json({ error: 'Pedido no encontrado' }, 404)
  const items = order.order_items as Item[]
  const business = businessEmail()

  // 2) Confirmación al cliente + aviso de pedido nuevo al negocio
  if (!isStatus) {
    const result = await sendOnce(db, order_id, 'confirmacion_pedido', order.customer_email, () => renderEmail(order, items))
    if (business) await sendOnce(db, order_id, 'empresa_pedido_nuevo', business, () => renderBusinessEmail(order, items, 'pedido', null))
    return json(result, result.status === 'error' ? 502 : 200)
  }

  // 3) Aviso del estado actual al cliente (+ aviso al negocio si el cliente canceló)
  if (!STATUS_NOTICES[order.status]) return json({ status: 'sin_aviso' })
  const { data: last } = await db
    .from('order_status_history')
    .select('source, note')
    .eq('order_id', order_id)
    .eq('status', order.status)
    .order('created_at', { ascending: false })
    .limit(1)
  const byCustomer = last?.[0]?.source === 'cliente'
  const result = await sendOnce(db, order_id, `estado_${order.status}`, order.customer_email, () => renderStatusEmail(order, byCustomer))
  if (order.status === 'cancelado' && byCustomer && business) {
    const reason = (last?.[0]?.note ?? '').replace(/^Cancelado por el cliente:?\s*/, '').trim() || null
    await sendOnce(db, order_id, 'empresa_cancelado_cliente', business, () => renderBusinessEmail(order, items, 'cancelado', reason))
  }
  return json(result, result.status === 'error' ? 502 : 200)
})
