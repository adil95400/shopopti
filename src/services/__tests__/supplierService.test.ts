import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'session-token' } },
      }),
    },
  },
}))

import axios from 'axios'

import { supplierService } from '../supplierService'

describe('supplierService server-side supplier contracts', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(supplierService, 'getSupplierSummaryById').mockResolvedValue({
      id: 'supplier-1',
      name: 'CJ account',
      type: 'cj_dropshipping',
      status: 'active',
      created_at: '2026-09-25T00:00:00.000Z',
    })
    vi.mocked(axios.post).mockReset()
  })

  it('loads CJ products without sending supplier credentials from the browser', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { products: [] },
    })

    await supplierService.getProducts('supplier-1', { search: 'hoodie', page: 1, limit: 20 })

    expect(axios.post).toHaveBeenCalledTimes(1)
    const [, payload, config] = vi.mocked(axios.post).mock.calls[0]

    expect(payload).toEqual({
      supplierId: 'supplier-1',
      action: 'search',
      filters: { search: 'hoodie', page: 1, limit: 20 },
    })
    expect(payload).not.toHaveProperty('apiKey')
    expect(payload).not.toHaveProperty('apiSecret')
    expect(config?.headers?.Authorization).toBe('Bearer session-token')
  })

  it('queries CJ stock by variant id without browser-side credentials', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { stock: 42 },
    })

    await expect(
      supplierService.getVariantStock('supplier-1', 'variant-1')
    ).resolves.toBe(42)

    const [, payload] = vi.mocked(axios.post).mock.calls[0]
    expect(payload).toEqual({
      supplierId: 'supplier-1',
      action: 'stock',
      variantId: 'variant-1',
    })
    expect(payload).not.toHaveProperty('apiKey')
  })

  it('keeps canonical supplier import disabled until verified snapshots are wired', async () => {
    await expect(
      supplierService.importProducts('supplier-1', ['product-1'])
    ).rejects.toThrow(
      'Supplier import is disabled until the canonical import pipeline accepts verified server-side product snapshots'
    )
  })

  it('does not create supplier orders without a verified connector', async () => {
    await expect(
      supplierService.createOrder('supplier-1', {
        external_order_id: 'order-1',
        shipping_address: {
          name: 'Test',
          address1: '1 Test St',
          city: 'Paris',
          state: 'IDF',
          zip: '75001',
          country: 'FR',
        },
        items: [],
      })
    ).rejects.toThrow(
      'Supplier order automation is not available until a verified provider connector implements it'
    )
  })

  it('does not invent supplier tracking without a verified connector', async () => {
    await expect(
      supplierService.getOrderStatus('supplier-1', 'remote-1')
    ).rejects.toThrow(
      'Supplier tracking is not available until a verified provider connector implements it'
    )
  })
})
