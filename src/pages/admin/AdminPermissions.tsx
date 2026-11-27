import { useEffect, useMemo, useState } from 'react'
import { Search, ShieldCheck, Truck, User, Users } from 'lucide-react'
import { friendlyError, supabase } from '../../lib/supabase'
import type { Profile, Role } from '../../lib/types'
import { formatDate, roleLabel } from '../../lib/format'
import { EmptyState, PageLoader, PageTitle, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const ROLES: Role[] = ['cliente', 'admin', 'repartidor']

const roleHelp: Record<Role, string> = {
  cliente: 'Hace pedidos desde el catálogo.',
  admin: 'Accede al panel administrativo completo.',
  repartidor: 'Ve solo sus pedidos asignados y marca “En camino” y “Entregado”.',
}

const roleTone: Record<Role, string> = {
  cliente: 'bg-zinc-100 text-zinc-700',
  admin: 'bg-ink text-white',
  repartidor: 'bg-violet-100 text-violet-800',
}

const RoleIcon = ({ role, className }: { role: Role; className?: string }) =>
  role === 'admin' ? <ShieldCheck className={className} /> : role === 'repartidor' ? <Truck className={className} /> : <User className={className} />

/**
 * Gestión de permisos de perfiles: el administrador asigna a cada usuario el perfil
 * Cliente, Administrador o Repartidor. El cambio lo valida la base (admin_set_user_role):
 * solo un administrador puede hacerlo y nadie puede cambiar su propio perfil.
 */
export default function AdminPermissions() {
  const { profile: me } = useAuth()
  const [rows, setRows] = useState<Profile[] | null>(null)
  const [draft, setDraft] = useState<Record<string, Role>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Role | 'todos'>('todos')
  const toast = useToast()

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setRows((data as Profile[]) ?? [])
  }
  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => {
    const c: Record<Role, number> = { cliente: 0, admin: 0, repartidor: 0 }
    for (const r of rows ?? []) c[r.role] = (c[r.role] ?? 0) + 1
    return c
  }, [rows])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (rows ?? []).filter(
      (r) => (filter === 'todos' || r.role === filter) && (!t || [r.full_name, r.email, r.phone].some((v) => v.toLowerCase().includes(t))),
    )
  }, [rows, q, filter])

  async function save(p: Profile) {
    const role = draft[p.id]
    if (!role || role === p.role) return
    setBusyId(p.id)
    const { error } = await supabase.rpc('admin_set_user_role', { p_user_id: p.id, p_role: role })
    setBusyId(null)
    if (error) return toast('error', friendlyError(error))
    toast('success', `${p.full_name} ahora tiene perfil ${roleLabel[role]}.`)
    setDraft(({ [p.id]: _, ...rest }) => rest)
    load()
  }

  if (!rows) return <PageLoader />

  return (
    <div>
      <PageTitle title="Gestionar permisos de perfiles" subtitle="Elegí qué perfil tiene cada usuario: cliente, administrador o repartidor." />

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="card flex items-start gap-3 p-3">
            <span className={`grid size-9 shrink-0 place-items-center rounded-full ${roleTone[r]}`}>
              <RoleIcon role={r} className="size-4" />
            </span>
            <div>
              <p className="text-sm font-extrabold">
                {roleLabel[r]} <span className="font-semibold text-muted">· {counts[r]}</span>
              </p>
              <p className="text-xs text-muted">{roleHelp[r]}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block flex-1 sm:max-w-md">
          <span className="sr-only">Buscar usuario</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Buscar por nombre, correo o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="inline-flex overflow-x-auto rounded-xl bg-white p-1 shadow-card" role="tablist">
          {(['todos', ...ROLES] as const).map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={filter === r}
              onClick={() => setFilter(r)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold ${filter === r ? 'bg-ink text-white' : 'text-ink-2'}`}
            >
              {r === 'todos' ? 'Todos' : r === 'admin' ? 'Administradores' : r === 'repartidor' ? 'Repartidores' : 'Clientes'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="size-8" />} title="Sin resultados" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((p) => {
            const isMe = p.id === me?.id
            const value = draft[p.id] ?? p.role
            const changed = value !== p.role
            return (
              <li key={p.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display font-extrabold">
                      {p.full_name} {isMe && <span className="text-xs font-semibold text-muted">(vos)</span>}
                    </p>
                    <p className="truncate text-sm text-ink-2">{p.email}</p>
                    <p className="text-xs text-muted">
                      {p.phone} · Alta {formatDate(p.created_at)}
                    </p>
                  </div>
                  <span className={`chip shrink-0 ${roleTone[p.role]}`}>
                    <RoleIcon role={p.role} className="mr-1 inline size-3.5" />
                    {roleLabel[p.role]}
                  </span>
                </div>
                {isMe ? (
                  <p className="mt-3 text-xs text-muted">No podés cambiar tu propio perfil. Si hace falta, pedíselo a otro administrador.</p>
                ) : (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="flex-1">
                      <span className="sr-only">Perfil de {p.full_name}</span>
                      <select
                        className="input py-2 text-sm"
                        value={value}
                        disabled={busyId === p.id}
                        onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value as Role }))}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel[r]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="btn-dark px-4 py-2 text-sm" disabled={!changed || busyId === p.id} onClick={() => save(p)}>
                      {busyId === p.id ? <Spinner className="size-4 text-white" /> : 'Guardar'}
                    </button>
                  </div>
                )}
                {changed && p.role === 'repartidor' && (
                  <p className="mt-2 text-xs text-warn">Sus pedidos sin entregar van a quedar sin repartidor asignado.</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
