import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Mail, MapPin, Phone, Search, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Address, Order, Profile } from '../../lib/types'
import { formatAddress, formatDate, formatDateTime, formatMoney, itemName } from '../../lib/format'
import { EmptyState, PageLoader, PageTitle, PaymentBadge, StatusBadge } from '../../components/ui'
import { AdminOrderPanel } from './AdminOrderPanel'

type Row = Profile & { orders: { total: number; status: string; created_at: string }[] }

export function AdminCustomers() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*, orders(total, status, created_at)')
      .eq('role', 'cliente')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows((data as Row[]) ?? []))
  }, [])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (rows ?? []).filter((r) => !t || [r.full_name, r.email, r.phone].some((v) => v.toLowerCase().includes(t)))
  }, [rows, q])

  if (!rows) return <PageLoader />

  return (
    <div>
      <PageTitle title="Clientes" subtitle={`${rows.length} clientes registrados`} />
      <label className="relative mb-4 block max-w-md">
        <span className="sr-only">Buscar cliente</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input className="input pl-9" placeholder="Buscar por nombre, correo o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="size-8" />} title="Sin resultados" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((r) => {
            const valid = r.orders.filter((o) => o.status !== 'cancelado')
            const last = [...r.orders].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
            return (
              <li key={r.id}>
                <Link to={`/admin/clientes/${r.id}`} className="card block p-4 hover:bg-brand-50/60">
                  <p className="font-display font-extrabold">{r.full_name}</p>
                  <p className="text-sm text-ink-2">{r.email}</p>
                  <p className="text-sm text-ink-2">{r.phone}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-muted">
                    <span>
                      <b className="text-ink">{r.orders.length}</b> pedidos
                    </span>
                    <span>
                      Compras: <b className="text-ink">{formatMoney(valid.reduce((s, o) => s + Number(o.total), 0))}</b>
                    </span>
                    <span>{last ? `Último: ${formatDate(last.created_at)}` : `Alta: ${formatDate(r.created_at)}`}</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function AdminCustomerDetail() {
  const { id } = useParams()
  const [p, setP] = useState<Profile | null>(null)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  async function load() {
    const [a, b, c] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id!).single(),
      supabase.from('addresses').select('*').eq('user_id', id!).order('is_default', { ascending: false }),
      supabase.from('orders').select('*, order_items(*)').eq('user_id', id!).order('created_at', { ascending: false }),
    ])
    setP(a.data as Profile)
    setAddresses((b.data as Address[]) ?? [])
    setOrders((c.data as Order[]) ?? [])
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!p || !orders) return <PageLoader />
  const total = orders.filter((o) => o.status !== 'cancelado').reduce((s, o) => s + Number(o.total), 0)

  return (
    <div>
      <PageTitle title={p.full_name} subtitle={`Cliente desde ${formatDate(p.created_at)}`} back="/admin/clientes" />
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-4">
          <section className="card space-y-2 p-4 text-sm">
            <p className="flex items-center gap-2 break-all">
              <Mail className="size-4 shrink-0 text-muted" /> {p.email}
            </p>
            <a className="flex items-center gap-2 font-semibold text-brand-800" href={`tel:${p.phone.replace(/[^0-9+]/g, '')}`}>
              <Phone className="size-4 shrink-0" /> {p.phone}
            </a>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="rounded-xl bg-cream p-3">
                <p className="text-xs text-muted">Pedidos</p>
                <p className="font-display text-xl font-extrabold">{orders.length}</p>
              </div>
              <div className="rounded-xl bg-cream p-3">
                <p className="text-xs text-muted">Total comprado</p>
                <p className="font-display text-lg font-extrabold">{formatMoney(total)}</p>
              </div>
            </div>
          </section>
          <section className="card p-4">
            <h2 className="mb-2 font-extrabold">Domicilios</h2>
            {addresses.length === 0 && <p className="text-sm text-muted">Sin domicilios cargados.</p>}
            <ul className="space-y-2 text-sm">
              {addresses.map((a) => (
                <li key={a.id} className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" />
                  <span>
                    <b>{a.label}</b>
                    {a.is_default && ' (habitual)'}
                    <span className="block text-ink-2">{formatAddress(a)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
        <section className="card p-4">
          <h2 className="mb-3 font-extrabold">Historial de compras</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-muted">Todavía no realizó pedidos.</p>
          ) : (
            <ul className="divide-y divide-line">
              {orders.map((o) => (
                <li key={o.id}>
                  <button className="w-full py-3 text-left hover:bg-brand-50/60" onClick={() => setOpen(o.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display font-bold">{o.order_number}</p>
                        <p className="text-xs text-muted">{formatDateTime(o.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-extrabold">{formatMoney(o.total)}</p>
                        <StatusBadge status={o.status} />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-ink-2">{(o.order_items ?? []).map((i) => `${i.quantity} × ${itemName(i)}`).join(' · ')}</p>
                    <div className="mt-1">
                      <PaymentBadge status={o.payment_status} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {open && <AdminOrderPanel orderId={open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  )
}
