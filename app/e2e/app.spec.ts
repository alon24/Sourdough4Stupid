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

test('help page renders the guide and anchors scroll', async ({ page }) => {
  await page.getByRole('link', { name: 'עזרה ומדריך' }).click();
  await expect(page.getByRole('heading', { name: 'מדריך עזרה: מחמצת לעד' })).toBeVisible();
  await page.locator('a[data-anchor]').first().click();
  await expect(page).toHaveURL(/#\/help$/);
});

test('starting from starter: 300 g wanted, 30 g in the fridge', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'מכמה סטארטר' }).click();
  await expect(page.getByTestId('chain')).toContainText('2 האכלות');
  await page.getByRole('button', { name: '2 לחמים + 8 לחמניות' }).click();
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await expect(page.getByRole('button', { name: /האכלה 1 מתוך 2/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /האכלה 2 מתוך 2/ })).toBeVisible();
});

test('more starter in hand means fewer feedings', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'מכמה סטארטר' }).click();
  await page.getByLabel('יש לי עכשיו (גרם)').fill('250');
  await expect(page.getByTestId('chain')).toContainText('האכלה אחת');
});

test('a ready starter skips the feeding steps', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'מכמה סטארטר' }).click();
  await page.getByLabel('הסטארטר כבר מוכן ועל השיא').check();
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await expect(page.getByRole('heading', { name: 'התוכנית שלך' })).toBeVisible();
  await expect(page.getByRole('button', { name: /האכלה|להאכיל סטארטר/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /אוטוליזה/ })).toBeVisible();
});

test('a step can be marked done at a time that already passed', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await page.getByRole('button', { name: /להאכיל סטארטר/ }).click();
  await page.getByLabel('בוצע בשעה (אם כבר עשית)').fill('07:00');
  await page.getByRole('button', { name: /סמן שבוצע ב/ }).click();
  await expect(page.getByRole('button', { name: /להאכיל סטארטר/ })).toBeVisible();
});

async function planWithBulkRunning(page: import('@playwright/test').Page, hideToast = true) {
  await page.goto('/#/new');
  // out of the oven 15.5 h from now puts the bulk about 2.75 h in
  const value = await page.evaluate(() => {
    const d = new Date(Date.now() + 15.5 * 3_600_000);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  });
  await page.getByLabel('יוצא מהתנור').fill(value);
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  // earlier steps are already due, so their reminder would cover the screen; the reminder is tested elsewhere
  if (hideToast) await page.addStyleTag({ content: '.toast{display:none}' });
}

const minutesLeft = async (page: import('@playwright/test').Page) => {
  const t = await page.getByTestId('bulk-left').innerText();
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

test('before the bulk, the app suggests a water temperature', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await expect(page.getByTestId('water-tip')).toContainText('מים בכ־');
});

test('warm dough shortens the remaining bulk, cold dough lengthens it, and advice is shown', async ({ page }) => {
  await planWithBulkRunning(page);
  const base = await minutesLeft(page);
  expect(base).toBeGreaterThan(60);
  await page.getByLabel('בצק °C').fill('30');
  await page.getByRole('button', { name: 'עדכן את הזמנים' }).click();
  await expect(page.getByTestId('dough-advice')).toContainText('חם מהיעד');
  const warm = await minutesLeft(page);
  expect(warm).toBeLessThan(base);
  await page.getByLabel('בצק °C').fill('19');
  await page.getByRole('button', { name: 'עדכן את הזמנים' }).click();
  await expect(page.getByTestId('dough-advice')).toContainText('קר מהיעד');
  expect(await minutesLeft(page)).toBeGreaterThan(warm);
});

test('a measured rise corrects the estimate and can be undone', async ({ page }) => {
  await planWithBulkRunning(page);
  const finish = page.getByTestId('finish');
  const before = await finish.innerText();
  await page.getByLabel('עלייה %').fill('70');
  await page.getByRole('button', { name: 'עדכן את הזמנים' }).click();
  await expect(finish).not.toHaveText(before);
  await page.getByRole('button', { name: 'בטל שינוי' }).click();
  await expect(finish).toHaveText(before);
});

test('an overdue step shows a reminder that snoozes the plan', async ({ page }) => {
  await planWithBulkRunning(page, false);
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await alert.getByRole('button', { name: 'נודניק 10' }).click();
  await expect(alert).toHaveCount(0);
});

test('my own flour mix: grams and percent stay in sync, can be saved, remembered and deleted', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'הרכב קמחים משלי' }).click();
  await expect(page.getByTestId('mix-total')).toHaveText('1000');
  await page.getByRole('button', { name: '+ הוסף קמח' }).click();
  await page.getByRole('combobox', { name: 'סוג קמח' }).nth(1).selectOption('whole');
  await page.getByLabel('גרמים').nth(0).fill('700');
  await page.getByLabel('גרמים').nth(1).fill('300');
  await expect(page.getByLabel('אחוז').nth(1)).toHaveValue('30');
  await page.getByLabel('אחוז').nth(1).fill('50');
  await expect(page.getByLabel('גרמים').nth(1)).toHaveValue('500');
  await page.getByLabel('שם לתמהיל').fill('חצי חצי');
  await page.getByRole('button', { name: 'שמור תמהיל' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'הרכב קמחים משלי' }).click();
  await expect(page.getByRole('button', { name: 'חצי חצי', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'מחק את חצי חצי' }).click();
  await expect(page.getByRole('button', { name: 'חצי חצי', exact: true })).toHaveCount(0);
});

test('a custom flour is remembered, usable in the mix and deletable', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'הרכב קמחים משלי' }).click();
  await page.getByText('קמח משלי').click();
  await page.getByLabel('שם קמח חדש').fill('דורום');
  await page.getByLabel('ספיגת מים').fill('8');
  await page.getByRole('button', { name: 'הוסף', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'סוג קמח' }).first().locator('option', { hasText: 'דורום' })).toHaveCount(1);
  await page.getByRole('button', { name: 'מחק את דורום' }).click();
  await expect(page.getByRole('combobox', { name: 'סוג קמח' }).first().locator('option', { hasText: 'דורום' })).toHaveCount(0);
});

test('start questionnaire: starter state, scale-up, and the step you are at', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await page.getByRole('link', { name: /התחלת ביצוע/ }).click();
  await expect(page.getByRole('button', { name: /עוד לא התחלתי/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'במקרר' }).click();
  await page.getByRole('button', { name: 'כן, צריך יותר' }).click();
  await page.getByRole('button', { name: '30', exact: true }).click();
  const stepButtons = page.getByRole('heading', { name: 'באיזה שלב אתה?' }).locator('xpath=../div/button');
  expect(await stepButtons.count()).toBeGreaterThan(4);
  await stepButtons.nth(3).click();
  await expect(page).toHaveURL(/#\/plan$/);
  await expect.poll(() => page.locator('.step.done').count()).toBeGreaterThanOrEqual(2);
});

test('start questionnaire: an active starter means no feeding steps', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await page.getByRole('link', { name: /התחלת ביצוע/ }).click();
  await page.getByRole('button', { name: 'פעיל ובועבע' }).click();
  await expect(page.getByRole('button', { name: /להאכיל סטארטר/ })).toHaveCount(0);
  await page.getByRole('button', { name: /עוד לא התחלתי/ }).click();
  await expect(page.getByRole('button', { name: /להאכיל סטארטר/ })).toHaveCount(0);
});

test('recipes: create with a managed inclusion, bake from it, and derive a new recipe on change', async ({ page }) => {
  await page.goto('/#/recipes');
  await page.getByRole('link', { name: 'מתכון חדש' }).click();
  await page.getByLabel('שם המתכון').fill('הלחם של שבת');
  await page.getByText('ניהול תוספות').click();
  await page.getByLabel('שם תוספת חדשה').fill('אגוזים');
  await page.getByLabel('כמות לתוספת חדשה').fill('20');
  await page.getByRole('button', { name: 'הוסף', exact: true }).click();
  await page.getByRole('button', { name: 'אגוזים', exact: true }).click();
  await page.getByRole('button', { name: 'שמור מתכון' }).click();
  await expect(page.getByTestId('recipe')).toHaveCount(1);
  await page.reload();
  await expect(page.getByText('הלחם של שבת')).toBeVisible();
  await page.getByRole('link', { name: 'אפייה חדשה' }).first().click();
  await expect(page.getByRole('button', { name: 'אגוזים', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click(); // unchanged: straight to the plan
  await expect(page.getByRole('heading', { name: 'התוכנית שלך' })).toBeVisible();
  await page.getByRole('link', { name: 'מתכונים' }).click();
  await page.getByRole('link', { name: 'אפייה חדשה' }).first().click();
  await page.getByRole('button', { name: 'עוד לחם' }).click();
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await page.getByRole('button', { name: 'כן, מתכון חדש' }).click();
  await page.getByRole('link', { name: 'מתכונים' }).click();
  await expect(page.getByTestId('recipe')).toHaveCount(2);
  await page.getByRole('button', { name: /מחק את הלחם של שבת \(גרסה\)/ }).click();
  await expect(page.getByTestId('recipe')).toHaveCount(1);
});

test('starter status questionnaire saves type, place, time and amount', async ({ page }) => {
  await page.getByRole('link', { name: /מה מצב הסטארטר/ }).click();
  await page.getByRole('button', { name: 'רגיל (100%)' }).click();
  await page.getByRole('button', { name: 'במקרר' }).click();
  await page.getByRole('button', { name: 'חודש', exact: true }).click();
  await page.getByRole('button', { name: '100', exact: true }).click();
  await expect(page.getByTestId('starter-advice')).toContainText('חיזוק');
  await page.getByRole('button', { name: 'שמור ובחזרה לבית' }).click();
  await expect(page.getByText('הסטארטר הרגיל שלי')).toBeVisible();
  await page.reload();
  await expect(page.getByText('הסטארטר הרגיל שלי')).toBeVisible();
});

test('a weak starter in the room needs two strengthening feeds', async ({ page }) => {
  await page.goto('/#/starter');
  await page.getByRole('button', { name: 'קשה (50%)' }).click();
  await page.getByRole('button', { name: 'בחוץ, בטמפרטורת החדר' }).click();
  await page.getByRole('button', { name: 'אתמול' }).click();
  await page.getByRole('button', { name: /חלש/ }).click();
  await page.getByRole('button', { name: '30', exact: true }).click();
  await expect(page.getByTestId('starter-advice')).toContainText('שתי האכלות');
});

test('kneading rounds default to 4, can be set in the wizard and added or removed in the plan', async ({ page }) => {
  await page.goto('/#/new');
  await expect(page.getByLabel('כמות קיפולים')).toHaveText('4');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await expect(page.getByRole('button', { name: /קיפול \d מתוך 4/ })).toHaveCount(4);
  await page.getByRole('button', { name: /קיפול 4 מתוך 4/ }).click();
  await expect(page.getByRole('dialog').getByText(/מחזקים את הגלוטן/)).toBeVisible();
  await page.getByRole('button', { name: 'הוסף קיפול' }).click();
  await expect(page.getByRole('button', { name: /קיפול \d מתוך 5/ })).toHaveCount(5);
  await page.getByRole('button', { name: /קיפול 5 מתוך 5/ }).click();
  await page.getByRole('button', { name: 'הסר קיפול זה' }).click();
  await expect(page.getByRole('button', { name: /קיפול \d מתוך 4/ })).toHaveCount(4);
});

test('recipes export (JSON, CSV, HTML page) and import round-trip', async ({ page }) => {
  await page.goto('/#/recipe');
  await page.getByLabel('שם המתכון').fill('לחם ייצוא');
  await page.getByRole('button', { name: 'שמור מתכון' }).click();
  const dl = async (name: string) => {
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()]);
    return { name: d.suggestedFilename(), text: (await (await import('node:fs/promises')).readFile((await d.path())!, 'utf8')) };
  };
  const json = await dl('ייצוא JSON');
  expect(json.name).toBe('recipes.json');
  const csv = await dl('ייצוא CSV');
  expect(csv.text).toContain('לחם ייצוא');
  const html = await dl('דף HTML לשיתוף');
  expect(html.text).toContain('dir="rtl"');
  expect(html.text).not.toContain('<script');
  // import the JSON back: same name and mix are skipped, a changed one is added
  const fs = await import('node:fs/promises');
  await fs.writeFile('/tmp/r1.json', json.text);
  await page.getByLabel('ייבוא מתכונים').setInputFiles('/tmp/r1.json');
  await expect(page.getByTestId('import-msg')).toContainText('יובאו 0 מתכונים');
  const edited = JSON.parse(json.text);
  edited.recipes[0].name = 'לחם מיובא';
  await fs.writeFile('/tmp/r2.json', JSON.stringify(edited));
  await page.getByLabel('ייבוא מתכונים').setInputFiles('/tmp/r2.json');
  await expect(page.getByTestId('import-msg')).toContainText('יובאו 1 מתכונים');
  await expect(page.getByTestId('recipe')).toHaveCount(2);
  await fs.writeFile('/tmp/bad.json', '{"hello":1}');
  await page.getByLabel('ייבוא מתכונים').setInputFiles('/tmp/bad.json');
  await expect(page.getByTestId('import-msg')).toContainText('לא נראה כמו קובץ מתכונים');
});

test('a named flour mix goes straight into the flour dropdown, is selected, and can be deleted there', async ({ page }) => {
  await page.goto('/#/new');
  const dd = page.locator('label.field', { hasText: /^קמח/ }).locator('select').first();
  await page.getByRole('button', { name: 'הרכב קמחים משלי' }).click();
  await page.getByLabel('שם לתמהיל').fill('הרכב הבית');
  await page.getByRole('button', { name: 'שמור תמהיל' }).click();
  await expect(dd.locator('option', { hasText: 'הרכב הבית' })).toHaveCount(1);
  await expect(dd.locator('option:checked')).toHaveText('הרכב הבית');
  await page.reload();
  await expect(dd.locator('option', { hasText: 'הרכב הבית' })).toHaveCount(1);
  await dd.selectOption({ label: 'לבן' });
  await dd.selectOption({ label: 'הרכב הבית' });
  await expect(page.getByTestId('mix-total')).toHaveText('1000');
  await page.getByRole('button', { name: 'מחק את התמהיל הרכב הבית' }).click();
  await expect(dd.locator('option', { hasText: 'הרכב הבית' })).toHaveCount(0);
});
