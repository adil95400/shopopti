import { describe, expect, it, vi } from 'vitest'

import {
  ShopifyIntegrationError,
  assertVerifiedVariants,
  buildProductSetVariables,
  normalizeShopDomain,
  shopifyGraphQL,
} from './core'

describe('Shopify integration core', () => {
  it('accepts only canonical HTTPS myshopify domains', () => {
    expect(normalizeShopDomain('demo-store.myshopify.com')).toBe('demo-store.myshopify.com')
    expect(normalizeShopDomain('https://demo-store.myshopify.com/')).toBe('demo-store.myshopify.com')
    expect(() => normalizeShopDomain('https://example.com')).toThrow('canonical store domain')
    expect(() => normalizeShopDomain('https://demo-store.myshopify.com/admin')).toThrow('canonical store domain')
  })

  it('builds deterministic create payloads with variants, media and inventory', () => {
    const result = buildProductSetVariables({
      product: {
        id: 'local-product',
        title: 'Verified product',
        description: '<p>Description</p>',
        price: 12.5,
        image_url: 'https://cdn.example.com/main.jpg',
        images: ['https://cdn.example.com/second.jpg', 'https://cdn.example.com/main.jpg'],
        sku: 'SKU-1',
        stock: 7,
      },
      locationId: 'gid://shopify/Location/1',
    })

    expect(result.identifier).toEqual({ handle: 'shopopti-local-product' })
    expect(result.input).toMatchObject({
      handle: 'shopopti-local-product',
      status: 'ACTIVE',
      variants: [{
        price: '12.50',
        sku: 'SKU-1',
        inventoryQuantities: [{
          locationId: 'gid://shopify/Location/1',
          name: 'available',
          quantity: 7,
        }],
      }],
    })
    expect(result.input.files).toEqual([
      { originalSource: 'https://cdn.example.com/main.jpg' },
      { originalSource: 'https://cdn.example.com/second.jpg' },
    ])
    expect(result.expectedVariants).toEqual([{
      key: 'SKU-1',
      price: '12.50',
      sku: 'SKU-1',
      available: 7,
    }])
  })

  it('uses persisted Shopify IDs for an update instead of creating duplicates', () => {
    const result = buildProductSetVariables({
      product: {
        id: 'local-product',
        title: 'Updated product',
        price: 20,
        variants: [{ id: 'local-variant', price: 20, sku: 'SKU-2', stock: 3 }],
      },
      locationId: 'gid://shopify/Location/1',
      existingProductId: 'gid://shopify/Product/100',
      existingVariants: [{
        key: 'local-variant',
        variantId: 'gid://shopify/ProductVariant/200',
        inventoryItemId: 'gid://shopify/InventoryItem/300',
      }],
      priceOverride: 24.5,
      stockOverride: 9,
    })

    expect(result.identifier).toEqual({ id: 'gid://shopify/Product/100' })
    expect(result.input.variants[0]).toMatchObject({
      id: 'gid://shopify/ProductVariant/200',
      price: '24.50',
      inventoryQuantities: [{ quantity: 9 }],
    })
  })

  it('fails closed when Shopify does not confirm price or stock', () => {
    expect(() => assertVerifiedVariants(
      [{ key: 'SKU-1', price: '10.00', sku: 'SKU-1', available: 5 }],
      [{ price: '10.00', sku: 'SKU-1', available: 4 }],
    )).toThrowError(ShopifyIntegrationError)
  })

  it('retries throttling without exposing the token in the request body', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ message: 'slow down', extensions: { code: 'THROTTLED' } }] }), {
        status: 200,
        headers: { 'retry-after': '0' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { shop: { id: 'gid://shopify/Shop/1' } } }), { status: 200 }))
    const token = 'shpat_test_token_1234567890'

    const result = await shopifyGraphQL<{ shop: { id: string } }>({
      domain: 'demo-store.myshopify.com',
      accessToken: token,
      query: 'query { shop { id } }',
      fetchImpl,
    })

    expect(result.shop.id).toBe('gid://shopify/Shop/1')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const [url, request] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/admin/api/2026-07/graphql.json')
    expect(url).not.toContain(token)
    expect(String(request.body)).not.toContain(token)
    expect(request.headers).toMatchObject({ 'X-Shopify-Access-Token': token })
  })
})
