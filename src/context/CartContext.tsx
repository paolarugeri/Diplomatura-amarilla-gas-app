import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Product } from '../lib/types'

export interface CartLine {
  product_id: string
  with_refill: boolean
  quantity: number
}

export interface PricedLine extends CartLine {
  key: string
  product: Product
  refill: Product | null
  unitPrice: number
  subtotal: number
}

interface CartState {
  lines: CartLine[]
  priced: PricedLine[]
  products: Product[]
  productsLoading: boolean
  reloadProducts: () => Promise<void>
  count: number
  total: number
  add: (productId: string, withRefill: boolean, qty: number) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
  replace: (lines: CartLine[]) => void
}

export const MAX_QTY = 20
const STORAGE_KEY = 'amarilla-gas:carrito'
const CartContext = createContext<CartState | null>(null)

export const lineKey = (l: Pick<CartLine, 'product_id' | 'with_refill'>) => `${l.product_id}:${l.with_refill ? 1 : 0}`

/** Precio unitario según la selección: envase + carga correspondiente cuando se elige "con carga". */
export function unitPriceFor(product: Product, withRefill: boolean, byId: Map<string, Product>): number {
  const base = Number(product.price)
  if (!withRefill || product.category !== 'envase' || !product.refill_product_id) return base
  const refill = byId.get(product.refill_product_id)
  return base + (refill ? Number(refill.price) : 0)
}

function readStorage(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : []
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.product_id === 'string' && l.quantity > 0) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readStorage)
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)

  const reloadProducts = useCallback(async () => {
    setProductsLoading(true)
    const { data } = await supabase.from('products').select('*').eq('active', true).order('sort_order')
    setProducts((data as Product[]) ?? [])
    setProductsLoading(false)
  }, [])

  useEffect(() => {
    reloadProducts()
  }, [reloadProducts])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      /* almacenamiento no disponible: el carrito vive solo en memoria */
    }
  }, [lines])

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const priced = useMemo<PricedLine[]>(() => {
    const out: PricedLine[] = []
    for (const l of lines) {
      const product = byId.get(l.product_id)
      if (!product) continue
      const refill = l.with_refill && product.refill_product_id ? (byId.get(product.refill_product_id) ?? null) : null
      if (l.with_refill && !refill) continue
      const unitPrice = unitPriceFor(product, l.with_refill, byId)
      out.push({ ...l, key: lineKey(l), product, refill, unitPrice, subtotal: unitPrice * l.quantity })
    }
    return out
  }, [lines, byId])

  const add = useCallback((productId: string, withRefill: boolean, qty: number) => {
    setLines((prev) => {
      const key = lineKey({ product_id: productId, with_refill: withRefill })
      const existing = prev.find((l) => lineKey(l) === key)
      if (existing) {
        return prev.map((l) => (lineKey(l) === key ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + qty) } : l))
      }
      return [...prev, { product_id: productId, with_refill: withRefill, quantity: Math.min(MAX_QTY, qty) }]
    })
  }, [])

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) =>
      prev.map((l) => (lineKey(l) === key ? { ...l, quantity: Math.max(1, Math.min(MAX_QTY, Math.round(qty))) } : l)),
    )
  }, [])

  const remove = useCallback((key: string) => setLines((prev) => prev.filter((l) => lineKey(l) !== key)), [])
  const clear = useCallback(() => setLines([]), [])
  const replace = useCallback((next: CartLine[]) => setLines(next), [])

  const value: CartState = {
    lines,
    priced,
    products,
    productsLoading,
    reloadProducts,
    count: priced.reduce((s, l) => s + l.quantity, 0),
    total: priced.reduce((s, l) => s + l.subtotal, 0),
    add,
    setQty,
    remove,
    clear,
    replace,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider')
  return ctx
}
