import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Home, LogOut, MapPin, Package, Pencil, Plus, Star, Trash2, User } from 'lucide-react'
import { supabase, friendlyError } from '../lib/supabase'
import type { Address } from '../lib/types'
import { formatAddress, formatDate, roleLabel } from '../lib/format'
import { validateName, validatePhone } from '../lib/validation'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Field, PageLoader, PageTitle, Spinner } from '../components/ui'

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})
  const [busy, setBusy] = useState(false)
  const [orderCount, setOrderCount] = useState<number | null>(null)

  async function loadAddresses() {
    if (!profile) return
    const { data } = await supabase.from('addresses').select('*').eq('user_id', profile.id).order('is_default', { ascending: false }).order('created_at')
    setAddresses((data as Address[]) ?? [])
  }

  useEffect(() => {
    loadAddresses()
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile?.id ?? '')
      .then(({ count }) => setOrderCount(count ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  useEffect(() => {
    if (window.location.hash === '#domicilios' && addresses) document.getElementById('domicilios')?.scrollIntoView({ behavior: 'smooth' })
  }, [addresses])

  if (!profile || !addresses) return <PageLoader />

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    const next = { name: validateName(name), phone: validatePhone(phone) }
    setErrors(next)
    if (next.name || next.phone) return
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() }).eq('id', profile!.id)
    setBusy(false)
    if (error) return toast('error', friendlyError(error))
    await refreshProfile()
    setEditing(false)
    toast('success', 'Tus datos se actualizaron.')
  }

  async function makeDefault(a: Address) {
    const { error } = await supabase.from('addresses').update({ is_default: true }).eq('id', a.id)
    if (error) return toast('error', friendlyError(error))
    toast('success', `"${a.label}" es ahora tu domicilio habitual.`)
    loadAddresses()
  }

  async function removeAddress(a: Address) {
    if (!window.confirm(`¿Eliminar el domicilio "${a.label}"?`)) return
    const { error } = await supabase.from('addresses').delete().eq('id', a.id)
    if (error) return toast('error', friendlyError(error))
    toast('success', 'Domicilio eliminado.')
    loadAddresses()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle title="Mi perfil" />

      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-brand font-display text-lg font-extrabold">
              {profile.full_name
                .split(' ')
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase()}
            </span>
            <div>
              <h2 className="text-lg font-extrabold">{profile.full_name}</h2>
              <p className="text-xs text-muted">
                {roleLabel[profile.role] ?? 'Cliente'} desde {formatDate(profile.created_at)}
              </p>
            </div>
          </div>
          {!editing && (
            <button
              className="btn-ghost text-sm"
              onClick={() => {
                setName(profile.full_name)
                setPhone(profile.phone)
                setEditing(true)
              }}
            >
              <Pencil className="size-4" /> Editar
            </button>
          )}
        </div>
        {editing ? (
          <form onSubmit={saveProfile} className="mt-4 space-y-3" noValidate>
            <Field label="Nombre y apellido" name="full_name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} icon={<User className="size-5" />} />
            <Field label="Teléfono" name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
            <p className="text-xs text-muted">El correo electrónico ({profile.email}) no se puede modificar desde la app.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setEditing(false)}>
                Cancelar
              </button>
              <button className="btn-primary" disabled={busy}>
                {busy ? <Spinner className="size-5 text-ink" /> : 'Guardar'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-cream p-3">
              <dt className="text-xs font-bold text-muted">Correo electrónico</dt>
              <dd className="font-semibold break-all">{profile.email}</dd>
            </div>
            <div className="rounded-xl bg-cream p-3">
              <dt className="text-xs font-bold text-muted">Teléfono</dt>
              <dd className="font-semibold">{profile.phone}</dd>
            </div>
          </dl>
        )}
      </section>

      <Link to="/mis-pedidos" className="card flex items-center gap-3 p-4 hover:bg-brand-50/60">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-100 text-brand-800">
          <Package className="size-5" />
        </span>
        <span className="flex-1">
          <b className="block font-display">Mis pedidos</b>
          <span className="text-sm text-muted">{orderCount === null ? '…' : `${orderCount} ${orderCount === 1 ? 'pedido' : 'pedidos'} realizados`}</span>
        </span>
      </Link>

      <section id="domicilios" className="card scroll-mt-20 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <MapPin className="size-5" /> Mis domicilios
          </h2>
          <Link to="/domicilios/nuevo" className="btn-primary px-3 py-2 text-sm">
            <Plus className="size-4" /> Agregar
          </Link>
        </div>
        {addresses.length === 0 ? (
          <p className="text-sm text-muted">No cargaste domicilios todavía.</p>
        ) : (
          <ul className="space-y-2">
            {addresses.map((a) => (
              <li key={a.id} className={`rounded-xl border-2 p-3 ${a.is_default ? 'border-ink bg-brand-50' : 'border-line'}`}>
                <div className="flex items-start gap-3">
                  <Home className="mt-0.5 size-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                      {a.label}
                      {a.is_default && <span className="chip bg-ink px-2 py-0.5 text-[10px] text-white">Habitual</span>}
                      {a.lat != null && <span className="chip bg-emerald-50 px-2 py-0.5 text-[10px] text-ok">En mapa</span>}
                    </p>
                    <p className="text-sm text-ink-2">{formatAddress(a)}</p>
                    {a.reference && <p className="text-xs text-muted">Ref.: {a.reference}</p>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-1">
                  {!a.is_default && (
                    <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => makeDefault(a)}>
                      <Star className="size-3.5" /> Hacer habitual
                    </button>
                  )}
                  <Link to={`/domicilios/${a.id}`} className="btn-ghost px-2 py-1.5 text-xs">
                    <Pencil className="size-3.5" /> Editar
                  </Link>
                  <button className="btn-ghost px-2 py-1.5 text-xs text-bad" onClick={() => removeAddress(a)}>
                    <Trash2 className="size-3.5" /> Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        className="btn-outline w-full"
        onClick={async () => {
          await signOut()
          navigate('/')
        }}
      >
        <LogOut className="size-4" /> Cerrar sesión
      </button>
    </div>
  )
}
