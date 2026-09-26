import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Shopify orders and webhooks production contract', () => {
  it('does not render sample Shopify orders', () => {
    const page = read('src/pages/Orders.tsx')
    expect(page).not.toContain('mockOrders')
    expect(page).toContain('shopifyService.getOrders')
    expect(page).toContain('No confirmed Shopify orders')
  })

  it('requires real order access and persists Shopify orders', () => {
    const fn = read('supabase/functions/shopify/index.ts')
    const migration = read('supabase/migrations/20260926232000_shopify_orders_webhooks_p0.sql')
    expect(fn).toContain("'read_orders'")
    expect(fn).toContain("action === 'orders'")
    expect(fn).toContain(".from('shopify_orders')")
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.shopify_orders')
    expect(migration).toContain('UNIQUE (user_id, connection_id, shopify_order_id)')
  })

  it('verifies Shopify webhook HMAC before persisting an order', () => {
    const fn = read('supabase/functions/shopify/index.ts')
    expect(fn).toContain("x-shopify-hmac-sha256")
    expect(fn).toContain("SHOPIFY_APP_CLIENT_SECRET")
    expect(fn).toContain("crypto.subtle.sign('HMAC'")
    expect(fn).toContain('SHOPIFY_WEBHOOK_HMAC_INVALID')
    expect(fn.indexOf('SHOPIFY_WEBHOOK_HMAC_INVALID')).toBeLessThan(fn.indexOf(".from('shopify_webhook_deliveries')"))
  })

  it('deduplicates webhook deliveries and registers order subscriptions', () => {
    const fn = read('supabase/functions/shopify/index.ts')
    const migration = read('supabase/migrations/20260926232000_shopify_orders_webhooks_p0.sql')
    expect(fn).toContain("deliveryError?.code === '23505'")
    expect(fn).toContain("'ORDERS_CREATE'")
    expect(fn).toContain("'ORDERS_UPDATED'")
    expect(fn).toContain('webhookSubscriptionCreate')
    expect(migration).toContain('UNIQUE (connection_id, delivery_id)')
  })

  it('keeps webhook secrets server-only', () => {
    const env = read('.env.example')
    expect(env).toContain('SHOPIFY_APP_CLIENT_SECRET=')
    expect(env).toContain('SHOPIFY_WEBHOOK_URL=')
    expect(env).not.toContain('VITE_SHOPIFY_APP_CLIENT_SECRET')
    expect(env).not.toContain('VITE_SHOPIFY_WEBHOOK_URL')
  })
})
