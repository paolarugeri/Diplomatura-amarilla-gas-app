// Prueba integral del circuito de compra contra un Supabase local con los datos de prueba (seed.sql).
// Uso:  npx supabase db reset && npm run test:circuito
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_ANON_KEY
if (!ANON) throw new Error('Definí SUPABASE_ANON_KEY (ver tests/README.md)')

const P = {
  carga10: '10000000-0000-0000-0000-000000000001',
  carga45: '10000000-0000-0000-0000-000000000002',
  plastico10: '20000000-0000-0000-0000-000000000001',
  chapa10: '20000000-0000-0000-0000-000000000002',
  tubo45: '20000000-0000-0000-0000-000000000003',
}
const ADDR_LUCIA = 'd0000000-0000-0000-0000-000000000001'
const ADDR_MARTIN = 'd0000000-0000-0000-0000-000000000003'
const ADDR_SOFIA = 'd0000000-0000-0000-0000-000000000004'

async function login(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: 'Demo1234' })
  assert.ifError(error)
  return c
}
const order = (c, items, address, method = 'efectivo', key = crypto.randomUUID()) =>
  c.rpc('create_order', { p_items: items, p_address_id: address, p_payment_method: method, p_idempotency_key: key })

const lucia = await login('lucia.gomez@example.com')
const martin = await login('martin.perez@example.com')
const admin = await login('admin@amarillagas.com.ar')
const sofia = await login('sofia.rios@example.com')
const reparto = await login('reparto@amarillagas.com.ar')
const DRIVER = 'b0000000-0000-0000-0000-000000000001'
const anon = createClient(URL, ANON, { auth: { persistSession: false } })

test('precios calculados en el servidor: envase + carga', async () => {
  const cases = [
    [P.carga10, false, 32000],
    [P.carga45, false, 114000],
    [P.plastico10, false, 180000],
    [P.chapa10, false, 92000],
    [P.tubo45, false, 368000],
    [P.plastico10, true, 212000],
    [P.chapa10, true, 124000],
    [P.tubo45, true, 482000],
  ]
  for (const [id, withRefill, expected] of cases) {
    const { data, error } = await order(lucia, [{ product_id: id, with_refill: withRefill, quantity: 1 }], ADDR_LUCIA)
    assert.ifError(error)
    assert.equal(Number(data.total), expected, `${id} con carga=${withRefill}`)
    await admin.rpc('admin_update_order', { p_order_id: data.id, p_status: 'cancelado' }) // no ensuciar indicadores
  }
})

test('pedido combinado con varias cantidades y efectivo', async () => {
  const items = [
    { product_id: P.carga10, quantity: 3 },
    { product_id: P.chapa10, with_refill: true, quantity: 2 },
    { product_id: P.tubo45, with_refill: false, quantity: 1 },
  ]
  const { data, error } = await order(martin, items, ADDR_MARTIN)
  assert.ifError(error)
  assert.equal(Number(data.total), 3 * 32000 + 2 * 124000 + 368000)
  assert.equal(data.status, 'recibido')
  assert.equal(data.payment_status, 'pendiente')
  assert.match(data.order_number, /^AG-\d{6}$/)
  const { data: lines } = await martin.from('order_items').select('*').eq('order_id', data.id)
  assert.equal(lines.length, 3)
  const combo = lines.find((l) => l.product_id === P.chapa10)
  assert.equal(Number(combo.unit_base_price), 92000)
  assert.equal(Number(combo.unit_refill_price), 32000)
  assert.equal(Number(combo.subtotal), 248000)
})

test('idempotencia: reintentar la misma solicitud no duplica el pedido', async () => {
  const key = crypto.randomUUID()
  const items = [{ product_id: P.carga45, quantity: 2 }]
  const [a, b] = await Promise.all([order(lucia, items, ADDR_LUCIA, 'efectivo', key), order(lucia, items, ADDR_LUCIA, 'efectivo', key)])
  assert.ifError(a.error)
  assert.ifError(b.error)
  assert.equal(a.data.id, b.data.id)
})

test('prevención de duplicados: mismo pedido en menos de 2 minutos se rechaza', async () => {
  const items = [{ product_id: P.plastico10, with_refill: true, quantity: 3 }]
  const first = await order(lucia, items, ADDR_LUCIA)
  assert.ifError(first.error)
  const second = await order(lucia, items, ADDR_LUCIA)
  assert.match(second.error?.message ?? '', /idéntico/)
})

test('validaciones: cantidades, carrito vacío, domicilio ajeno y opción con carga inválida', async () => {
  let r = await order(lucia, [{ product_id: P.carga10, quantity: 0 }], ADDR_LUCIA)
  assert.match(r.error.message, /cantidad/i)
  r = await order(lucia, [{ product_id: P.carga10, quantity: 21 }], ADDR_LUCIA)
  assert.match(r.error.message, /cantidad/i)
  r = await order(lucia, [], ADDR_LUCIA)
  assert.match(r.error.message, /vacío/)
  r = await order(lucia, [{ product_id: P.carga10, quantity: 1 }], ADDR_MARTIN)
  assert.match(r.error.message, /domicilio/)
  r = await order(lucia, [{ product_id: P.carga10, with_refill: true, quantity: 1 }], ADDR_LUCIA)
  assert.match(r.error.message, /no admite/)
})

test('pago electrónico bloqueado mientras Mercado Pago no esté habilitado', async () => {
  const r = await order(lucia, [{ product_id: P.carga10, quantity: 4 }], ADDR_LUCIA, 'mercadopago')
  assert.match(r.error.message, /no está habilitado/)
})

test('sin sesión no se puede comprar ni ver pedidos', async () => {
  const r = await order(anon, [{ product_id: P.carga10, quantity: 1 }], ADDR_LUCIA)
  assert.ok(r.error)
  const { data } = await anon.from('orders').select('id')
  assert.equal(data.length, 0)
  const { data: prods } = await anon.from('products').select('id')
  assert.equal(prods.length, 5, 'el catálogo es público')
})

test('seguridad: un cliente solo ve sus datos y no puede modificar pedidos ni su rol', async () => {
  const { data: mine } = await lucia.from('orders').select('id, user_id')
  assert.ok(mine.length > 0)
  assert.ok(mine.every((o) => o.user_id === 'c0000000-0000-0000-0000-000000000001'))
  const { data: addrs } = await lucia.from('addresses').select('user_id')
  assert.ok(addrs.every((a) => a.user_id === 'c0000000-0000-0000-0000-000000000001'))

  const upd = await lucia.from('orders').update({ payment_status: 'pagado' }).eq('user_id', 'c0000000-0000-0000-0000-000000000001')
  assert.ok(upd.error, 'no debe poder marcar su pedido como pagado')

  const role = await lucia.from('profiles').update({ role: 'admin' }).eq('id', 'c0000000-0000-0000-0000-000000000001')
  assert.ok(role.error, 'no debe poder hacerse administrador')

  const price = await lucia.from('products').update({ price: 1 }).eq('id', P.carga10).select()
  assert.ok(price.error || price.data.length === 0, 'no debe poder cambiar precios')

  const dash = await lucia.rpc('admin_dashboard')
  assert.ok(dash.error)
  const st = await lucia.rpc('admin_update_order', { p_order_id: mine[0].id, p_status: 'entregado' })
  assert.ok(st.error)
  const mp = await lucia.rpc('apply_mp_payment', {
    p_order_id: '00000000-0000-0000-0000-000000000000', p_payment_id: 'x', p_status: 'approved', p_status_detail: null, p_amount: 1, p_raw: {},
  })
  assert.ok(mp.error, 'solo el servidor puede registrar pagos de la pasarela')
})

test('circuito de entrega por la empresa con cobro en efectivo', async () => {
  const { data: o } = await order(martin, [{ product_id: P.carga10, quantity: 2 }], ADDR_MARTIN)
  for (const s of ['en_preparacion', 'en_camino']) {
    const { error } = await admin.rpc('admin_update_order', { p_order_id: o.id, p_status: s })
    assert.ifError(error)
  }
  const bad = await admin.rpc('admin_update_order', { p_order_id: o.id, p_status: 'pago_confirmado' })
  assert.match(bad.error.message, /Pago confirmado/)
  const { data: done, error } = await admin.rpc('admin_update_order', { p_order_id: o.id, p_status: 'entregado', p_payment_status: 'pagado' })
  assert.ifError(error)
  assert.equal(done.status, 'entregado')
  assert.equal(done.payment_status, 'pagado')
  assert.ok(done.paid_at && done.delivered_at)
  const after = await admin.rpc('admin_update_order', { p_order_id: o.id, p_status: 'en_camino' })
  assert.ok(after.error, 'un pedido entregado no vuelve atrás')
  const { data: hist } = await martin.from('order_status_history').select('status').eq('order_id', o.id)
  assert.deepEqual(hist.map((h) => h.status).sort(), ['en_camino', 'en_preparacion', 'entregado', 'recibido'].sort())
})

test('pago electrónico: la empresa no puede marcarlo pagado; solo la pasarela', async () => {
  await admin.from('store_settings').update({ mp_enabled: true }).eq('id', 1)
  try {
    const { data: o, error } = await order(lucia, [{ product_id: P.tubo45, with_refill: true, quantity: 1 }], ADDR_LUCIA, 'mercadopago')
    assert.ifError(error)
    assert.equal(o.status, 'pendiente_pago')
    const r = await admin.rpc('admin_update_order', { p_order_id: o.id, p_status: 'pendiente_pago', p_payment_status: 'pagado' })
    assert.match(r.error.message, /Mercado Pago/)
    const r2 = await admin.rpc('admin_update_order', { p_order_id: o.id, p_status: 'en_camino' })
    assert.match(r2.error.message, /pendiente/)
    // Sin credenciales, la función de preferencia responde que no está configurada
    const pref = await lucia.functions.invoke('mp-create-preference', { body: { order_id: o.id } })
    assert.equal(pref.error?.context?.status, 503)
  } finally {
    await admin.from('store_settings').update({ mp_enabled: false }).eq('id', 1)
  }
})

test('el pedido conserva el precio de compra aunque cambie el catálogo', async () => {
  const { data: o } = await order(martin, [{ product_id: P.chapa10, with_refill: true, quantity: 1 }], ADDR_MARTIN)
  assert.equal(Number(o.total), 124000)
  const { error } = await admin.from('products').update({ price: 35000 }).eq('id', P.carga10)
  assert.ifError(error)
  try {
    const { data: again } = await martin.from('orders').select('total, order_items(unit_price)').eq('id', o.id).single()
    assert.equal(Number(again.total), 124000)
    assert.equal(Number(again.order_items[0].unit_price), 124000)
    const { data: o2 } = await order(martin, [{ product_id: P.chapa10, with_refill: true, quantity: 2 }], ADDR_MARTIN)
    assert.equal(Number(o2.total), 2 * (92000 + 35000), 'los pedidos nuevos usan el precio nuevo')
    const { data: hist } = await admin.from('product_prices').select('price').eq('product_id', P.carga10)
    assert.ok(hist.some((h) => Number(h.price) === 35000) && hist.some((h) => Number(h.price) === 32000))
  } finally {
    await admin.from('products').update({ price: 32000 }).eq('id', P.carga10)
  }
})

test('producto desactivado: desaparece del catálogo y no se puede comprar', async () => {
  await admin.from('products').update({ active: false }).eq('id', P.carga45)
  try {
    const { data } = await lucia.from('products').select('id')
    assert.ok(!data.some((p) => p.id === P.carga45))
    const r = await order(lucia, [{ product_id: P.carga45, quantity: 1 }], ADDR_LUCIA)
    assert.match(r.error.message, /no está disponible/)
  } finally {
    await admin.from('products').update({ active: true }).eq('id', P.carga45)
  }
})

test('correo de confirmación: se envía una sola vez y solo para pedidos propios', async () => {
  const { data: o } = await order(lucia, [{ product_id: P.carga10, quantity: 5 }], ADDR_LUCIA)
  const first = await lucia.functions.invoke('order-confirmation-email', { body: { order_id: o.id } })
  assert.ifError(first.error)
  assert.ok(['enviado', 'no_configurado'].includes(first.data.status))
  if (first.data.status === 'enviado') {
    const again = await lucia.functions.invoke('order-confirmation-email', { body: { order_id: o.id } })
    assert.equal(again.data.repeated, true)
  }
  const other = await martin.functions.invoke('order-confirmation-email', { body: { order_id: o.id } })
  assert.equal(other.error?.context?.status, 404)
})

test('el cliente cancela su pedido mientras no se empezó a preparar', async () => {
  const { data: o } = await order(lucia, [{ product_id: P.carga45, quantity: 1 }], ADDR_LUCIA)
  // Otro cliente no puede cancelarlo
  const ajeno = await martin.rpc('cancel_my_order', { p_order_id: o.id })
  assert.ok(ajeno.error)
  // El dueño sí, con motivo
  const { data: c, error } = await lucia.rpc('cancel_my_order', { p_order_id: o.id, p_reason: 'Me equivoqué de producto' })
  assert.ifError(error)
  assert.equal(c.status, 'cancelado')
  assert.ok(c.cancelled_at)
  const { data: h } = await lucia.from('order_status_history').select('*').eq('order_id', o.id).eq('status', 'cancelado').single()
  assert.equal(h.source, 'cliente')
  assert.match(h.note, /Me equivoqué/)
  // Repetir la cancelación no falla ni duplica el historial
  assert.ifError((await lucia.rpc('cancel_my_order', { p_order_id: o.id })).error)
  const { count } = await lucia.from('order_status_history').select('*', { count: 'exact', head: true }).eq('order_id', o.id).eq('status', 'cancelado')
  assert.equal(count, 1)
})

test('el cliente no puede cancelar un pedido que ya está en preparación', async () => {
  const { data: o } = await order(lucia, [{ product_id: P.chapa10, with_refill: true, quantity: 1 }], ADDR_LUCIA)
  assert.ifError((await admin.rpc('admin_update_order', { p_order_id: o.id, p_status: 'en_preparacion' })).error)
  const { error } = await lucia.rpc('cancel_my_order', { p_order_id: o.id })
  assert.match(error?.message ?? '', /ya se está preparando/)
  await admin.rpc('admin_update_order', { p_order_id: o.id, p_status: 'cancelado' })
})

test('avisos por correo: uno por cada estado, sin repetir y solo del estado real', async () => {
  const { data: o } = await order(martin, [{ product_id: P.plastico10, with_refill: true, quantity: 1 }], ADDR_MARTIN)
  const aviso = (c) => c.functions.invoke('order-confirmation-email', { body: { order_id: o.id, kind: 'estado' } })
  // "Recibido" no genera aviso (ya lo cubre la confirmación)
  assert.equal((await aviso(martin)).data.status, 'sin_aviso')
  for (const s of ['en_preparacion', 'en_camino']) {
    assert.ifError((await admin.rpc('admin_update_order', { p_order_id: o.id, p_status: s })).error)
    const r = await aviso(admin)
    assert.ifError(r.error)
    assert.equal(r.data.kind, `estado_${s}`)
    assert.ok(['enviado', 'no_configurado'].includes(r.data.status))
    if (r.data.status === 'enviado') assert.equal((await aviso(martin)).data.repeated, true)
  }
  // Otro cliente no puede pedir avisos de un pedido ajeno
  const other = await lucia.functions.invoke('order-confirmation-email', { body: { order_id: o.id, kind: 'estado' } })
  assert.equal(other.error?.context?.status, 404)
  assert.ifError((await admin.rpc('admin_update_order', { p_order_id: o.id, p_status: 'entregado', p_payment_status: 'pagado' })).error)
  assert.equal((await aviso(admin)).data.kind, 'estado_entregado')
  const { data: mails } = await admin.from('email_notifications').select('kind').eq('order_id', o.id)
  const kinds = mails.map((m) => m.kind)
  for (const k of ['estado_en_preparacion', 'estado_en_camino', 'estado_entregado']) assert.ok(kinds.includes(k), k)
})

test('avisos internos al negocio: pedido nuevo y cancelación del cliente con motivo', async () => {
  const { data: o } = await order(sofia, [{ product_id: P.carga10, quantity: 4 }], ADDR_SOFIA)
  const conf = await sofia.functions.invoke('order-confirmation-email', { body: { order_id: o.id } })
  assert.ifError(conf.error)
  assert.ifError((await sofia.rpc('cancel_my_order', { p_order_id: o.id, p_reason: 'Ya no lo necesito' })).error)
  const canc = await sofia.functions.invoke('order-confirmation-email', { body: { order_id: o.id, kind: 'estado' } })
  assert.ifError(canc.error)
  if (conf.data.status !== 'enviado') return // sin proveedor de correo configurado no hay nada más que verificar
  const { data: mails } = await admin.from('email_notifications').select('kind, status').eq('order_id', o.id)
  const kinds = mails.filter((m) => m.status === 'enviado').map((m) => m.kind)
  for (const k of ['confirmacion_pedido', 'empresa_pedido_nuevo', 'estado_cancelado', 'empresa_cancelado_cliente']) assert.ok(kinds.includes(k), k)
  // Repetir no reenvía los avisos internos
  await sofia.functions.invoke('order-confirmation-email', { body: { order_id: o.id } })
  const { count } = await admin.from('email_notifications').select('*', { count: 'exact', head: true }).eq('order_id', o.id).eq('kind', 'empresa_pedido_nuevo')
  assert.equal(count, 1)
})

test('indicadores del panel', async () => {
  const { data, error } = await admin.rpc('admin_dashboard')
  assert.ifError(error)
  assert.ok(data.orders_today >= 1)
  assert.ok(Number(data.sales_month) > 0)
  assert.equal(data.by_status.length, 7)
  assert.equal(data.by_payment.length, 2)
  assert.equal(data.last_days.length, 14)
})

test('repartidor: ve solo sus pedidos asignados y marca En camino / Entregado', async () => {
  const { data: o } = await order(martin, [{ product_id: P.carga10, quantity: 1 }], ADDR_MARTIN)
  // Sin asignar: el repartidor no lo ve ni lo puede mover
  assert.equal((await reparto.from('orders').select('id').eq('id', o.id)).data.length, 0)
  assert.ok((await reparto.rpc('driver_update_order', { p_order_id: o.id, p_status: 'en_camino' })).error)
  // Solo un admin asigna pedidos
  assert.ok((await martin.rpc('admin_assign_order', { p_order_id: o.id, p_driver_id: DRIVER })).error)
  assert.ifError((await admin.rpc('admin_assign_order', { p_order_id: o.id, p_driver_id: DRIVER })).error)
  assert.equal((await reparto.from('orders').select('id').eq('id', o.id)).data.length, 1)
  // No puede saltear "En camino" ni usar otros estados
  assert.ok((await reparto.rpc('driver_update_order', { p_order_id: o.id, p_status: 'entregado' })).error)
  assert.ok((await reparto.rpc('driver_update_order', { p_order_id: o.id, p_status: 'cancelado' })).error)
  assert.ifError((await reparto.rpc('driver_update_order', { p_order_id: o.id, p_status: 'en_camino' })).error)
  const { data: done, error } = await reparto.rpc('driver_update_order', { p_order_id: o.id, p_status: 'entregado' })
  assert.ifError(error)
  assert.equal(done.status, 'entregado')
  assert.equal(done.payment_status, 'pagado') // efectivo cobrado al entregar
  // El repartidor puede pedir el aviso por correo de su pedido
  assert.ifError((await reparto.functions.invoke('order-confirmation-email', { body: { order_id: o.id, kind: 'estado' } })).error)
})

test('permisos de perfiles: solo un admin cambia roles', async () => {
  const SOFIA = 'c0000000-0000-0000-0000-000000000003'
  assert.ok((await sofia.rpc('admin_set_user_role', { p_user_id: SOFIA, p_role: 'admin' })).error)
  assert.ok((await reparto.rpc('admin_set_user_role', { p_user_id: DRIVER, p_role: 'admin' })).error)
  assert.ok((await sofia.from('profiles').update({ role: 'admin' }).eq('id', SOFIA)).error)
  assert.ok((await admin.rpc('admin_set_user_role', { p_user_id: 'a0000000-0000-0000-0000-000000000001', p_role: 'cliente' })).error)
  const { data, error } = await admin.rpc('admin_set_user_role', { p_user_id: SOFIA, p_role: 'repartidor' })
  assert.ifError(error)
  assert.equal(data.role, 'repartidor')
  assert.ifError((await admin.rpc('admin_set_user_role', { p_user_id: SOFIA, p_role: 'cliente' })).error)
})
