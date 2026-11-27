import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LogIn, LogOut, Package, ShoppingCart, Store, Truck, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { LogoHorizontal } from './Logo'

export function Layout() {
  const { session, isAdmin, isDriver, signOut } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const desktopLink = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-bold font-display transition ${isActive ? 'bg-ink text-white' : 'text-ink hover:bg-black/10'}`

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-[1000] bg-brand shadow-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to={session ? '/catalogo' : '/'} className="shrink-0">
            <LogoHorizontal className="h-7 md:h-8" />
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Principal">
            <NavLink to="/catalogo" className={desktopLink}>
              Catálogo
            </NavLink>
            {session && (
              <>
                <NavLink to="/mis-pedidos" className={desktopLink}>
                  Mis pedidos
                </NavLink>
                <NavLink to="/perfil" className={desktopLink}>
                  Mi perfil
                </NavLink>
              </>
            )}
            {isAdmin && (
              <NavLink to="/admin" className={desktopLink}>
                Panel administrativo
              </NavLink>
            )}
            {isDriver && (
              <NavLink to="/reparto" className={desktopLink}>
                Mis entregas
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {isAdmin && (
              <Link to="/admin" className="btn-ghost md:hidden" aria-label="Panel administrativo">
                <LayoutDashboard className="size-5" />
              </Link>
            )}
            {isDriver && (
              <Link to="/reparto" className="btn-ghost md:hidden" aria-label="Mis entregas">
                <Truck className="size-5" />
              </Link>
            )}
            <Link
              to="/carrito"
              className="relative grid size-10 place-items-center rounded-lg text-ink hover:bg-black/10"
              aria-label={`Carrito, ${count} productos`}
            >
              <ShoppingCart className="size-6" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
            {session ? (
              <button
                className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-ink hover:bg-black/10 md:inline-flex"
                onClick={async () => {
                  await signOut()
                  navigate('/')
                }}
              >
                <LogOut className="size-4" /> Salir
              </button>
            ) : (
              <Link to="/ingresar" state={{ from: pathname }} className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-ink hover:bg-black/10 md:inline-flex">
                <LogIn className="size-4" /> Ingresar
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 md:pb-12">
        <Outlet />
      </main>

      <footer className="no-print hidden border-t border-line bg-white py-6 text-center text-xs text-muted md:block">
        Amarilla Gas · Comercialización, fraccionamiento y distribución de GLP · Atención 0800-555-2642
      </footer>

      <BottomNav />
    </div>
  )
}

function BottomNav() {
  const { session } = useAuth()
  const { count } = useCart()
  const item = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${isActive ? 'text-ink' : 'text-muted'}`
  const pill = (active: boolean) => `grid h-7 w-12 place-items-center rounded-full transition ${active ? 'bg-brand' : ''}`

  return (
    <nav
      className="no-print safe-bottom fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-white/95 backdrop-blur md:hidden"
      aria-label="Navegación inferior"
    >
      <div className="mx-auto flex max-w-md">
        <NavLink to="/catalogo" className={item}>
          {({ isActive }) => (
            <>
              <span className={pill(isActive)}>
                <Store className="size-5" />
              </span>
              Catálogo
            </>
          )}
        </NavLink>
        <NavLink to="/carrito" className={item}>
          {({ isActive }) => (
            <>
              <span className={`relative ${pill(isActive)}`}>
                <ShoppingCart className="size-5" />
                {count > 0 && (
                  <span className="absolute -top-1 right-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] text-white">
                    {count}
                  </span>
                )}
              </span>
              Carrito
            </>
          )}
        </NavLink>
        <NavLink to={session ? '/mis-pedidos' : '/ingresar'} className={item}>
          {({ isActive }) => (
            <>
              <span className={pill(isActive)}>
                <Package className="size-5" />
              </span>
              Mis pedidos
            </>
          )}
        </NavLink>
        <NavLink to={session ? '/perfil' : '/ingresar'} className={item}>
          {({ isActive }) => (
            <>
              <span className={pill(isActive)}>
                <User className="size-5" />
              </span>
              {session ? 'Mi perfil' : 'Ingresar'}
            </>
          )}
        </NavLink>
      </div>
    </nav>
  )
}
