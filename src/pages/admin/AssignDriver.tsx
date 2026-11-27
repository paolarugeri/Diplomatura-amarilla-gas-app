import { useEffect, useState } from 'react'
import { Truck } from 'lucide-react'
import { friendlyError, supabase } from '../../lib/supabase'
import type { Order, Profile } from '../../lib/types'
import { Spinner } from '../../components/ui'
import { useToast } from '../../context/ToastContext'

export type Driver = Pick<Profile, 'id' | 'full_name' | 'phone'>

/** Lista de usuarios con perfil de repartidor (solo la ve un administrador). */
export function useDrivers() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'repartidor')
      .order('full_name')
      .then(({ data }) => setDrivers((data as Driver[]) ?? []))
  }, [])
  return drivers
}

/** Selector para asignar (o quitar) el repartidor de un pedido. */
export function AssignDriver({ order, drivers, onChanged, compact = false }: { order: Order; drivers: Driver[]; onChanged: () => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const final = ['entregado', 'cancelado'].includes(order.status)
  const current = drivers.find((d) => d.id === order.assigned_to)

  async function assign(driverId: string) {
    setBusy(true)
    const { error } = await supabase.rpc('admin_assign_order', { p_order_id: order.id, p_driver_id: driverId || null })
    setBusy(false)
    if (error) return toast('error', friendlyError(error))
    const name = drivers.find((d) => d.id === driverId)?.full_name
    toast('success', name ? `${order.order_number} asignado a ${name}.` : `${order.order_number} quedó sin repartidor.`)
    onChanged()
  }

  if (final)
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Truck className="size-3.5" /> {current ? `Repartidor: ${current.full_name}` : 'Sin repartidor asignado'}
      </p>
    )

  return (
    <label className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <Truck className="size-4 shrink-0 text-muted" aria-hidden />
      <span className="sr-only">Repartidor asignado</span>
      <select
        className={`input ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'}`}
        value={order.assigned_to ?? ''}
        disabled={busy}
        onChange={(e) => assign(e.target.value)}
      >
        <option value="">{drivers.length ? 'Sin repartidor asignado' : 'No hay repartidores (asignalos en Permisos)'}</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.full_name}
          </option>
        ))}
      </select>
      {busy && <Spinner className="size-4" />}
    </label>
  )
}
