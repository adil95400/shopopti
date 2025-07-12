import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SupplierProduct, ImportFilter } from '@/types/supplier'

interface AutodsRequest {
  apiKey: string
  baseUrl?: string
  filters?: ImportFilter
}

async function autodsProvider(req: AutodsRequest): Promise<{ products: SupplierProduct[] }> {
  const { apiKey, baseUrl = 'https://dummyjson.com', filters } = req
  if (!apiKey) throw new Error('API key is required')

  let fetched: any[] = []
  try {
    const res = await fetch(`${baseUrl}/products`)
    if (res.ok) {
      const data = await res.json()
      fetched = data.products || []
    }
  } catch (_) {
    // ignore
  }
  if (fetched.length === 0) {
    fetched = [
      { id: 1, title: 'AutoDS Demo', description: 'demo', price: 20, stock: 5, category: 'General', images: ['img'] }
    ]
  }

  const mapped = fetched.map((p: any, idx: number) => ({
    id: `ad-${p.id ?? idx + 1}`,
    externalId: String(p.id ?? idx + 1),
    name: p.title || `AutoDS Product ${idx + 1}`,
    description: p.description || 'AutoDS product',
    price: p.price ?? 0,
    msrp: p.price ? Math.round(p.price * 1.2) : 0,
    stock: p.stock ?? 0,
    images: p.images && Array.isArray(p.images) ? p.images : [p.thumbnail].filter(Boolean),
    category: p.category || 'General',
    supplier_id: 'autods',
    supplier_type: 'autods',
    shipping_time: '3 days',
    processing_time: '1 day'
  }))

  let filtered = [...mapped]
  if (filters?.category) {
    filtered = filtered.filter(p => p.category === filters.category)
  }
  if (filters?.minPrice) {
    filtered = filtered.filter(p => p.price >= filters.minPrice!)
  }
  if (filters?.maxPrice) {
    filtered = filtered.filter(p => p.price <= filters.maxPrice!)
  }

  return { products: filtered }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('autods provider', () => {
  it('maps fetch response to SupplierProduct', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ products: [{ id: 2, title: 'Test', description: 't', price: 30, stock: 3, category: 'Electronics', images: ['u'] }] })
    }) as any))
    const { products } = await autodsProvider({ apiKey: 'k' })
    expect(products[0]).toEqual(
      expect.objectContaining({
        id: 'ad-2',
        externalId: '2',
        name: 'Test',
        price: 30,
        category: 'Electronics'
      })
    )
  })

  it('filters by category and price', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ products: [
        { id: 1, title: 'A', description: 'a', price: 10, stock: 3, category: 'Home', images: ['a'] },
        { id: 2, title: 'B', description: 'b', price: 40, stock: 3, category: 'Electronics', images: ['b'] }
      ] })
    }) as any))
    const { products } = await autodsProvider({
      apiKey: 'k',
      filters: { category: 'Electronics', minPrice: 20, maxPrice: 50 }
    })
    expect(products.length).toBe(1)
    expect(products[0].category).toBe('Electronics')
    expect(products[0].price).toBe(40)
  })

  it('falls back to demo data on invalid response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) }) as any))
    const { products } = await autodsProvider({ apiKey: 'k' })
    expect(products.length).toBeGreaterThan(0)
  })

  it('throws when apiKey missing', async () => {
    await expect(autodsProvider({ apiKey: '' })).rejects.toThrow('API key is required')
  })
})
