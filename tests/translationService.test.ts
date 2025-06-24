import { it, expect, vi } from 'vitest';

const createMock = vi.fn().mockResolvedValue({ choices: [{ message: { content: 'Salut' } }] });
const clientMock = { chat: { completions: { create: createMock } } } as any;

import { translationService } from '../src/services/translationService';

translationService.setClient(clientMock);

it('translate uses OpenAI API', async () => {
  const result = await translationService.translate('Hello', 'fr');
  expect(result).toBe('Salut');
  expect(createMock).toHaveBeenCalled();
});
