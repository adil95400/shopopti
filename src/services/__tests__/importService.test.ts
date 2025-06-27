import { describe, it, expect, vi, beforeEach } from 'vitest'

var generateVariantsMock: any
var optimizeProductMock: any
var optimizeForSEOMock: any
vi.mock('../aiService', () => {
  generateVariantsMock = vi.fn()
  optimizeProductMock = vi.fn()
  optimizeForSEOMock = vi.fn()
  return {
    aiService: {
      generateVariants: generateVariantsMock,
      optimizeProduct: optimizeProductMock,
      optimizeForSEO: optimizeForSEOMock
    }
  }
})

var getSupplierByIdMock: any
var getProductsByIdsMock: any
vi.mock('../supplierService', () => {
  getSupplierByIdMock = vi.fn()
  getProductsByIdsMock = vi.fn()
  return {
    supplierService: {
      getSupplierById: getSupplierByIdMock,
      getProductsByIds: getProductsByIdsMock
    }
  }
})

var insertMock: any
vi.mock('../../lib/supabase', () => {
  insertMock = vi.fn().mockResolvedValue({ error: null })
  return {
    supabase: { from: () => ({ insert: insertMock }) }
  }
})

import { importService } from '../importService'

beforeEach(() => {
  vi.clearAllMocks()
})

it('calls generateVariants when supplier products lack variants', async () => {
  getSupplierByIdMock.mockResolvedValue({ type: 'test' })
  getProductsByIdsMock.mockResolvedValue([
    { id: '1', name: 'Prod', description: 'desc', price: 5, images: [], sku: '1', stock: 10, category: 'cat', variants: undefined }
  ])
  optimizeProductMock.mockResolvedValue({ title: 'Opt', description_html: 'desc', tags: [] })
  optimizeForSEOMock.mockResolvedValue({ title: 'Opt', description: 'desc', keywords: [], metaTitle: '', metaDescription: '' })
  generateVariantsMock.mockResolvedValue([{ title: 'v1', options: { color: 'red' } }])

  const result = await importService.importFromSupplier('sup', ['1'])

  expect(generateVariantsMock).toHaveBeenCalled()
  expect(result[0].variants).toEqual([{ title: 'v1', options: { color: 'red' } }])
  expect(insertMock).toHaveBeenCalled()
})
