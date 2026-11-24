import { NavLink, Outlet } from 'react-router-dom'
import { ClipboardList, LayoutDashboard, Package, Settings, Truck, Users } from 'lucide-react'

const links = [
  { to: '/admin', label: 'Indicadores', icon: LayoutDashboard, end: true },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList },
  { to: '/admin/entregas', label: 'Entregas', icon: Truck },
  { to: '/admin/productos', label: 'Productos', icon: Package },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
]

export default function AdminLayout() {
  return (
    <div className="md:grid md:grid-cols-[13rem_1fr] md:gap-6">
      <aside className="no-print -mx-4 mb-4 md:mx-0 md:mb-0">
        <p className="mb-2 hidden px-3 text-xs font-bold uppercase tracking-wider text-muted md:block">Panel administrativo</p>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-1 md:sticky md:top-20 md:flex-col md:px-0" aria-label="Administración">
          {links.map(({ to, label, icon: I, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                  isActive ? 'bg-ink text-white' : 'bg-white text-ink-2 shadow-card hover:text-ink md:bg-transparent md:shadow-none md:hover:bg-white'
                }`
              }
            >
              <I className="size-4" /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
