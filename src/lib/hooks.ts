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
