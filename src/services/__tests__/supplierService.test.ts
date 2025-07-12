import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }))
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) } } }))

import axios from 'axios'
import { supplierService } from '../supplierService'

beforeEach(() => {
  vi.spyOn(supplierService, 'getSupplierById').mockResolvedValue({
    id: '1',
    type: 'autods',
    apiKey: 'k',
    apiSecret: 's',
    baseUrl: 'https://api.autods.com',
    name: 'AutoDS'
  } as any)
  ;(axios.post as any).mockClear()
  ;(axios.get as any).mockClear()
})

it('calls AutoDS categories endpoint', async () => {
  ;(axios.post as any).mockResolvedValueOnce({ data: { categories: [] } })
  await supplierService.getCategories('1')
  expect((axios.post as any).mock.calls[0][0]).toContain('/providers/autods/categories')
})

it('creates order via AutoDS endpoint', async () => {
  ;(axios.post as any).mockResolvedValueOnce({ data: { success: true } })
  await supplierService.createOrder('1', { external_order_id: '1', shipping_address: {}, items: [] })
  expect((axios.post as any).mock.calls[0][0]).toContain('/providers/autods/orders')
})

it('checks order status via AutoDS endpoint', async () => {
  ;(axios.get as any).mockResolvedValueOnce({ data: { status: 'processing' } })
  await supplierService.getOrderStatus('1', '100')
  expect((axios.get as any).mock.calls[0][0]).toContain('/providers/autods/orders/100')
})
