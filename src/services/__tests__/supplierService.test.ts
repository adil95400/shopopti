import { describe, expect, it } from 'vitest'

import { supplierService } from '../supplierService'

describe('supplierService fail-closed automation', () => {
  it('does not expose categories without a verified connector', async () => {
    await expect(supplierService.getCategories('supplier-1')).rejects.toThrow(
      'Supplier categories are not available until a verified provider connector implements them'
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
    await expect(supplierService.getOrderStatus('supplier-1', 'remote-1')).rejects.toThrow(
      'Supplier tracking is not available until a verified provider connector implements it'
    )
  })
})
