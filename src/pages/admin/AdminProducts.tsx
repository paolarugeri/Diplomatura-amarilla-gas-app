import { useEffect, useState, type FormEvent } from 'react'
import { History, ImageUp, Pencil, Plus, X } from 'lucide-react'
import { friendlyError, supabase } from '../../lib/supabase'
import type { ContainerType, Product, ProductCategory } from '../../lib/types'
import { containerLabel, formatDateTime, formatMoney } from '../../lib/format'
import { Alert, Field, PageLoader, PageTitle, SelectField, Spinner, TextAreaField } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useCart } from '../../context/CartContext'

type Draft = {
  id?: string
  sku: string
  name: string
  category: ProductCategory
  capacity_kg: string
  container_type: ContainerType
  description: string
  image_url: string
  price: string
  refill_product_id: string
  active: boolean
  sort_order: string
}

const toDraft = (p?: Product): Draft => ({
  id: p?.id,
  sku: p?.sku ?? '',
  name: p?.name ?? '',
  category: p?.category ?? 'envase',
  capacity_kg: p ? String(Number(p.capacity_kg)) : '10',
  container_type: p?.container_type ?? 'chapa',
  description: p?.description ?? '',
  image_url: p?.image_url ?? '',
  price: p ? String(Number(p.price)) : '',
  refill_product_id: p?.refill_product_id ?? '',
  active: p?.active ?? true,
  sort_order: String(p?.sort_order ?? 10),
})

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [history, setHistory] = useState<{ product: Product; rows: { price: number; valid_from: string }[] } | null>(null)
  const toast = useToast()
  const { reloadProducts } = useCart()

  async function load() {
    const { data } = await supabase.from('products').select('*').order('sort_order')
    setProducts((data as Product[]) ?? [])
  }
  useEffect(() => {
    load()
  }, [])

  async function toggle(p: Product) {
    const { error } = await supabase.from('products').update({ active: !p.active }).eq('id', p.id)
    if (error) return toast('error', friendlyError(error))
    toast('success', `${p.name} ${p.active ? 'desactivado' : 'activado'}.`)
    load()
    reloadProducts()
  }

  async function showHistory(p: Product) {
    const { data } = await supabase.from('product_prices').select('price, valid_from').eq('product_id', p.id).order('valid_from', { ascending: false })
    setHistory({ product: p, rows: (data as { price: number; valid_from: string }[]) ?? [] })
  }

  if (!products) return <PageLoader />
  const byId = new Map(products.map((p) => [p.id, p]))

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <PageTitle title="Productos" subtitle="Precios, imágenes y disponibilidad del catálogo." />
        <button className="btn-primary shrink-0 px-4 py-2.5 text-sm" onClick={() => setDraft(toDraft())}>
          <Plus className="size-4" /> Nuevo
        </button>
      </div>
      <Alert tone="info">
        El precio de un envase <b>con carga</b> se calcula solo: precio del envase + precio de la carga asociada. Cambiá el precio de la carga una vez y se
        actualizan todos los combos. Los pedidos ya realizados conservan el precio de la compra.
      </Alert>

      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {products.map((p) => {
          const refill = p.refill_product_id ? byId.get(p.refill_product_id) : undefined
          return (
            <li key={p.id} className={`card flex gap-3 p-3 ${p.active ? '' : 'opacity-60'}`}>
              <img src={p.image_url ?? ''} alt="" className="size-20 shrink-0 rounded-xl bg-brand-50 object-contain" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display font-extrabold">{p.name}</p>
                    <p className="text-xs text-muted">
                      {p.sku} · {p.category === 'carga' ? 'Carga' : 'Envase'} · {Number(p.capacity_kg)} kg · {containerLabel[p.container_type]}
                    </p>
                  </div>
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-bold">
                    <input type="checkbox" className="peer sr-only" checked={p.active} onChange={() => toggle(p)} />
                    <span className="relative h-6 w-10 rounded-full bg-line transition peer-checked:bg-ok after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
                    {p.active ? 'Activo' : 'Inactivo'}
                  </label>
                </div>
                <p className="mt-1 font-display text-lg font-extrabold">{formatMoney(p.price)}</p>
                {refill && (
                  <p className="text-xs text-ink-2">
                    Con carga: <b>{formatMoney(Number(p.price) + Number(refill.price))}</b> (+ {refill.name})
                  </p>
                )}
                <div className="mt-2 flex gap-1">
                  <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => setDraft(toDraft(p))}>
                    <Pencil className="size-3.5" /> Editar
                  </button>
                  <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => showHistory(p)}>
                    <History className="size-3.5" /> Historial de precios
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {draft && (
        <ProductForm
          draft={draft}
          refills={products.filter((p) => p.category === 'carga')}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null)
            load()
            reloadProducts()
          }}
        />
      )}

      {history && (
        <Modal title={`Historial de precios · ${history.product.name}`} onClose={() => setHistory(null)}>
          <ul className="divide-y divide-line text-sm">
            {history.rows.map((r, i) => (
              <li key={i} className="flex justify-between py-2">
                <span className="text-ink-2">{formatDateTime(r.valid_from)}</span>
                <b>{formatMoney(r.price)}</b>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button className="grid size-9 place-items-center rounded-full hover:bg-black/5" onClick={onClose} aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ProductForm({ draft, refills, onClose, onSaved }: { draft: Draft; refills: Product[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Draft>(draft)
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const toast = useToast()
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setF((x) => ({ ...x, [k]: v }))

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) return toast('error', 'La imagen supera los 2 MB.')
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('productos').upload(path, file, { contentType: file.type })
    setUploading(false)
    if (error) return toast('error', friendlyError(error))
    set('image_url', supabase.storage.from('productos').getPublicUrl(path).data.publicUrl)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!/^[A-Z0-9-]{3,30}$/.test(f.sku.trim().toUpperCase())) errs.sku = 'Código de 3 a 30 caracteres (letras, números y guiones).'
    if (f.name.trim().length < 3) errs.name = 'Ingresá el nombre.'
    const price = Number(f.price)
    if (!f.price || !Number.isFinite(price) || price <= 0) errs.price = 'Ingresá un precio mayor a cero.'
    const cap = Number(f.capacity_kg)
    if (!Number.isFinite(cap) || cap <= 0) errs.capacity_kg = 'Capacidad inválida.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setError('')
    const payload = {
      sku: f.sku.trim().toUpperCase(),
      name: f.name.trim(),
      category: f.category,
      capacity_kg: cap,
      container_type: f.category === 'carga' ? 'propio' : f.container_type,
      description: f.description.trim(),
      image_url: f.image_url.trim() || null,
      price: Math.round(price * 100) / 100,
      refill_product_id: f.category === 'envase' && f.refill_product_id ? f.refill_product_id : null,
      active: f.active,
      sort_order: Number(f.sort_order) || 0,
    }
    const { error } = f.id ? await supabase.from('products').update(payload).eq('id', f.id) : await supabase.from('products').insert(payload)
    setBusy(false)
    if (error) return setError(/duplicate key/.test(error.message) ? 'Ya existe un producto con ese código.' : friendlyError(error))
    toast('success', f.id ? 'Producto actualizado.' : 'Producto creado.')
    onSaved()
  }

  const refill = refills.find((r) => r.id === f.refill_product_id)

  return (
    <Modal title={f.id ? 'Editar producto' : 'Nuevo producto'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Categoría" name="category" value={f.category} onChange={(e) => set('category', e.target.value as ProductCategory)}>
            <option value="carga">Carga de GLP</option>
            <option value="envase">Envase</option>
          </SelectField>
          <Field label="Código (SKU)" name="sku" value={f.sku} onChange={(e) => set('sku', e.target.value.toUpperCase())} error={errors.sku} />
        </div>
        <Field label="Nombre" name="name" value={f.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Capacidad (kg)" name="capacity_kg" type="number" min={1} step="0.5" value={f.capacity_kg} onChange={(e) => set('capacity_kg', e.target.value)} error={errors.capacity_kg} />
          {f.category === 'envase' ? (
            <SelectField label="Tipo de envase" name="container_type" value={f.container_type} onChange={(e) => set('container_type', e.target.value as ContainerType)}>
              <option value="chapa">Chapa (acero)</option>
              <option value="plastico">Plástico</option>
            </SelectField>
          ) : (
            <Field label="Tipo de envase" name="ct" value="Envase propio" disabled />
          )}
        </div>
        <Field label="Precio ($)" name="price" type="number" inputMode="decimal" min={1} step="1" value={f.price} onChange={(e) => set('price', e.target.value)} error={errors.price} />
        {f.category === 'envase' && (
          <div>
            <SelectField label="Carga asociada (opción “con carga”)" name="refill" value={f.refill_product_id} onChange={(e) => set('refill_product_id', e.target.value)}>
              <option value="">Sin opción con carga</option>
              {refills.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({formatMoney(r.price)})
                </option>
              ))}
            </SelectField>
            {refill && Number(f.price) > 0 && (
              <p className="mt-1 text-xs text-ink-2">
                Precio con carga calculado: <b>{formatMoney(Number(f.price) + Number(refill.price))}</b>
              </p>
            )}
          </div>
        )}
        <TextAreaField label="Descripción" name="description" value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={400} />
        <div>
          <span className="label">Imagen</span>
          <div className="flex items-center gap-3">
            {f.image_url && <img src={f.image_url} alt="" className="size-16 rounded-lg bg-brand-50 object-contain" />}
            <label className="btn-outline cursor-pointer px-3 py-2 text-sm">
              {uploading ? <Spinner className="size-4" /> : <ImageUp className="size-4" />} Subir imagen
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
          <input className="input mt-2 text-xs" placeholder="o pegá la URL de la imagen" value={f.image_url} onChange={(e) => set('image_url', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 items-end gap-3">
          <Field label="Orden en catálogo" name="sort_order" type="number" value={f.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
          <label className="flex items-center gap-2 pb-3 text-sm font-semibold">
            <input type="checkbox" className="size-5 accent-brand-700" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> Visible en el catálogo
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-dark" disabled={busy || uploading}>
            {busy ? <Spinner className="size-5 text-white" /> : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
