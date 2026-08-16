import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('serves the accessible foundation through the production application', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'A calm, precise foundation for care' }),
  ).toBeVisible();
  await expect(page.getByText('Non-live demonstration')).toBeVisible();

  await page.getByRole('button', { name: 'Open confirmation example' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Confirm the reference action?',
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm example' }).click();
  await expect(dialog).toBeHidden();

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
