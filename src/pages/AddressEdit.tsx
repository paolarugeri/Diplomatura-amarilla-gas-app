import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MapPinned } from 'lucide-react'
import { Alert, Field, PageLoader, PageTitle, SelectField, Spinner, TextAreaField } from '../components/ui'
import { MapPicker } from '../components/MapPicker'
import { friendlyError, supabase } from '../lib/supabase'
import { PROVINCIAS, validateAddress, type AddressInput, type Errors } from '../lib/validation'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { Address } from '../lib/types'

const empty: AddressInput = {
  label: 'Casa',
  street: '',
  number: '',
  apartment: '',
  city: '',
  province: 'Buenos Aires',
  postal_code: '',
  reference: '',
}

export default function AddressEdit() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const first = params.get('primero') === '1'
  const back = params.get('volver')
  const { session } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [f, setF] = useState<AddressInput>(empty)
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null })
  const [isDefault, setIsDefault] = useState(true)
  const [errors, setErrors] = useState<Errors<AddressInput>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(Boolean(id))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) {
      // Si ya tiene domicilios, el nuevo no se marca habitual por defecto
      supabase
        .from('addresses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session!.user.id)
        .then(({ count }) => setIsDefault(!count))
      return
    }
    supabase
      .from('addresses')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast('error', 'No encontramos ese domicilio.')
          navigate('/perfil', { replace: true })
          return
        }
        const a = data as Address
        setF({
          label: a.label,
          street: a.street,
          number: a.number,
          apartment: a.apartment ?? '',
          city: a.city,
          province: a.province,
          postal_code: a.postal_code,
          reference: a.reference ?? '',
        })
        setCoords({ lat: a.lat, lng: a.lng })
        setIsDefault(a.is_default)
        setLoading(false)
      })
  }, [id, navigate, toast])

  const set = (k: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validateAddress(f)
    setErrors(errs)
    setFormError('')
    if (Object.values(errs).some(Boolean)) {
      toast('error', 'Revisá los datos marcados en rojo.')
      return
    }
    setBusy(true)
    const payload = {
      label: f.label.trim(),
      street: f.street.trim(),
      number: f.number.trim().toUpperCase(),
      apartment: f.apartment.trim() || null,
      city: f.city.trim(),
      province: f.province,
      postal_code: f.postal_code.trim().toUpperCase(),
      reference: f.reference.trim() || null,
      lat: coords.lat,
      lng: coords.lng,
      is_default: isDefault,
    }
    const { error } = id
      ? await supabase.from('addresses').update(payload).eq('id', id)
      : await supabase.from('addresses').insert({ ...payload, user_id: session!.user.id })
    setBusy(false)
    if (error) return setFormError(friendlyError(error))
    toast('success', id ? 'Domicilio actualizado.' : 'Domicilio guardado.')
    navigate(back ?? (first ? '/catalogo' : '/perfil'), { replace: true })
  }

  if (loading) return <PageLoader />

  return (
    <div className="mx-auto max-w-2xl">
      {first ? (
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-brand-100 p-4">
          <MapPinned className="mt-0.5 size-6 shrink-0 text-brand-800" />
          <div>
            <h1 className="text-xl font-extrabold">¿Dónde te llevamos el gas?</h1>
            <p className="text-sm text-ink-2">Cargá tu domicilio de entrega. Podés guardar varios y elegir uno como habitual.</p>
          </div>
        </div>
      ) : (
        <PageTitle title={id ? 'Editar domicilio' : 'Nuevo domicilio'} back={back ?? '/perfil'} />
      )}

      <form onSubmit={onSubmit} className="card space-y-4 p-5" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Nombre del domicilio" name="label" placeholder="Casa, Trabajo, Local…" value={f.label} onChange={set('label')} error={errors.label} maxLength={40} />
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="Calle" name="street" autoComplete="address-line1" placeholder="Ej. Calle 14" value={f.street} onChange={set('street')} error={errors.street} />
          <Field label="Número" name="number" inputMode="numeric" placeholder="4520" value={f.number} onChange={set('number')} error={errors.number} />
        </div>
        <Field label="Piso / Depto (opcional)" name="apartment" placeholder="Ej. 3° B" value={f.apartment} onChange={set('apartment')} maxLength={30} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Localidad" name="city" autoComplete="address-level2" placeholder="Ej. Berazategui" value={f.city} onChange={set('city')} error={errors.city} />
          <SelectField label="Provincia" name="province" value={f.province} onChange={set('province')} error={errors.province}>
            {PROVINCIAS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </SelectField>
        </div>
        <Field label="Código postal" name="postal_code" autoComplete="postal-code" placeholder="Ej. 1884" value={f.postal_code} onChange={set('postal_code')} error={errors.postal_code} className="input max-w-48" />
        <TextAreaField label="Referencias adicionales (opcional)" name="reference" placeholder="Entre calles, color de la casa, timbre, horario preferido…" value={f.reference} onChange={set('reference')} error={errors.reference} maxLength={250} />

        <div>
          <span className="label">Ubicación en el mapa</span>
          <MapPicker lat={coords.lat} lng={coords.lng} onChange={(lat, lng) => setCoords({ lat, lng })} />
        </div>

        <label className="flex items-center gap-3 rounded-xl bg-cream p-3 text-sm font-semibold">
          <input type="checkbox" className="size-5 accent-brand-700" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Usar como domicilio habitual
        </label>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          {first ? (
            <button type="button" className="btn-ghost" onClick={() => navigate('/catalogo')}>
              Lo cargo después
            </button>
          ) : (
            <button type="button" className="btn-outline" onClick={() => navigate(back ?? '/perfil')}>
              Cancelar
            </button>
          )}
          <button className="btn-primary" disabled={busy}>
            {busy ? <Spinner className="size-5 text-ink" /> : 'Guardar domicilio'}
          </button>
        </div>
      </form>
    </div>
  )
}
