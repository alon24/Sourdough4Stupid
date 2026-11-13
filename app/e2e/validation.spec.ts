import { expect, test } from '@playwright/test';

/** move the new-bake wizard to a step (it does nothing when the wizard is not open) */
async function goStep(page: import('@playwright/test').Page, n: number) {
  const ind = page.getByTestId('wizard-step');
  for (let i = 0; i < 6; i++) {
    if (i === 0) await ind.waitFor({ timeout: 400 }).catch(() => undefined);
    if ((await ind.count()) === 0) return;
    const text = await ind.textContent({ timeout: 1000 }).catch(() => null);
    if (text === null) return;
    const cur = Number(/שלב (\d)/.exec(text)?.[1]);
    if (cur === n) return;
    await page.getByRole('button', { name: cur < n ? /^הבא/ : 'הקודם' }).first().click();
  }
}


/** the new-bake wizard has four steps: walk to the last one */
async function toLastStep(page: import('@playwright/test').Page) {
  const next = page.getByRole('button', { name: /^הבא/ });
  for (let i = 0; i < 3 && (await next.count()) > 0; i++) await next.click();
}
async function startBake(page: import('@playwright/test').Page) {
  await toLastStep(page);
  await goStep(page, 4);
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
}


const SHOTS = process.env.SHOTS_DIR ?? '/tmp/shots';
const shot = (page: import('@playwright/test').Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const close = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'סגור' }).click({ position: { x: 5, y: 5 } });

test('walkthrough with screenshots: the reference bake end to end on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await shot(page, '01-home');

  // starter status
  await page.getByRole('link', { name: /בוא נגדיר|עדכון מצב הסטארטר/ }).click();
  await page.getByRole('button', { name: 'קשה (50%)' }).click();
  await page.getByRole('button', { name: 'במקרר' }).click();
  await page.getByRole('button', { name: 'שבועיים' }).click();
  await page.getByRole('button', { name: '30', exact: true }).click();
  await shot(page, '02-starter-status');
  await page.getByRole('button', { name: 'שמור ובחזרה לבית' }).click();

  // wizard, starter mode
  await page.goto('/#/new');
  await goStep(page, 4);
  await page.getByLabel('כמה סטארטר לשים בבצק (גרם)').fill('300');
  await goStep(page, 4);
  await page.getByLabel('יש לי עכשיו (גרם)').fill('32');
  await goStep(page, 1);
  await page.getByRole('combobox', { name: 'משקל לחם' }).selectOption('1000');
  await goStep(page, 1);
  await page.getByRole('button', { name: 'עוד לחם' }).click();
  await goStep(page, 1);
  await page.getByRole('button', { name: '+ לחמניות' }).click();
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'עוד לחמניות' }).click();
  await goStep(page, 4);
  await page.getByText('האכלה אחת ללילה').click();
  await goStep(page, 3);
  await page.getByRole('button', { name: /הכול יחד/ }).click();
  await page.getByRole('combobox', { name: 'העשרת הלחמניות' }).selectOption('oil');
  // own flour mix goes into the dropdown
  await goStep(page, 3);
  await page.getByRole('button', { name: 'הרכב קמחים משלי' }).click();
  await page.getByLabel('שם לתמהיל').fill('לבן וטיפו');
  await page.getByRole('button', { name: 'שמור תמהיל' }).click();
  await expect(page.locator('label.field', { hasText: /^קמח/ }).locator('select').first().locator('option:checked')).toHaveText('לבן וטיפו');
  await shot(page, '03-wizard');
  await goStep(page, 4);
  const feed = page.getByRole('button', { name: /צריך להגדיל את הסטארטר/ });
  if (await feed.count()) { await feed.click(); await page.getByRole('button', { name: 'אישור, ממשיכים לתוכנית' }).click(); } else await startBake(page);

  // plan
  await expect(page.getByTestId('split')).toContainText('2 כיכרות × 1000');
  await shot(page, '04-plan');
  const open = async (name: RegExp, shotName: string, must: string[]) => {
    await page.getByRole('button', { name }).first().click();
    for (const t of must) await expect(page.getByRole('dialog')).toContainText(t);
    await shot(page, shotName);
    await close(page);
  };
  await open(/להאכיל סטארטר/, '05-feed', ["32 ג' סטארטר", '199', '99', 'X עמוק', '30 ג']);
  await open(/לערבב הכול יחד/, '06-mix-all-in', ["6–8"]);
  await open(/לחלק: כיכרות ולחמניות/, '07-split', ['50%–60%', '2 כיכרות × 1000', '7 לחמניות', 'עיצוב סופי']);
  await open(/להעשיר את הלחמניות/, '08-enrich', ['שמן זית', 'הכיכרות נשארות רזות']);
  await open(/לעצב 7 לחמניות/, '09-shape-rolls', ['כדורים מתוחים', 'בלי קמח', 'נייר אפייה', '1.5–2 שעות', 'מקרר']);
  await open(/לאפות לחמניות/, '10-bake-rolls', ['230', '12', '210', 'שומשום']);

  // autolyse on in the running bake
  await goStep(page, 3);
  await page.getByRole('button', { name: 'להוסיף אוטוליזה' }).click();
  await goStep(page, 3);
  await expect(page.getByRole('button', { name: /אוטוליזה: קמח ומים/ })).toHaveCount(1);

  // resume at the last fold
  await goStep(page, 3);
  await page.getByRole('button', { name: /קיפול 4 מתוך 4/ }).click();
  await page.getByRole('button', { name: 'אני כאן עכשיו' }).click();
  await shot(page, '11-after-resume');

  // recipes: save, export, import, download page
  await page.goto('/#/recipe');
  await page.getByLabel('שם המתכון').fill('בדיקה');
  await page.getByRole('button', { name: 'שמור מתכון' }).click();
  await shot(page, '12-recipes');
  await page.goto('/#/app');
  await shot(page, '13-download');
  await expect(page.getByTestId('apk-link')).toHaveAttribute('href', /machmetzet\.apk$/);
});
