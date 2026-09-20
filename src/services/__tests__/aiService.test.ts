import { beforeEach, expect, it, vi } from 'vitest'

const invokeMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}))

beforeEach(() => {
  invokeMock.mockReset()
})

it('routes variant generation through the authenticated ai-hub function', async () => {
  invokeMock.mockResolvedValue({
    data: { data: [{ title: 'Variant A', options: { size: 'S' } }] },
    error: null,
  })

  const { aiService } = await import('../aiService')
  const result = await aiService.generateVariants({ title: 'Test Product' })

  expect(invokeMock).toHaveBeenCalledWith('ai-hub', {
    body: {
      action: 'generateVariants',
      payload: {
        title: 'Test Product',
        description: undefined,
        category: undefined,
        attributes: undefined,
      },
      bypassCache: false,
    },
  })
  expect(result).toEqual([{ title: 'Variant A', options: { size: 'S' } }])
})

it('passes explicit cache bypass for user-requested regeneration', async () => {
  invokeMock.mockResolvedValue({
    data: {
      data: {
        title: 'Fresh title',
        description_html: 'Fresh description',
        tags: [],
        seo: { metaTitle: 'Fresh title', metaDescription: '', keywords: [] },
      },
    },
    error: null,
  })

  const { aiService } = await import('../aiService')
  await aiService.optimizeProduct(
    { name: 'Product', description: 'Description', category: 'Category' },
    { bypassCache: true }
  )

  expect(invokeMock).toHaveBeenLastCalledWith('ai-hub', {
    body: {
      action: 'optimizeProduct',
      payload: { name: 'Product', description: 'Description', category: 'Category' },
      bypassCache: true,
    },
  })
})

it('fails closed when the ai-hub response is invalid', async () => {
  invokeMock.mockResolvedValue({ data: null, error: null })

  const { aiService } = await import('../aiService')

  await expect(
    aiService.optimizeProduct({
      name: 'Product',
      description: 'Description',
      category: 'Category',
    })
  ).rejects.toThrow('Invalid AI response')
})
