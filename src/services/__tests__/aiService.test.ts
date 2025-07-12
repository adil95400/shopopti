import { describe, it, expect, vi } from 'vitest'

var createMock: any
vi.mock('openai', () => {
  createMock = vi.fn()
  return {
    default: class {
      chat = { completions: { create: createMock } }
    }
  }
})

import { aiService } from '../aiService'

it('parses variant suggestions from OpenAI', async () => {
  createMock.mockResolvedValue({ choices: [{ message: { content: '[{"title":"Variant A","options":{"size":"S"}}]' } }] })
  const result = await aiService.generateVariants({ title: 'Test Product' })
  expect(result).toEqual([{ title: 'Variant A', options: { size: 'S' } }])
})
