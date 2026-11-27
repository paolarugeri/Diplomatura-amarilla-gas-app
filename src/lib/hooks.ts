import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { StoreSettings } from './types'

export function useSettings() {
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  useEffect(() => {
    supabase
      .from('store_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => setSettings(data as StoreSettings))
  }, [])
  return settings
}

/** Texto del plazo de entrega: se aclara "estimado" salvo disponibilidad operativa confirmada. */
export const etaText = (label: string, confirmed: boolean) => (confirmed ? label : `${label} (plazo estimado)`)

/** Pide al servidor el envío del correo de confirmación (la función es idempotente). */
export async function requestOrderEmail(orderId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('order-confirmation-email', { body: { order_id: orderId } })
    if (error) return 'error'
    return (data as { status?: string })?.status ?? null
  } catch {
    return 'error'
  }
}

/**
 * Pide al servidor el aviso por correo del estado actual del pedido (en preparación, en camino,
 * entregado, cancelado...). Es idempotente y no bloquea: si falla, el cambio de estado ya quedó guardado.
 */
export async function requestStatusEmail(orderId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('order-confirmation-email', { body: { order_id: orderId, kind: 'estado' } })
    if (error) return 'error'
    return (data as { status?: string })?.status ?? null
  } catch {
    return 'error'
  }
}

/** El cliente puede cancelar mientras el pedido no se empezó a preparar y no está pagado. */
export const customerCanCancel = (status: string, paymentStatus: string) =>
  ['recibido', 'pendiente_pago'].includes(status) && paymentStatus !== 'pagado'
