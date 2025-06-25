beforeEach(() => {
  jest.resetModules();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

test('returns result from API', async () => {
  const { askChatGPT } = await import('../openai');
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ result: 'hello' })
  });

  const result = await askChatGPT('hi');
  expect(result).toBe('hello');
});

test('throws error on 429', async () => {
  const { askChatGPT } = await import('../openai');
  (fetch as jest.Mock).mockResolvedValue({
    ok: false,
    status: 429,
    json: () => Promise.resolve({ error: 'Too many requests' })
  });

  await expect(askChatGPT('hi')).rejects.toThrow(/temporairement indisponible/);
});
