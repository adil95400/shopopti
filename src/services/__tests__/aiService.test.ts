import { describe, it, expect, vi } from 'vitest';
import { aiService, openai } from '../aiService';

// Helper to mock openai response
function mockOpenAIResponse(content: string) {
  vi.spyOn(openai.chat.completions, 'create').mockResolvedValue({
    choices: [{ message: { content } }]
  } as any);
}

describe('aiService.generateVariants', () => {
  it('parses JSON from OpenAI', async () => {
    const mockVariants = '[{"title":"Red","options":{"color":"Red"}}]';
    mockOpenAIResponse(mockVariants);
    const result = await aiService.generateVariants({ title: 'Shirt', attributes: { color: ['Red'] } });
    expect(result).toEqual([{ title: 'Red', options: { color: 'Red' } }]);
  });
});
