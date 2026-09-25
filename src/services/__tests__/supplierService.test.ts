import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

vi.mock('../cjSupplierService', () => ({
  cjSupplierService: {
    createOrder: vi.fn(),
    getOrderDetail: vi.fn(),
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

import { cjSupplierService } from '../cjSupplierService'
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
    vi.mocked(cjSupplierService.createOrder).mockReset()
    vi.mocked(cjSupplierService.getOrderDetail).mockReset()
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

  it('imports CJ products through the verified snapshot pipeline without credentials', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        success: true,
        importedCount: 1,
        failedCount: 0,
        imported: [{ externalId: 'product-1', snapshotId: 'snapshot-1' }],
        failed: [],
      },
    })

    await expect(
      supplierService.importProducts('supplier-1', ['product-1'])
    ).resolves.toEqual({
      success: true,
      message: 'Imported 1 verified CJdropshipping product snapshots',
      importedCount: 1,
      failedCount: 0,
      errors: [],
    })

    const [, payload] = vi.mocked(axios.post).mock.calls[0]
    expect(payload).toEqual({
      supplierId: 'supplier-1',
      action: 'snapshot_import',
      productIds: ['product-1'],
    })
    expect(payload).not.toHaveProperty('apiKey')
    expect(payload).not.toHaveProperty('apiSecret')
  })

  it('creates CJ orders through the credential-free CJ facade', async () => {
    vi.mocked(cjSupplierService.createOrder).mockResolvedValueOnce({
      success: true,
      data: { data: { orderId: 'cj-order-1', orderStatus: 'CREATED' } },
    })

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
    ).resolves.toMatchObject({
      success: true,
      externalOrderId: 'cj-order-1',
      status: 'CREATED',
    })
  })

  it('returns CJ order status without inventing tracking data', async () => {
    vi.mocked(cjSupplierService.getOrderDetail).mockResolvedValueOnce({
      success: true,
      data: { data: { orderStatus: 'SHIPPED', trackingNumber: 'TRACK-1' } },
    })

    await expect(
      supplierService.getOrderStatus('supplier-1', 'remote-1')
    ).resolves.toEqual({
      status: 'SHIPPED',
      trackingNumber: 'TRACK-1',
      estimatedDelivery: undefined,
    })
  })
})
