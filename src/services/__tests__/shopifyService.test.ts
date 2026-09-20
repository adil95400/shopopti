import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: invokeMock } },
}))

import { ShopifyServiceError, shopifyService } from '../shopifyService'

describe('shopifyService', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  it('reports connected only from a confirmed server response', async () => {
    invokeMock.mockResolvedValue({
      data: {
        success: true,
        connected: true,
        connection: {
          id: 'connection-1',
          platform_id: 'shopify',
          name: 'Demo',
          type: 'webstore',
          status: 'active',
          settings: { shop_domain: 'demo.myshopify.com' },
        },
      },
      error: null,
    })

    await expect(shopifyService.getStatus()).resolves.toMatchObject({ connected: true })
    expect(invokeMock).toHaveBeenCalledWith('shopify', { body: { action: 'status' } })
  })

  it('fails closed for an unconfirmed connection response', async () => {
    invokeMock.mockResolvedValue({ data: { success: true, connected: false }, error: null })
    await expect(shopifyService.connect('demo.myshopify.com', 'secret-token')).rejects.toMatchObject({
      code: 'SHOPIFY_CONNECTION_UNCONFIRMED',
    })
  })

  it('preserves structured server errors without returning credentials', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: {
          json: async () => ({
            error: { code: 'SHOPIFY_TOKEN_INVALID', message: 'Shopify rejected the access token.', retryable: false },
          }),
        },
      },
    })

    const promise = shopifyService.validate('demo.myshopify.com', 'invalid-token')
    await expect(promise).rejects.toBeInstanceOf(ShopifyServiceError)
    await expect(promise).rejects.toMatchObject({ code: 'SHOPIFY_TOKEN_INVALID', retryable: false })
  })

  it('uses the same canonical action for initial and repeated publication', async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { success: true, published: true, confirmed: true, operation: 'created', product: { id: 'remote-1' } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { success: true, published: true, confirmed: true, operation: 'updated', product: { id: 'remote-1' } },
        error: null,
      })

    await expect(shopifyService.publishProduct('local-1')).resolves.toMatchObject({ operation: 'created' })
    await expect(shopifyService.publishProduct('local-1')).resolves.toMatchObject({ operation: 'updated' })
    expect(invokeMock).toHaveBeenNthCalledWith(1, 'shopify', {
      body: { action: 'publish_product', product_id: 'local-1' },
    })
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'shopify', {
      body: { action: 'publish_product', product_id: 'local-1' },
    })
  })

  it('routes price and inventory updates through the canonical server function', async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, confirmed: true, product: { id: 'remote-1' } },
      error: null,
    })

    await shopifyService.updatePrice('local-1', 19.95)
    await shopifyService.updateInventory('local-1', 12)

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'shopify', {
      body: { action: 'update_price', product_id: 'local-1', price: 19.95 },
    })
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'shopify', {
      body: { action: 'update_inventory', product_id: 'local-1', stock: 12 },
    })
  })
})
