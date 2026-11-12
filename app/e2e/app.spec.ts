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

test('marking a step done late moves the finish by the delay only', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  const finish = page.getByTestId('finish');
  const before = await finish.innerText();
  // the first step is hours in the future, so completing it "now" is early: oven time must hold
  await page.getByRole('button', { name: /להאכיל סטארטר/ }).click();
  await page.getByRole('button', { name: 'בוצע', exact: true }).click();
  await expect(finish).toHaveText(before);
});

test('whole wheat blend suggests more water and offers to take it', async ({ page }) => {
  await page.goto('/#/new');
  await expect(page.getByTestId('hydration')).toHaveText('72%');
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'פחות הידרציה' }).click();
  await page.getByRole('combobox', { name: 'קמח' }).selectOption({ label: '80% לבן, 20% מלא' });
  await expect(page.getByTestId('hydration-tip')).toContainText('מומלץ בערך 75%');
  await page.getByRole('button', { name: /קח את ההצעה/ }).click();
  await expect(page.getByTestId('hydration')).toHaveText('75%');
  await expect(page.getByText('מתאים לתערובת הזו')).toBeVisible();
});

test('picking a blend follows the suggestion only if hydration was comfortable', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('combobox', { name: 'קמח' }).selectOption({ label: '80% לבן, 20% מלא' });
  await expect(page.getByTestId('hydration')).toHaveText('75%');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'עוד הידרציה' }).click();
  await page.getByRole('combobox', { name: 'קמח' }).selectOption({ label: 'לבן' });
  await expect(page.getByTestId('hydration')).toHaveText('79%');
});

test('alarm changes reach the native alarm clock', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__ops = [];
    (window as any).SourdoughAlarms = { apply: (ops: unknown[]) => (window as any).__ops.push(...ops) };
  });
  await page.reload();
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  const count = () => page.evaluate(() => (window as any).__ops.length);
  expect(await count()).toBeGreaterThan(5);
  await page.evaluate(() => ((window as any).__ops.length = 0));
  await page.getByRole('button', { name: /לאפות: 240°/ }).click();
  await page.getByLabel('שעון מעורר לשלב הזה').click();
  const ops = await page.evaluate(() => (window as any).__ops);
  expect(ops).toHaveLength(1);
  expect(ops[0].op).toBe('cancel');
  await page.evaluate(() => ((window as any).__ops.length = 0));
  await page.getByRole('button', { name: /להאכיל סטארטר/ }).click();
  await page.getByRole('button', { name: '+30 דק\'' }).click();
  const moved = await page.evaluate(() => (window as any).__ops);
  expect(moved.length).toBeGreaterThan(3);
  expect(moved.every((o: any) => o.op === 'set')).toBe(true);
});
