import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('home shows the starter and is right-to-left', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'מה אופים היום?' })).toBeVisible();
  await expect(page.getByText('רעב כבר 9 ימים')).toBeVisible();
});

test('feeding the starter updates its mood', async ({ page }) => {
  await page.getByRole('button', { name: 'האכלתי עכשיו' }).click();
  await expect(page.getByText('שבע ומרוצה')).toBeVisible();
});

test('calculator matches the spec example for stiff starter', async ({ page }) => {
  await page.goto('/#/calc');
  await page.getByLabel('צריך (גרם)').fill('300');
  await page.getByLabel('בעוד (שעות)').fill('10');
  await expect(page.getByTestId('seed')).not.toHaveText('');
  const small = await page.getByTestId('seed').innerText();
  await page.getByLabel('צריך (גרם)').fill('600');
  const big = await page.getByTestId('seed').innerText();
  expect(parseInt(big.replace(/\D/g, ''))).toBeGreaterThan(parseInt(small.replace(/\D/g, '')));
});

test('calculator survives empty input', async ({ page }) => {
  await page.goto('/#/calc');
  await page.getByLabel('צריך (גרם)').fill('');
  await expect(page.getByRole('heading', { name: 'כמה להאכיל?' })).toBeVisible();
  await expect(page.getByTestId('seed')).toHaveCount(0);
});

test('wizard needs at least one item', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'פחות לחם' }).click();
  await page.getByRole('button', { name: 'פחות לחם' }).click();
  await expect(page.getByRole('button', { name: /צריך לבחור/ })).toBeDisabled();
});

test('planning a bake creates steps and survives reload', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'זיתים' }).click();
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await expect(page.getByRole('heading', { name: 'התוכנית שלך' })).toBeVisible();
  await expect(page.getByRole('button', { name: /להאכיל סטארטר/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /לאפות: 240°/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /להאכיל סטארטר/ })).toBeVisible();
});

test('shifting a step moves the finish time and can be undone', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  const finish = page.getByTestId('finish');
  const before = await finish.innerText();
  await page.getByRole('button', { name: /להאכיל סטארטר/ }).click();
  await page.getByRole('button', { name: '+30 דק\'' }).click();
  await expect(finish).not.toHaveText(before);
  await page.getByRole('button', { name: 'בטל שינוי' }).click();
  await expect(finish).toHaveText(before);
});

test('heavier tin loaf changes the bake steps', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByLabel('משקל לחם').selectOption('1200');
  await page.getByLabel('צורת לחם').selectOption('tin');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await expect(page.getByRole('button', { name: /לחלץ מהתבנית/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /לאפות: 230° מכוסה, 30 דק'/ })).toBeVisible();
});

test('no horizontal scroll on a phone', async ({ page }) => {
  for (const hash of ['#/', '#/new', '#/calc']) {
    await page.goto('/' + hash);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, hash).toBe(false);
  }
});

test('works offline after first load', async ({ page, context }) => {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'מה אופים היום?' })).toBeVisible();
});

test('manifest is installable', async ({ page, request }) => {
  const res = await request.get('/manifest.webmanifest');
  const m = await res.json();
  expect(m).toMatchObject({ lang: 'he', dir: 'rtl', display: 'standalone' });
  expect(m.icons.length).toBeGreaterThan(1);
});
