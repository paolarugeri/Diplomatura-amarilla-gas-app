import { useEffect, useState, type FormEvent } from 'react'
import { CreditCard, Mail, Truck } from 'lucide-react'
import { friendlyError, supabase } from '../../lib/supabase'
import type { StoreSettings } from '../../lib/types'
import { Alert, Field, PageLoader, PageTitle, Spinner } from '../../components/ui'
import { useToast } from '../../context/ToastContext'

export default function AdminSettings() {
  const [s, setS] = useState<StoreSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  useEffect(() => {
    supabase
      .from('store_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => setS(data as StoreSettings))
  }, [])

  if (!s) return <PageLoader />

  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => setS({ ...s, [k]: v })

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!s) return
    setError('')
    if (s.delivery_eta_minutes < 15 || s.delivery_eta_minutes > 2880) return setError('El plazo debe estar entre 15 minutos y 48 horas.')
    if (s.delivery_eta_label.trim().length < 5) return setError('Escribí cómo se muestra el plazo al cliente.')
    setBusy(true)
    const { error } = await supabase
      .from('store_settings')
      .update({
        delivery_eta_minutes: s.delivery_eta_minutes,
        delivery_eta_label: s.delivery_eta_label.trim(),
        delivery_eta_confirmed: s.delivery_eta_confirmed,
        mp_enabled: s.mp_enabled,
        support_phone: s.support_phone.trim(),
        support_email: s.support_email.trim(),
      })
      .eq('id', 1)
    setBusy(false)
    if (error) return setError(friendlyError(error))
    toast('success', 'Configuración guardada.')
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-4" noValidate>
      <PageTitle title="Configuración" subtitle="Plazos de entrega, medios de pago y datos de contacto." />
      {error && <Alert tone="error">{error}</Alert>}

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-extrabold">
          <Truck className="size-5" /> Plazo de entrega
        </h2>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <Field
            label="Minutos"
            name="eta_min"
            type="number"
            min={15}
            max={2880}
            value={s.delivery_eta_minutes}
            onChange={(e) => set('delivery_eta_minutes', Number(e.target.value))}
          />
          <Field
            label="Texto que ve el cliente"
            name="eta_label"
            value={s.delivery_eta_label}
            onChange={(e) => set('delivery_eta_label', e.target.value)}
            hint="Se muestra como: “Recibirás tu pedido … en el domicilio indicado.”"
          />
        </div>
        <label className="flex items-start gap-3 rounded-xl bg-cream p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 accent-brand-700" checked={s.delivery_eta_confirmed} onChange={(e) => set('delivery_eta_confirmed', e.target.checked)} />
          <span>
            <b>Disponibilidad operativa confirmada</b>
            <span className="block text-muted">Si está desmarcado, el plazo se informa como estimado.</span>
          </span>
        </label>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-extrabold">
          <CreditCard className="size-5" /> Pago electrónico (Mercado Pago)
        </h2>
        <label className="flex items-start gap-3 rounded-xl bg-cream p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 accent-brand-700" checked={s.mp_enabled} onChange={(e) => set('mp_enabled', e.target.checked)} />
          <span>
            <b>Habilitar pago electrónico en la tienda</b>
            <span className="block text-muted">
              Activalo solo después de cargar el Access Token de Mercado Pago en Supabase (ver docs/CONFIGURACION.md). Mientras esté desactivado, los clientes
              solo pueden pagar en efectivo.
            </span>
          </span>
        </label>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-extrabold">
          <Mail className="size-5" /> Contacto
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Teléfono de atención" name="support_phone" value={s.support_phone} onChange={(e) => set('support_phone', e.target.value)} />
          <Field label="Correo de atención" name="support_email" type="email" value={s.support_email} onChange={(e) => set('support_email', e.target.value)} />
        </div>
      </section>

      <button className="btn-dark w-full sm:w-auto" disabled={busy}>
        {busy ? <Spinner className="size-5 text-white" /> : 'Guardar configuración'}
      </button>
    </form>
  )
}
