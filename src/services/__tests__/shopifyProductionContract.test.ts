import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Shopify production contract', () => {
  it('keeps Shopify Admin credentials out of the Vite frontend contract', () => {
    const envExample = read('.env.example')
    const productsPage = read('src/pages/Products.tsx')
    expect(envExample).not.toMatch(/VITE_[A-Z0-9_]*SHOPIFY/)
    expect(productsPage).not.toContain('X-Shopify-Access-Token')
    expect(productsPage).not.toContain('/admin/api/')
  })

  it('keeps the legacy Shopify Edge path explicitly fail-closed', () => {
    const legacyFunction = read('supabase/functions/platforms/shopify/index.ts')
    expect(legacyFunction).toContain("status: 410")
    expect(legacyFunction).toContain('LEGACY_SHOPIFY_ENDPOINT_DISABLED')
    expect(legacyFunction).not.toMatch(/success:\s*true/)
  })

  it('locks credentials to service_role and exposes only owner publication reads', () => {
    const migration = read('supabase/migrations/20260919091526_shopify_secure_integration_p0.sql')
    expect(migration).toContain('shopify_private.connection_secrets')
    expect(migration).toContain('REVOKE ALL ON TABLE shopify_private.connection_secrets FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('TO service_role')
    expect(migration).toContain('USING ((SELECT auth.uid()) = user_id)')
    expect(migration).toContain("status = 'inactive'")
  })

  it('contains no malformed redirect escape', () => {
    const routes = read('src/routes.tsx')
    expect(routes).not.toContain('dashboard\\')
    expect(routes).not.toContain('to="/\\"')
  })
})
