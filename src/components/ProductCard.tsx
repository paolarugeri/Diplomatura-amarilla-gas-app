import { useMemo, useState } from 'react'
import { Check, ShoppingCart, Weight } from 'lucide-react'
import type { Product } from '../lib/types'
import { containerLabel, formatMoney } from '../lib/format'
import { unitPriceFor, useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { QtyStepper } from './ui'

export function ProductCard({ product }: { product: Product }) {
  const { add, products } = useCart()
  const toast = useToast()
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const refill = product.refill_product_id ? byId.get(product.refill_product_id) : undefined
  const canRefill = product.category === 'envase' && Boolean(refill)
  const [withRefill, setWithRefill] = useState(canRefill)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const unit = unitPriceFor(product, withRefill && canRefill, byId)

  function onAdd() {
    add(product.id, withRefill && canRefill, qty)
    setAdded(true)
    setTimeout(() => setAdded(false), 1400)
    toast('success', `Agregaste ${qty} × ${product.name}${product.category === 'envase' ? (withRefill ? ' con carga' : ' sin carga') : ''} al carrito.`)
    setQty(1)
  }

  return (
    <article className="card flex flex-col overflow-hidden">
      <div className="relative h-44 bg-[#f5f3ed] sm:h-52">
        <img src={product.image_url ?? '/img/garrafa-chapa-10.png'} alt={product.name} className="h-full w-full object-contain" loading="lazy" />
        <span className="chip absolute left-3 top-3 bg-ink text-white">
          <Weight className="size-3.5" /> {Number(product.capacity_kg)} kg
        </span>
        {product.category === 'carga' && <span className="chip absolute right-3 top-3 bg-white text-ink shadow">Requiere envase propio</span>}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-lg font-extrabold leading-tight">{product.name}</h3>
        <dl className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
          <div>
            <dt className="inline">Capacidad: </dt>
            <dd className="inline font-semibold text-ink-2">{Number(product.capacity_kg)} kg</dd>
          </div>
          <div>
            <dt className="inline">Envase: </dt>
            <dd className="inline font-semibold text-ink-2">{containerLabel[product.container_type]}</dd>
          </div>
        </dl>
        <p className="mt-2 line-clamp-3 text-sm text-ink-2">{product.description}</p>

        {canRefill && refill && (
          <fieldset className="mt-4">
            <legend className="sr-only">¿Con carga de GLP?</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: false, title: 'Solo envase', price: Number(product.price) },
                { v: true, title: 'Con carga', price: Number(product.price) + Number(refill.price) },
              ].map((o) => (
                <label
                  key={String(o.v)}
                  className={`cursor-pointer rounded-xl border-2 p-2.5 text-center transition ${
                    withRefill === o.v ? 'border-ink bg-brand-50' : 'border-line hover:border-ink/30'
                  }`}
                >
                  <input type="radio" className="sr-only" name={`refill-${product.id}`} checked={withRefill === o.v} onChange={() => setWithRefill(o.v)} />
                  <span className="block text-xs font-bold text-ink-2">{o.title}</span>
                  <span className="block font-display text-[15px] font-extrabold">{formatMoney(o.price)}</span>
                </label>
              ))}
            </div>
            {withRefill && (
              <p className="mt-1.5 text-xs text-muted">
                Envase {formatMoney(product.price)} + {refill.name.toLowerCase()} {formatMoney(refill.price)}
              </p>
            )}
          </fieldset>
        )}

        <div className="mt-auto pt-4">
          {!canRefill && <p className="mb-3 font-display text-2xl font-extrabold">{formatMoney(unit)}</p>}
          <div className="flex items-center gap-2">
            <QtyStepper value={qty} onChange={setQty} label={`Cantidad de ${product.name}`} />
            <button className={`flex-1 ${added ? 'btn-dark' : 'btn-primary'}`} onClick={onAdd} aria-label={`Agregar ${product.name} al carrito`}>
              {added ? <Check className="size-5" /> : <ShoppingCart className="size-5" />}
              {added ? 'Agregado' : 'Agregar'}
            </button>
          </div>
          {qty > 1 && <p className="mt-2 text-right text-xs text-muted">Subtotal: {formatMoney(unit * qty)}</p>}
        </div>
      </div>
    </article>
  )
}
