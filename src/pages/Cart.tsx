import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ShoppingCart, Trash2 } from 'lucide-react'
import { EmptyState, PageLoader, PageTitle, QtyStepper } from '../components/ui'
import { MAX_QTY, useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { containerLabel, formatMoney } from '../lib/format'

export default function Cart() {
  const { priced, total, count, setQty, remove, productsLoading, lines } = useCart()
  const { session } = useAuth()
  const navigate = useNavigate()

  if (productsLoading) return <PageLoader />

  const missing = lines.length - priced.length

  if (priced.length === 0) {
    return (
      <div className="mx-auto max-w-lg">
        <PageTitle title="Tu carrito" />
        <EmptyState
          icon={<ShoppingCart className="size-8" />}
          title="Tu carrito está vacío"
          text="Agregá garrafas o cargas de GLP desde el catálogo."
          action={
            <Link to="/catalogo" className="btn-primary">
              Ir al catálogo
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title="Tu carrito" subtitle={`${count} ${count === 1 ? 'producto' : 'productos'}`} />
      {missing > 0 && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Quitamos {missing} {missing === 1 ? 'producto que ya no está disponible' : 'productos que ya no están disponibles'}.
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-[1fr_20rem]">
        <ul className="space-y-3">
          {priced.map((l) => (
            <li key={l.key} className="card flex gap-3 p-3">
              <img src={l.product.image_url ?? ''} alt="" className="size-24 shrink-0 rounded-xl bg-brand-50 object-contain" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display font-extrabold leading-tight">{l.product.name}</h3>
                    <p className="text-xs text-muted">
                      {Number(l.product.capacity_kg)} kg · {containerLabel[l.product.container_type]}
                      {l.product.category === 'envase' && (
                        <>
                          {' · '}
                          <b className={l.with_refill ? 'text-ok' : 'text-ink-2'}>{l.with_refill ? 'Con carga de GLP' : 'Sin carga'}</b>
                        </>
                      )}
                    </p>
                  </div>
                  <button className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-bad" onClick={() => remove(l.key)} aria-label={`Eliminar ${l.product.name}`}>
                    <Trash2 className="size-5" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Precio unitario: <b className="text-ink">{formatMoney(l.unitPrice)}</b>
                  {l.refill && (
                    <span className="block">
                      (envase {formatMoney(l.product.price)} + carga {formatMoney(l.refill.price)})
                    </span>
                  )}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <QtyStepper size="sm" value={l.quantity} max={MAX_QTY} onChange={(v) => setQty(l.key, v)} label={`Cantidad de ${l.product.name}`} />
                  <span className="font-display font-extrabold">{formatMoney(l.subtotal)}</span>
                </div>
              </div>
            </li>
          ))}
          <li>
            <Link to="/catalogo" className="btn-ghost -ml-2">
              <ChevronLeft className="size-4" /> Seguir comprando
            </Link>
          </li>
        </ul>

        <aside className="card h-fit p-5 md:sticky md:top-20">
          <h2 className="text-lg font-extrabold">Resumen</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {priced.map((l) => (
              <div key={l.key} className="flex justify-between gap-3">
                <dt className="text-ink-2">
                  {l.quantity} × {l.product.name}
                  {l.product.category === 'envase' ? (l.with_refill ? ' + carga' : ' (vacío)') : ''}
                </dt>
                <dd className="whitespace-nowrap font-semibold">{formatMoney(l.subtotal)}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <dt className="font-display font-bold">Total</dt>
              <dd className="font-display text-2xl font-extrabold">{formatMoney(total)}</dd>
            </div>
          </dl>
          <button
            className="btn-primary mt-5 w-full py-3.5"
            onClick={() => (session ? navigate('/confirmar') : navigate('/ingresar', { state: { from: '/confirmar' } }))}
          >
            {session ? 'Continuar con la compra' : 'Iniciá sesión para continuar'} <ArrowRight className="size-5" />
          </button>
          <p className="mt-3 text-center text-xs text-muted">Los precios se verifican nuevamente al confirmar el pedido.</p>
        </aside>
      </div>
    </div>
  )
}
