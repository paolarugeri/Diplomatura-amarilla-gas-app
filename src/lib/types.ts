export type Role = 'cliente' | 'admin' | 'repartidor'

export interface Profile {
  id: string
  full_name: string
  email: string
  phone: string
  role: Role
  created_at: string
}

export interface Address {
  id: string
  user_id: string
  label: string
  street: string
  number: string
  apartment: string | null
  city: string
  province: string
  postal_code: string
  reference: string | null
  lat: number | null
  lng: number | null
  is_default: boolean
  created_at: string
}

export type AddressSnapshot = Pick<
  Address,
  'label' | 'street' | 'number' | 'apartment' | 'city' | 'province' | 'postal_code' | 'reference' | 'lat' | 'lng'
>

export type ProductCategory = 'carga' | 'envase'
export type ContainerType = 'chapa' | 'plastico' | 'propio'

export interface Product {
  id: string
  sku: string
  name: string
  category: ProductCategory
  capacity_kg: number
  container_type: ContainerType
  description: string
  image_url: string | null
  price: number
  refill_product_id: string | null
  active: boolean
  sort_order: number
}

export type OrderStatus =
  | 'recibido'
  | 'pendiente_pago'
  | 'pago_confirmado'
  | 'en_preparacion'
  | 'en_camino'
  | 'entregado'
  | 'cancelado'

export type PaymentStatus = 'pendiente' | 'pagado' | 'rechazado' | 'reintegrado'
export type PaymentMethod = 'mercadopago' | 'efectivo'

export interface OrderItem {
  id: number
  order_id: string
  product_id: string
  sku: string
  product_name: string
  category: ProductCategory
  capacity_kg: number
  container_type: ContainerType
  with_refill: boolean
  refill_name: string | null
  unit_base_price: number
  unit_refill_price: number
  unit_price: number
  quantity: number
  subtotal: number
}

export interface OrderHistory {
  id: number
  status: OrderStatus
  payment_status: PaymentStatus
  note: string | null
  source: 'cliente' | 'admin' | 'pasarela' | 'sistema' | 'repartidor'
  created_at: string
}

export interface Order {
  id: string
  order_number: string
  user_id: string
  address_id: string | null
  delivery_address: AddressSnapshot
  customer_name: string
  customer_email: string
  customer_phone: string
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  status: OrderStatus
  total: number
  items_count: number
  delivery_eta_label: string
  delivery_eta_confirmed: boolean
  notes: string | null
  created_at: string
  updated_at: string
  paid_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  /** Repartidor asignado (perfil con rol repartidor) */
  assigned_to: string | null
  assigned_at: string | null
  order_items?: OrderItem[]
  order_status_history?: OrderHistory[]
  email_notifications?: { kind?: string; status: string; created_at: string; error: string | null }[]
}

export interface StoreSettings {
  id: number
  delivery_eta_minutes: number
  delivery_eta_label: string
  delivery_eta_confirmed: boolean
  mp_enabled: boolean
  support_phone: string
  support_email: string
}

export interface PaymentMethodRow {
  code: PaymentMethod
  label: string
  description: string
  active: boolean
  sort_order: number
}
