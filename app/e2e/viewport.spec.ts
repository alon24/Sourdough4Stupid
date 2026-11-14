import { expect, test } from '@playwright/test';

const ROUTES = ['#/', '#/more', '#/log', '#/plan', '#/new', '#/recipes', '#/recipe', '#/calc', '#/help', '#/app', '#/starter', '#/start'];
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];

for (const size of SIZES) {
  for (const route of ROUTES) {
    test(`fits ${size.width}x${size.height}: ${route}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.goto(`/${route}`);
      await page.reload();
      // open the editors that hide wide rows
      if (route === '#/new' || route === '#/recipe') {
        if (route === '#/new') await page.getByRole('button', { name: '+ לחם כפרי', exact: true }).click();
        if (route === '#/new') for (let i = 0; i < 2; i++) await page.getByRole('button', { name: /^הבא/ }).click();
        if (route === '#/new') await page.getByRole('button', { name: 'ערוך קמחים' }).click();
        await page.getByRole('button', { name: 'הרכב קמחים משלי' }).click();
        await page.getByText('ניהול תוספות').click();
        await page.getByText('קמח משלי').click();
      }
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
        wide: [...document.querySelectorAll('main *')].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1);
        }).slice(0, 5).map((e) => `${e.tagName}.${e.className}:${(e.textContent ?? '').slice(0, 20)}`),
        small: [...document.querySelectorAll('main button, main a.btn, main input:not([type=checkbox]), main select, .tabs a')].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 2 && r.height > 2 && (r.height < 44 || r.width < 44) && !e.closest('summary');
        }).slice(0, 6).map((e) => `${e.tagName}:${(e.getAttribute('aria-label') ?? e.textContent ?? '').slice(0, 18)}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`),
      }));
      expect(m.sw, `horizontal overflow ${JSON.stringify(m.wide)}`).toBeLessThanOrEqual(m.iw);
      expect(m.wide, 'elements outside the viewport').toEqual([]);
      expect(m.small, 'touch targets under 44px').toEqual([]);
    });
  }
}

test('button labels are vertically centered on every screen', async ({ page }) => {
  await page.goto('/#/recipe');
  await page.getByRole('button', { name: '+ לחם כפרי', exact: true }).click();
  await page.getByLabel('שם המתכון').fill('בדיקה');
  await page.getByRole('button', { name: 'שמור מתכון' }).click();
  for (const r of ['recipes', '', 'plan', 'start', 'starter', 'calc', 'app']) {
    await page.goto('/#/' + r);
    const off = await page.evaluate(() =>
      [...document.querySelectorAll('.btn')].filter((e) => (e as HTMLElement).offsetParent).map((e) => {
        const rg = document.createRange(); rg.selectNodeContents(e);
        const t = rg.getBoundingClientRect(), b = e.getBoundingClientRect();
        return Math.abs((t.top + t.bottom) / 2 - (b.top + b.bottom) / 2) > 3 ? e.textContent : null;
      }).filter(Boolean));
    expect(off, r).toEqual([]);
  }
});
