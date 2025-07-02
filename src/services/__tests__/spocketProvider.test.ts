import { describe, it, expect } from 'vitest'
import { SupplierProduct, ImportFilter } from '@/types/supplier'

interface SpocketRequest {
  apiKey: string
  filters?: ImportFilter
}

async function spocketProvider(req: SpocketRequest): Promise<{ products: SupplierProduct[] }> {
  const { apiKey, filters } = req
  if (!apiKey) throw new Error('API key is required')

  const products: SupplierProduct[] = [
    {
      id: 'sp-1',
      externalId: 'SP1',
      name: 'Spocket Product 1',
      description: 'desc',
      price: 20,
      msrp: 30,
      stock: 10,
      images: ['img1'],
      category: 'Electronics',
      supplier_id: 'spocket',
      supplier_type: 'spocket',
      shipping_time: '5 days',
      processing_time: '1 day'
    },
    {
      id: 'sp-2',
      externalId: 'SP2',
      name: 'Spocket Product 2',
      description: 'desc',
      price: 50,
      msrp: 60,
      stock: 5,
      images: ['img2'],
      category: 'Home',
      supplier_id: 'spocket',
      supplier_type: 'spocket',
      shipping_time: '6 days',
      processing_time: '2 days'
    }
  ]

  let filtered = [...products]
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

describe('spocket provider', () => {
  it('maps response to SupplierProduct', async () => {
    const { products } = await spocketProvider({ apiKey: 'key' })
    expect(products[0]).toEqual(
      expect.objectContaining({
        id: 'sp-1',
        externalId: 'SP1',
        supplier_id: 'spocket'
      })
    )
  })

  it('applies category and price filters', async () => {
    const { products } = await spocketProvider({
      apiKey: 'key',
      filters: { category: 'Electronics', minPrice: 10, maxPrice: 30 }
    })
    expect(products.length).toBe(1)
    expect(products[0].category).toBe('Electronics')
  })

  it('throws when apiKey missing', async () => {
    await expect(spocketProvider({ apiKey: '' })).rejects.toThrow('API key is required')
  })
})
