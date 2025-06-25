import { test, expect } from '@playwright/test';
import path from 'path';
import { pathToFileURL } from 'url';

test('homepage loads', async ({ page }) => {
  const url = pathToFileURL(path.resolve(__dirname, '../../index.html')).href;
  await page.goto(url);
  await expect(page).toHaveTitle(/Shopopti/);
});
