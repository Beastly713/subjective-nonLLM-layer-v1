import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('serves accessible authentication through the production application', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByText('Account recovery is unavailable')).toBeVisible();

  const healthResponse = await page.request.get('/health/live');
  expect(healthResponse.ok()).toBe(true);
  await expect(healthResponse.json()).resolves.toEqual({ status: 'live' });

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);

  await page.setViewportSize({ width: 320, height: 720 });
  await page.reload();
  const horizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBe(false);
});
