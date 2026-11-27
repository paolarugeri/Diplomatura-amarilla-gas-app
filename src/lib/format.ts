import type { ContainerType, OrderStatus, PaymentMethod, PaymentStatus, AddressSnapshot, Role } from './types'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
export const formatMoney = (n: number | string) => money.format(Number(n))

const TZ = 'America/Argentina/Buenos_Aires'
export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ }).format(new Date(iso)) + ' h'
export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ }).format(new Date(iso))
export const formatLongDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ }).format(new Date(iso)) + ' h'

export const containerLabel: Record<ContainerType, string> = {
  chapa: 'Chapa (acero)',
  plastico: 'Plástico',
  propio: 'Envase propio',
}

export const orderStatusLabel: Record<OrderStatus, string> = {
  recibido: 'Pedido recibido',
  pendiente_pago: 'Pendiente de pago',
  pago_confirmado: 'Pago confirmado',
  en_preparacion: 'En preparación',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export const ORDER_STATUSES = Object.keys(orderStatusLabel) as OrderStatus[]

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pendiente: 'Pendiente de pago',
  pagado: 'Pagado',
  rechazado: 'Rechazado',
  reintegrado: 'Reintegrado',
}

export const roleLabel: Record<Role, string> = {
  cliente: 'Cliente',
  admin: 'Administrador',
  repartidor: 'Repartidor',
}

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  mercadopago: 'Pago electrónico (Mercado Pago)',
  efectivo: 'Efectivo contra entrega',
}

export const formatAddress = (a: AddressSnapshot) =>
  `${a.street} ${a.number}${a.apartment ? `, ${a.apartment}` : ''}, ${a.city}, ${a.province} (CP ${a.postal_code})`

export const itemName = (i: { product_name: string; with_refill: boolean; category: string }) =>
  i.category === 'envase' ? `${i.product_name} ${i.with_refill ? '+ carga de GLP' : '(sin carga)'}` : i.product_name
