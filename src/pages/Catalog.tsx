import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, PackageOpen, RefreshCw, ShoppingCart } from 'lucide-react'
import { ProductCard } from '../components/ProductCard'
import { EmptyState, PageLoader } from '../components/ui'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatMoney } from '../lib/format'
import type { Address } from '../lib/types'

type Filter = 'todos' | 'carga' | 'envase'

export default function Catalog() {
  const { products, productsLoading, count, total } = useCart()
  const { session, profile } = useAuth()
  const [filter, setFilter] = useState<Filter>('todos')
  const [address, setAddress] = useState<Address | null | undefined>(undefined)

  useEffect(() => {
    if (!session) return
    supabase
      .from('addresses')
      .select('*')
      .eq('user_id', session.user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => setAddress(((data as Address[]) ?? [])[0] ?? null))
  }, [session])

  if (productsLoading) return <PageLoader />

  const cargas = products.filter((p) => p.category === 'carga')
  const envases = products.filter((p) => p.category === 'envase')

  return (
    <div>
      {session && address !== undefined && (
        <Link
          to={address ? '/perfil#domicilios' : '/domicilios/nuevo?volver=/catalogo'}
          className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-3 pr-4 shadow-card"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-800">
            <MapPin className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-muted">
              {address ? `Entregar a ${profile?.full_name?.split(' ')[0] ?? ''} en` : 'Todavía no cargaste un domicilio'}
            </span>
            <span className="block truncate text-sm font-bold">
              {address ? `${address.street} ${address.number}, ${address.city}` : 'Agregá dónde querés recibir tu pedido'}
            </span>
          </span>
          <span className="text-xs font-bold text-brand-800">{address ? 'Cambiar' : 'Agregar'}</span>
        </Link>
      )}

      <div className="mb-5 overflow-hidden rounded-3xl bg-brand p-5 md:flex md:items-center md:justify-between md:p-7">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Catálogo</h1>
          <p className="mt-1 max-w-lg text-sm text-ink/80">
            Elegí cargas para tu envase o comprá un envase nuevo, con o sin carga. El precio se calcula automáticamente.
          </p>
        </div>
        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 md:mt-0" role="tablist" aria-label="Filtrar productos">
          {(
            [
              ['todos', 'Todos'],
              ['carga', 'Cargas de GLP'],
              ['envase', 'Envases nuevos'],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              onClick={() => setFilter(k)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${filter === k ? 'bg-ink text-white' : 'bg-white/70 text-ink hover:bg-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="size-8" />}
          title="No hay productos disponibles"
          text="Volvé a intentar en unos minutos."
          action={
            <button className="btn-outline" onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" /> Reintentar
            </button>
          }
        />
      ) : (
        <>
          {filter !== 'envase' && cargas.length > 0 && (
            <section className="mb-8" aria-labelledby="sec-cargas">
              <h2 id="sec-cargas" className="mb-1 text-xl font-extrabold">
                Cargas individuales de GLP
              </h2>
              <p className="mb-4 text-sm text-muted">Para clientes que ya tienen su propio envase. Te llevamos uno lleno y retiramos el vacío.</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cargas.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}
          {filter !== 'carga' && envases.length > 0 && (
            <section className="mb-8" aria-labelledby="sec-envases">
              <h2 id="sec-envases" className="mb-1 text-xl font-extrabold">
                Envases nuevos
              </h2>
              <p className="mb-4 text-sm text-muted">Elegí si lo querés vacío o con su carga de GLP incluida.</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {envases.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {count > 0 && (
        <Link
          to="/carrito"
          className="no-print fixed inset-x-4 bottom-20 z-[900] mx-auto flex max-w-md items-center justify-between rounded-2xl bg-ink px-5 py-3.5 text-white shadow-xl md:bottom-6"
        >
          <span className="flex items-center gap-2 font-bold">
            <ShoppingCart className="size-5 text-brand" /> Ver carrito ({count})
          </span>
          <span className="font-display font-extrabold text-brand">{formatMoney(total)}</span>
        </Link>
      )}
    </div>
  )
}
