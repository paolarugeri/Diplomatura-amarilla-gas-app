import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays, CheckCircle2, Clock, DollarSign, RefreshCw, ShoppingBag, Users } from 'lucide-react'
import { supabase, friendlyError } from '../../lib/supabase'
import { formatMoney } from '../../lib/format'
import { Alert, PageLoader, PageTitle } from '../../components/ui'

interface Dash {
  orders_today: number
  orders_pending: number
  orders_delivered: number
  delivered_today: number
  sales_today: number
  sales_month: number
  customers: number
  top_products: { name: string; units: number; revenue: number }[]
  by_status: { code: string; label: string; count: number }[]
  by_payment: { code: string; label: string; count: number; total: number }[]
  last_days: { day: string; orders: number; total: number }[]
}

const CHART = '#b07a1b' // tono de marca con contraste suficiente sobre blanco

function Stat({ icon: I, label, value, sub, to }: { icon: typeof Clock; label: string; value: string; sub?: string; to?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
        <span className="grid size-8 place-items-center rounded-lg bg-brand-100 text-brand-800">
          <I className="size-4" />
        </span>
      </div>
      <p className="mt-2 font-display text-[22px] font-extrabold leading-none sm:text-2xl md:text-[28px]">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </>
  )
  return to ? (
    <Link to={to} className="card block p-4 transition hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  )
}

function HBars({ rows, value, fmt }: { rows: { label: string; v: number; extra?: string }[]; value: string; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.v))
  return (
    <ul className="space-y-2.5" aria-label={value}>
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${fmt ? fmt(r.v) : r.v}${r.extra ? ` · ${r.extra}` : ''}`}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate text-ink-2">{r.label}</span>
            <span className="whitespace-nowrap font-semibold">
              {fmt ? fmt(r.v) : r.v}
              {r.extra && <span className="ml-1 font-normal text-muted">· {r.extra}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-cream">
            <div className="h-2 rounded-full" style={{ width: `${(r.v / max) * 100}%`, background: CHART, minWidth: r.v ? 4 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function Dashboard() {
  const [d, setD] = useState<Dash | null>(null)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState<Date | null>(null)

  async function load() {
    const { data, error } = await supabase.rpc('admin_dashboard')
    if (error) return setError(friendlyError(error))
    setD(data as Dash)
    setUpdated(new Date())
  }
  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])

  if (error) return <Alert tone="error">{error}</Alert>
  if (!d) return <PageLoader />

  const days = d.last_days.map((x) => ({
    ...x,
    label: new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(x.day)),
    total: Number(x.total),
  }))
  const totalPay = d.by_payment.reduce((s, p) => s + p.count, 0)

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <PageTitle title="Indicadores" subtitle={updated ? `Actualizado ${updated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' })} h` : undefined} />
        <button className="btn-ghost text-sm" onClick={load}>
          <RefreshCw className="size-4" /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat icon={ShoppingBag} label="Pedidos del día" value={String(d.orders_today)} to="/admin/pedidos?hoy=1" />
        <Stat icon={Clock} label="Pendientes" value={String(d.orders_pending)} sub="Sin entregar" to="/admin/entregas" />
        <Stat icon={CheckCircle2} label="Entregados" value={String(d.orders_delivered)} sub={`${d.delivered_today} hoy`} to="/admin/entregas?vista=entregados" />
        <Stat icon={DollarSign} label="Ventas del día" value={formatMoney(d.sales_today)} />
        <Stat icon={CalendarDays} label="Ventas del mes" value={formatMoney(d.sales_month)} />
        <Stat icon={Users} label="Clientes" value={String(d.customers)} to="/admin/clientes" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-extrabold">Ventas de los últimos 14 días</h2>
          <p className="text-xs text-muted">Importe total por día, sin pedidos cancelados</p>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#ece9e2" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6b6a64' }} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: '#6b6a64' }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,176,29,0.15)' }}
                  formatter={(v) => [formatMoney(Number(v)), 'Ventas']}
                  labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.orders ?? 0} pedidos`}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e7e5df', fontSize: 13 }}
                />
                <Bar dataKey="total" fill={CHART} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-extrabold">Productos más vendidos</h2>
          {d.top_products.length ? (
            <HBars value="Unidades vendidas" rows={d.top_products.map((p) => ({ label: p.name, v: p.units, extra: formatMoney(p.revenue) }))} fmt={(n) => `${n} u.`} />
          ) : (
            <p className="text-sm text-muted">Sin ventas registradas.</p>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-extrabold">Pedidos por estado</h2>
          <HBars value="Pedidos por estado" rows={d.by_status.map((s) => ({ label: s.label, v: s.count }))} />
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-extrabold">Medios de pago utilizados</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {d.by_payment.map((p) => (
              <div key={p.code} className="rounded-xl bg-cream p-4">
                <p className="text-sm font-bold">{p.label}</p>
                <p className="mt-1 font-display text-2xl font-extrabold">
                  {totalPay ? Math.round((p.count / totalPay) * 100) : 0}%
                  <span className="ml-2 text-sm font-semibold text-muted">
                    {p.count} pedidos · {formatMoney(p.total)}
                  </span>
                </p>
                <div className="mt-2 h-2 rounded-full bg-white">
                  <div className="h-2 rounded-full" style={{ width: `${totalPay ? (p.count / totalPay) * 100 : 0}%`, background: CHART }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
