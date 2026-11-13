import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('home shows the starter and is right-to-left', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'מה אופים היום?' })).toBeVisible();
  await expect(page.getByTestId('starter-ask')).toBeVisible();
});

test('feeding the starter updates its mood', async ({ page }) => {
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('machmetzet.v1') ?? '{}');
    st.starter = { name: 'הסטארטר הקשה שלי', type: 'stiff', hydration: 0.5, lastFedAt: Date.now() - 9 * 86_400_000, inFridge: true, known: true };
    localStorage.setItem('machmetzet.v1', JSON.stringify(st));
  });
  await page.reload();
  await expect(page.getByText('הואכל לפני 9 ימים')).toBeVisible();
  await page.getByRole('button', { name: 'האכלתי עכשיו' }).click();
  await expect(page.getByText('הואכל היום')).toBeVisible();
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
  await expect(page.getByRole('button', { name: /צריך לבחור/ })).toBeDisabled();
});

test('planning a bake creates steps and survives reload', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'זיתים' }).click();
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await expect(page.getByRole('heading', { name: 'התוכנית שלך' })).toBeVisible();
  await expect(page.getByRole('button', { name: /להאכיל סטארטר/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /לאפות: 240°/ }).first()).toBeVisible();
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
  await expect(page.getByRole('button', { name: /לחלץ מהתבנית/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /לאפות: 230° מכוסה, 30 דק'/ }).first()).toBeVisible();
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
  await page.getByRole('button', { name: /לאפות: 240°/ }).first().click();
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
  await page.getByLabel('כמה סטארטר לשים בבצק (גרם)').fill('300');
  await page.getByLabel('יש לי עכשיו (גרם)').fill('30');
  await expect(page.getByTestId('chain')).toContainText('2 האכלות');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await expect(page.getByRole('button', { name: /האכלה 1 מתוך 2/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /האכלה 2 מתוך 2/ })).toBeVisible();
});

test('more starter in hand means fewer feedings', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByLabel('כמה סטארטר לשים בבצק (גרם)').fill('300');
  await page.getByLabel('יש לי עכשיו (גרם)').fill('250');
  await expect(page.getByTestId('chain')).toContainText('האכלה אחת');
});

test('a ready starter skips the feeding steps', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByLabel('הסטארטר כבר מוכן ועל השיא').check();
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await expect(page.getByRole('heading', { name: 'התוכנית שלך' })).toBeVisible();
  await expect(page.getByRole('button', { name: /האכלה|להאכיל סטארטר/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /אוטוליזה: קמח ומים/ })).toBeVisible();
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
  await expect(page.getByLabel('אחוז', { exact: true }).nth(1)).toHaveValue('30');
  await page.getByLabel('אחוז', { exact: true }).nth(1).fill('50');
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
  await page.getByTestId('recipe').filter({ hasText: 'הלחם של שבת (גרסה)' }).locator('summary').click();
  await page.getByRole('button', { name: /מחק את הלחם של שבת \(גרסה\)/ }).click();
  await page.getByRole('button', { name: /אישור מחיקה/ }).click();
  await expect(page.getByTestId('recipe')).toHaveCount(1);
});

test('starter status questionnaire saves type, place, time and amount', async ({ page }) => {
  await page.getByRole('link', { name: /בוא נגדיר|עדכון מצב הסטארטר/ }).click();
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
  await page.goto('/#/recipes');
  await page.getByText('ייבוא וייצוא').click();
  await page.getByTestId('recipe').locator('summary').click();
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

test('apk link is a plain download link, the service worker leaves .apk alone, and install steps are shown', async ({ page, request }) => {
  await page.goto('/#/app');
  const link = page.getByTestId('apk-link');
  await expect(link).toHaveAttribute('download', 'machmetzet.apk');
  await expect(link).toHaveAttribute('href', /machmetzet\.apk$/);
  await expect(page.getByTestId('qr').locator('svg path')).toHaveCount(1);
  await expect(page.getByText('איך מתקינים')).toBeVisible();
  await page.goto('/#/');
  await page.getByRole('link', { name: 'הורדת אפליקציית אנדרואיד' }).click();
  await expect(page.getByRole('heading', { name: 'האפליקציה לאנדרואיד' })).toBeVisible();
  const sw = await (await request.get('/sw.js')).text();
  expect(sw).toMatch(/denylist:\[\/\\\.apk\$\/\]/);
});

test('reference bake: 32 g stiff, 300 g tomorrow, 2 loaves of 1 kg + rolls, split and enrichment shown', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByLabel('כמה סטארטר לשים בבצק (גרם)').fill('300');
  await page.getByLabel('יש לי עכשיו (גרם)').fill('32');
  await page.getByRole('combobox', { name: 'משקל לחם' }).selectOption('1000');
  await page.getByRole('button', { name: 'עוד לחם' }).click();
  await page.getByRole('button', { name: '+ לחמניות' }).click();
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'עוד לחמניות' }).click();
  await page.getByText('האכלה אחת ללילה').click();
  await expect(page.getByTestId('chain')).toContainText('האכלה אחת');
  await page.getByRole('button', { name: /הכול יחד/ }).click();
  await page.getByRole('combobox', { name: 'העשרת הלחמניות' }).selectOption('oil');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await expect(page.getByTestId('split')).toContainText('2 כיכרות × 1000');
  await expect(page.getByTestId('split')).toContainText('7 לחמניות');
  await page.getByRole('button', { name: /להאכיל סטארטר/ }).click();
  await expect(page.getByRole('dialog')).toContainText('32 ג\' סטארטר');
  await expect(page.getByRole('dialog')).toContainText('X עמוק');
  await page.getByRole('button', { name: 'סגור' }).click({ position: { x: 5, y: 5 } });
  await page.getByRole('button', { name: /לחלק: כיכרות ולחמניות/ }).click();
  await expect(page.getByRole('dialog')).toContainText('עיצוב סופי');
  await expect(page.getByRole('dialog')).toContainText('50%–60%');
  await page.getByRole('button', { name: 'סגור' }).click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('button', { name: /להעשיר את הלחמניות/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /אוטוליזה: קמח ומים/ })).toHaveCount(0);
});

test('autolyse can be switched off and on in a running bake, alarms follow, and a new recipe can be derived', async ({ page }) => {
  await page.goto('/#/recipe');
  await page.getByLabel('שם המתכון').fill('לחם לבדיקה');
  await page.getByRole('button', { name: 'שמור מתכון' }).click();
  await page.getByRole('link', { name: 'אפייה חדשה' }).first().click();
  await page.evaluate(() => { (window as any).__ops = []; window.SourdoughAlarms = { apply: (o: unknown[]) => (window as any).__ops.push(...o) } as any; });
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await expect(page.getByRole('button', { name: /אוטוליזה: קמח ומים/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'בלי אוטוליזה, הכול יחד' }).click();
  await expect(page.getByRole('button', { name: /אוטוליזה: קמח ומים/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /לערבב הכול יחד/ })).toHaveCount(1);
  expect((await page.evaluate(() => (window as any).__ops)).some((o: any) => o.op === 'cancel')).toBe(true);
  await page.getByRole('button', { name: 'כן, מתכון חדש' }).click();
  await page.getByRole('button', { name: 'להוסיף אוטוליזה' }).click();
  await expect(page.getByRole('button', { name: /אוטוליזה: קמח ומים/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'לא, רק הפעם' }).click();
  await page.getByRole('link', { name: 'מתכונים' }).click();
  await expect(page.getByTestId('recipe')).toHaveCount(2);
});

test('refreshing any screen never fetches or navigates to the APK; the QR points at the page, not the file', async ({ page }) => {
  const apk: string[] = [];
  page.on('request', (r) => { if (/\.apk(\?|$)/.test(r.url())) apk.push(r.url()); });
  page.on('download', (d) => apk.push(`download:${d.suggestedFilename()}`));
  for (const route of ['#/', '#/plan', '#/new', '#/recipes', '#/recipe', '#/calc', '#/help', '#/starter', '#/start', '#/app']) {
    await page.goto(`/${route}`);
    await page.reload();
    await page.reload();
    await expect(page.locator('main')).toBeVisible();
    expect(page.url()).not.toMatch(/\.apk/);
  }
  await page.goto('/#/app');
  const target = await page.getByTestId('qr').getAttribute('data-target');
  expect(target).toMatch(/#\/app$/);
  expect(target).not.toMatch(/\.apk/);
  expect(apk, 'no APK request or download happened on reload').toEqual([]);
});

const seedPlanWithDueStep = async (page: import('@playwright/test').Page) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await page.evaluate(() => {
    const k = 'machmetzet.v1';
    const s = JSON.parse(localStorage.getItem(k)!);
    const past = Date.now() - 3 * 3_600_000;
    s.plan.steps = s.plan.steps.map((st: any, i: number) => ({ ...st, at: past + i * 60_000 }));
    localStorage.setItem(k, JSON.stringify(s));
  });
};

const TAB_ROUTES: [string, RegExp][] = [['תוכנית', /#\/plan$/], ['אפייה', /#\/new$/], ['מתכונים', /#\/recipes$/], ['מחשבון', /#\/calc$/], ['בית', /#\/$/]];

test('tabs work with an overdue step, granted notifications that throw, and a tall toast (tapped like a phone)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    class Boom { static permission = 'granted'; static requestPermission = async () => 'granted'; constructor() { throw new TypeError('Illegal constructor'); } }
    (window as any).Notification = Boom;
  });
  await seedPlanWithDueStep(page);
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  for (const [name, re] of TAB_ROUTES) {
    await page.locator('nav.tabs').getByText(name, { exact: true }).tap();
    await expect(page).toHaveURL(re);
  }
  expect(errors).toEqual([]);
});

test('a screen that throws shows a message and the tabs keep working', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('machmetzet.v1') ?? '{}');
    s.plan = { title: 'x', createdAt: 0, steps: 'broken', amounts: [], build: '' };
    localStorage.setItem('machmetzet.v1', JSON.stringify(s));
  });
  await page.goto('/#/plan');
  await page.reload();
  await expect(page.getByText('משהו השתבש במסך הזה')).toBeVisible();
  await page.locator('nav.tabs').getByText('מחשבון', { exact: true }).tap();
  await expect(page.getByRole('heading', { name: 'כמה להאכיל?' })).toBeVisible();
  await page.locator('nav.tabs').getByText('מתכונים', { exact: true }).tap();
  await expect(page.getByRole('heading', { name: 'מתכונים', exact: true })).toBeVisible();
});

test('the service worker registers and the app keeps working after a reload under it', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.locator('nav.tabs').getByText('תוכנית', { exact: true }).tap();
  await expect(page).toHaveURL(/#\/plan$/);
});

test('the split announces itself and each loaf and the rolls are separate branches', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'עוד לחם' }).click();
  await page.getByRole('button', { name: '+ לחמניות' }).click();
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await expect(page.getByTestId('split')).toContainText('כאן האפייה מתפצלת');
  const tracks = page.getByTestId('track');
  expect(await tracks.count()).toBeGreaterThanOrEqual(2);
  // loaf 1 goes to bake now: only that branch moves, a note is kept
  const second = await tracks.nth(1).innerText();
  await page.getByRole('button', { name: 'ניהול כיכר 1' }).click();
  await page.getByLabel('הערה למסלול הזה').fill('שם במקרר ואופה מחר');
  await page.getByRole('button', { name: 'לאפות עכשיו' }).click();
  await page.getByRole('button', { name: 'סגור' }).first().click({ position: { x: 5, y: 5 } });
  await expect(tracks.first()).toContainText('נאפה עכשיו');
  await expect(tracks.first()).toContainText('שם במקרר ואופה מחר');
  expect(await tracks.nth(1).innerText()).toBe(second);
  // a free step
  await page.getByRole('button', { name: /שלב או הערה חופשיים/ }).click();
  await page.getByLabel('מה?').fill('לבדוק את הכיכר');
  await page.getByRole('button', { name: 'הוסף' }).click();
  await expect(page.getByRole('button', { name: /לבדוק את הכיכר/ })).toBeVisible();
  // weight change offers to derive a recipe only when from a recipe; the rolls adapt
  await page.getByRole('button', { name: 'ניהול כיכר 2' }).click();
  await page.getByRole('button', { name: 'פחות משקל' }).click();
  await expect(page.getByTestId('split')).toContainText('950');
});

test('download page: direct APK button, copyable link, QR to the page', async ({ page }) => {
  await page.goto('/#/app');
  await expect(page.getByRole('link', { name: 'הורדה ישירה (APK)' })).toHaveAttribute('href', /machmetzet\.apk$/);
  await expect(page.getByTestId('apk-url')).toContainText('machmetzet.apk');
  await expect(page.getByTestId('copy-link')).toBeVisible();
  await expect(page.getByTestId('qr')).toHaveAttribute('data-target', /#\/app$/);
});

test('the home screen shows the app version', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByTestId('version')).toContainText(/^v\d+\.\d+\.\d+/);
});

test('plan has visible temperature and photo buttons: target shown, fridge advice, photo saved with the bake', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await page.getByTestId('open-temp').click();
  await expect(page.getByTestId('temp-target')).toContainText('יעד עכשיו');
  await page.getByLabel('מקרר °C').fill('9');
  await page.getByRole('button', { name: 'עדכן את הזמנים' }).click();
  await expect(page.getByTestId('fridge-advice')).toContainText('חם');
  await page.getByTestId('open-photo').click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.getByLabel('בחר תמונה מהגלריה').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByTestId('photos')).toContainText('תמונות (1)');
  await expect(page.getByTestId('photos').locator('img')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('photos').locator('img')).toBeVisible();
});

test('sync screen opens and explains the missing Google id', async ({ page }) => {
  await page.goto('/#/sync');
  await expect(page.getByRole('heading', { name: 'סנכרון עם Google Drive' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'התחברות עם Google' })).toBeDisabled();
});

test('home: bake status before the starter, the starter is asked about and never called hungry from a guess', async ({ page }) => {
  await page.goto('/#/');
  const ask = page.getByTestId('starter-ask');
  await expect(ask).toContainText('יש לך סטארטר?');
  await expect(page.getByText(/רעב כבר/)).toHaveCount(0);
  const status = await page.getByTestId('idle').boundingBox();
  const starter = await ask.boundingBox();
  expect(status!.y).toBeLessThan(starter!.y);
  const recipes = await page.getByRole('link', { name: 'מתכונים' }).first().boundingBox();
  const fresh = await page.getByRole('link', { name: 'להתחיל אפייה' }).boundingBox();
  expect(Math.abs(recipes!.y - fresh!.y)).toBeLessThan(5);
  await ask.getByRole('link', { name: 'כן, בוא נגדיר' }).click();
  await expect(page.getByRole('heading', { name: 'מה מצב הסטארטר?' })).toBeVisible();
});

test('flour mix percentages: typed value stays, the other flour takes the rest, grams follow, save locks until 100%', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'הרכב קמחים משלי' }).click();
  await page.getByRole('button', { name: '+ הוסף קמח' }).click();
  await page.getByRole('combobox', { name: 'סוג קמח' }).nth(1).selectOption('whole');
  const pct = (i: number) => page.getByLabel('אחוז', { exact: true }).nth(i);
  const gr = (i: number) => page.getByLabel('גרמים').nth(i);
  // ilan's exact sequence: grams 800 and 200, then type 48 in a percent field
  await gr(0).fill('800');
  await gr(1).fill('200');
  await expect(pct(0)).toHaveValue('80');
  await pct(0).click();
  await pct(0).fill('');
  await pct(0).pressSequentially('48');
  await expect(pct(0)).toHaveValue('48');
  await expect(gr(0)).toHaveValue('480');
  await expect(pct(1)).toHaveValue('52');
  await expect(gr(1)).toHaveValue('520');
  await expect(page.getByTestId('mix-status')).toContainText('100%');
  // decimals and clearing
  await pct(0).fill('33.5');
  await expect(pct(0)).toHaveValue('33.5');
  await expect(gr(0)).toHaveValue('335');
  await pct(0).fill('');
  await expect(gr(0)).toHaveValue('0');
  // percent first with three flours: remaining is shown and the plan button is locked until 100%
  await page.getByRole('button', { name: '+ הוסף קמח' }).click();
  await pct(0).fill('84');
  await pct(1).fill('0');
  await pct(2).fill('0');
  await expect(page.getByTestId('mix-left')).toHaveText('16');
  await expect(page.getByRole('button', { name: 'הקמחים צריכים להגיע ל־100%' }).first()).toBeDisabled();
  await pct(1).fill('16');
  await expect(page.getByTestId('mix-status')).toContainText('100%');
  await expect(page.getByRole('button', { name: 'יאללה, תתכנן לי' })).toBeEnabled();
  // too much
  await pct(2).fill('10');
  await expect(page.getByTestId('mix-status')).toContainText('יותר מדי');
  // remove a flour
  await page.getByRole('button', { name: 'הסר קמח' }).nth(2).click();
  await expect(page.getByTestId('mix-row')).toHaveCount(2);
  // grams edit moves only that flour, base is editable and keeps shares
  await gr(1).fill('300');
  await expect(pct(1)).toHaveValue('30');
  await page.getByLabel('קמח כולל').fill('2000');
  await expect(pct(1)).toHaveValue('30');
  await expect(gr(1)).toHaveValue('600');
});

test('items and starter need: a kilo loaf defaults to 1, 200 g on hand asks if sure, 3 loaves from 100 g is a shortfall, pizza and custom items', async ({ page }) => {
  await page.goto('/#/new');
  await expect(page.getByLabel('כמות לחם')).toHaveText('1');
  await expect(page.getByLabel('משקל לחם')).toHaveValue('1000');
  await page.getByLabel('יש לי עכשיו (גרם)').fill('200');
  await expect(page.getByTestId('starter-lots')).toContainText('בטוח בכמות הסטארטר');
  await expect(page.getByRole('button', { name: /100 ג' · נשארים 100/ })).toBeVisible();
  await page.getByRole('button', { name: /150 ג' · נשארים 50.*מהירה/ }).click();
  await expect(page.getByLabel('כמה סטארטר לשים בבצק (גרם)')).toHaveValue('150');
  await page.getByLabel('יש לי עכשיו (גרם)').fill('100');
  await page.getByRole('button', { name: 'עוד לחם' }).click();
  await page.getByRole('button', { name: 'עוד לחם' }).click();
  await expect(page.getByTestId('starter-warning')).toContainText('חסרים');
  // a pizza item and a custom item
  await page.getByRole('button', { name: '+ פיצה' }).click();
  await expect(page.getByLabel('כמות פיצה')).toHaveText('1');
  page.once('dialog', (d) => d.accept('בריוש'));
  await page.getByRole('button', { name: '+ פריט משלי' }).click();
  await expect(page.getByLabel('כמות בריוש')).toHaveText('1');
  await page.getByLabel('כמה סטארטר לשים בבצק (גרם)').fill('300');
  await page.getByRole('button', { name: 'הסר בריוש' }).click();
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await expect(page.getByTestId('split')).toContainText('פיצה');
  await expect(page.getByRole('button', { name: /לאפות פיצה/ })).toBeVisible();
});

test('in a running bake: kneading by hand or machine per round, and same day or overnight at any time', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: /^מכונה$/ }).click();
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  // round 1 by hand, rest by machine
  await page.getByRole('button', { name: /קיפול 1 מתוך 4/ }).click();
  await page.getByRole('button', { name: 'ביד', exact: true }).click();
  await expect(page.getByRole('button', { name: /קיפול 1 מתוך 4 · ביד/ })).toBeVisible();
  await page.getByRole('button', { name: /קיפול 2 מתוך 4/ }).click();
  await expect(page.getByRole('button', { name: 'מכונה', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'ביד', exact: true }).click();
  await expect(page.getByRole('button', { name: /קיפול 2 מתוך 4 · ביד/ })).toBeVisible();
  await page.getByRole('button', { name: /קיפול 3 מתוך 4/ }).click();
  await page.getByLabel('גם לכל הקיפולים הבאים').check();
  await page.getByRole('button', { name: 'ביד', exact: true }).click();
  await expect(page.getByRole('button', { name: /קיפול 4 מתוך 4 · ביד/ })).toBeVisible();
  // same day vs overnight
  const bake = page.getByRole('button', { name: /לאפות: 24\d° מכוסה/ }).first();
  const before = await bake.getAttribute('aria-label');
  await page.getByRole('button', { name: 'אפייה באותו יום' }).click();
  expect(await bake.getAttribute('aria-label')).not.toBe(before);
  await expect(page.getByRole('button', { name: 'אפייה באותו יום' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'לילה במקרר' }).click();
  expect(await bake.getAttribute('aria-label')).toBe(before);
});

test('starter explanations: the need is spelled out, the shortfall says what to do, the percent shows grams', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByLabel('משקל לחם').selectOption('900');
  await expect(page.getByTestId('starter-need')).toContainText('900 ג\' בצק');
  await expect(page.getByTestId('starter-need')).toContainText('90 ג\' סטארטר');
  await expect(page.getByTestId('item-starter-g')).toHaveText('= 90 ג\'');
  await expect(page.getByTestId('percent-hint')).toContainText('10% מ־900 ג\' בצק = 90 ג\' סטארטר');
  await page.getByLabel('יש לי עכשיו (גרם)').fill('30');
  await page.getByLabel('כמה סטארטר לשים בבצק (גרם)').fill('200');
  const w = page.getByTestId('starter-warning');
  await expect(w).toContainText('חסרים 170');
  await expect(w).toContainText('המומלץ ללחם שבחרת הוא רק כ־90');
  await w.getByRole('button', { name: /השתמש רק ב־90/ }).click();
  await expect(page.getByTestId('starter-warning')).toContainText('חסרים 60');
  await page.getByRole('button', { name: 'תכנן לי את ההאכלות' }).click();
  await expect(page.getByRole('heading', { name: 'התוכנית שלך' })).toBeVisible();
  await expect(page.getByRole('button', { name: /האכלה 1 מתוך/ })).toBeVisible();
});

// ---- user scenarios (docs/SPEC.md 4.19), clicked through like a person ----
const seedState = (page: import('@playwright/test').Page, patch: Record<string, unknown>) =>
  page.evaluate((p) => {
    const st = JSON.parse(localStorage.getItem('machmetzet.v1') ?? '{}');
    localStorage.setItem('machmetzet.v1', JSON.stringify({ ...st, ...p }));
  }, patch);

test('scenario 1, a new user opens the app: nothing running, asked about the starter, answers, and is led to start a bake', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByTestId('idle')).toContainText('אין תוכנית רצה');
  await expect(page.getByTestId('starter-ask')).toBeVisible();
  await page.getByRole('link', { name: 'כן, בוא נגדיר' }).click();
  await page.getByRole('button', { name: 'רגיל (100%)' }).click();
  await page.getByRole('button', { name: /בחוץ/ }).click();
  await page.getByRole('button', { name: 'אתמול' }).click();
  await page.getByRole('button', { name: 'פעיל ובועבע' }).click();
  await page.getByRole('button', { name: '100', exact: true }).click();
  await page.getByRole('button', { name: 'שמור ובחזרה לבית' }).click();
  await page.getByTestId('starter-next').click();
  await expect(page.getByRole('heading', { name: 'מה בא לך?' })).toBeVisible();
});

test('scenario 2, a returning user wants a recipe: home, recipes, bake from it', async ({ page }) => {
  await page.goto('/#/recipe');
  await page.getByLabel('שם המתכון').fill('הלחם של שבת');
  await page.getByRole('button', { name: 'שמור מתכון' }).click();
  await page.goto('/#/');
  await page.getByRole('link', { name: /מתכונים/ }).first().click();
  await expect(page.getByTestId('recipe')).toContainText('הלחם של שבת');
  await page.getByRole('link', { name: 'אפייה חדשה' }).first().click();
  await expect(page.getByRole('heading', { name: 'מה בא לך?' })).toBeVisible();
  await expect(page.getByLabel('בחירת מתכון')).not.toHaveValue('');
});

test('scenario 3, checking a running bake: home says a plan is running, shows the next step and opens the plan', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await page.goto('/#/');
  const run = page.getByTestId('running');
  await expect(run).toContainText('תוכנית רצה עכשיו');
  await expect(run).toContainText('השלב הבא');
  await expect(run).toContainText(/שלב 1 מתוך \d+/);
  await run.click();
  await expect(page.getByRole('heading', { name: 'התוכנית שלך' })).toBeVisible();
});

test('scenario 4, starting a bake without a starter: the wizard asks how much starter and warns', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('button', { name: 'אין לי עדיין' }).click();
  await expect(page.getByText('אין סטארטר עדיין')).toBeVisible();
  await page.getByRole('link', { name: 'להתחיל אפייה' }).click();
  await page.getByLabel('יש לי עכשיו (גרם)').fill('0');
  await expect(page.getByTestId('starter-section')).toBeVisible();
  await expect(page.getByTestId('starter-warning')).toBeVisible();
});

test('scenario 5, looking back at the last bake: a finished bake shows in "what I baked lately" with its notes', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await page.getByRole('button', { name: 'ניהול הכיכר' }).click();
  await page.getByLabel('הערה למסלול הזה').fill('יצא מצוין');
  await page.getByRole('button', { name: 'סגור' }).first().click({ position: { x: 5, y: 5 } });
  await page.getByRole('button', { name: 'בטל תוכנית' }).click();
  await page.goto('/#/');
  await expect(page.getByTestId('idle')).toBeVisible();
  await expect(page.getByTestId('recent')).toContainText('מה אפיתי לאחרונה');
  await expect(page.getByTestId('recent-item')).toHaveCount(1);
  await expect(page.getByTestId('recent')).toContainText('1 הערות');
});

test('scenario 6, nothing is running: a clear way to start', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByTestId('idle')).toBeVisible();
  await page.getByRole('link', { name: 'להתחיל אפייה' }).click();
  await expect(page).toHaveURL(/#\/new$/);
});

test('recipe editing never depends on the starter I have: no stock fields or warnings, only what the recipe needs', async ({ page }) => {
  await page.goto('/#/recipe');
  await expect(page.getByTestId('recipe-starter')).toContainText('כמה סטארטר צריך');
  await expect(page.getByTestId('recipe-starter')).toContainText('בלי קשר לכמה יש לך');
  await expect(page.getByLabel('יש לי עכשיו (גרם)')).toHaveCount(0);
  await page.getByRole('button', { name: 'עוד לחם' }).click();
  await page.getByRole('button', { name: 'עוד לחם' }).click();
  await expect(page.getByTestId('starter-warning')).toHaveCount(0);
  await page.getByLabel('שם המתכון').fill('שלושה לחמים');
  await page.getByRole('button', { name: 'שמור מתכון' }).click();
  await expect(page.getByTestId('recipe')).toContainText('שלושה לחמים');
  // the check happens at bake start
  await page.getByRole('link', { name: 'אפייה חדשה' }).first().click();
  await page.getByLabel('יש לי עכשיו (גרם)').fill('100');
  await expect(page.getByTestId('starter-warning')).toContainText('אין לך מספיק סטארטר לתוכנית הזאת');
});

test('starter status accepts typed values: hydration, grams, time in the fridge in weeks', async ({ page }) => {
  await page.goto('/#/starter');
  await page.getByLabel('הידרציה באחוזים').fill('70');
  await page.getByRole('button', { name: 'במקרר' }).click();
  await page.getByLabel('כמה זמן במקרר').fill('3');
  await page.getByLabel('יחידת זמן').selectOption('7');
  await page.getByLabel('כמה גרם יש לך').fill('120');
  await expect(page.getByTestId('starter-advice')).toContainText('חיזוק');
  await page.getByLabel('כמה גרם יש לך').fill('0');
  await expect(page.getByText('בין 1 ל־5000')).toBeVisible();
  await page.getByLabel('כמה גרם יש לך').fill('120');
  await page.getByRole('button', { name: 'שמור ובחזרה לבית' }).click();
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('machmetzet.v1')!).starter);
  expect(st.hydration).toBeCloseTo(0.7);
  expect(st.type).toBe('stiff');
  expect(st.grams).toBe(120);
  expect(st.inFridge).toBe(true);
  expect(Math.round((Date.now() - st.lastFedAt) / 86_400_000)).toBe(21);
});

test('a flour can appear once in a blend: used flours are disabled, add picks an unused one, old duplicates can be merged', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'הרכב קמחים משלי' }).click();
  await page.getByRole('button', { name: '+ הוסף קמח' }).click();
  const sel = (i: number) => page.getByRole('combobox', { name: 'סוג קמח' }).nth(i);
  const first = await sel(0).inputValue();
  const second = await sel(1).inputValue();
  expect(second).not.toBe(first);
  await expect(sel(1).locator(`option[value="${first}"]`)).toBeDisabled();
  await expect(sel(0).locator(`option[value="${second}"]`)).toBeDisabled();
  // keep adding until every flour is used: the button locks
  for (let i = 0; i < 30 && (await page.getByRole('button', { name: '+ הוסף קמח' }).isEnabled()); i++) {
    await page.getByRole('button', { name: '+ הוסף קמח' }).click();
  }
  await expect(page.getByRole('button', { name: '+ הוסף קמח' })).toBeDisabled();
  const rows = await page.getByTestId('mix-row').count();
  const ids = await page.getByRole('combobox', { name: 'סוג קמח' }).evaluateAll((els) => els.map((e) => (e as HTMLSelectElement).value));
  expect(new Set(ids).size).toBe(rows);
});

test('a saved recipe with the same flour twice shows a message and merges the rows', async ({ page }) => {
  await page.goto('/#/');
  await seedState(page, { recipes: [{ id: 'rd', name: 'ישן', fav: false, loaves: 1, rolls: 0, weight: 1000, shape: 'free', inclusions: [], kneading: 'hand', cold: true, hydration: 0.72, mix: [{ flour: 'white', grams: 150 }, { flour: 'white', grams: 150 }, { flour: 'spelt', grams: 700 }] }] });
  await page.goto('/#/recipe/rd');
  await page.reload();
  await expect(page.getByTestId('mix-dupes')).toBeVisible();
  await page.getByRole('button', { name: 'אחד את השורות' }).click();
  await expect(page.getByTestId('mix-dupes')).toHaveCount(0);
  await expect(page.getByTestId('mix-row')).toHaveCount(2);
  await expect(page.getByLabel('אחוז', { exact: true }).first()).toHaveValue('30');
});

test('two bakes at once: both on home, switch between them, alarms carry the bake name, finishing one keeps the other', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __ops: unknown[] }).__ops = [];
    (window as unknown as { SourdoughAlarms: unknown }).SourdoughAlarms = { apply: (o: unknown[]) => (window as unknown as { __ops: unknown[] }).__ops.push(...o) };
  });
  await page.reload();
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'יאללה, תתכנן לי' }).click();
  await expect(page.getByTestId('bake-switch')).toBeVisible();
  await page.goto('/#/');
  await expect(page.getByTestId('running')).toHaveCount(2);
  const ops = await page.evaluate(() => (window as unknown as { __ops: { op: string; id: string; title?: string }[] }).__ops);
  // the last word on each alarm
  const last = new Map(ops.filter((o) => o.op === 'set').map((o) => [o.id, o]));
  const sets = [...last.values()];
  expect(sets.length).toBeGreaterThan(2);
  expect(new Set(sets.map((o) => o.id.split(':')[0])).size).toBe(2);
  expect(sets.every((o) => o.title!.includes(' · '))).toBe(true);
  // open the second one and cancel it: the first stays
  await page.getByTestId('running').nth(1).click();
  await page.getByRole('button', { name: 'בטל תוכנית' }).click();
  await page.goto('/#/');
  await expect(page.getByTestId('running')).toHaveCount(1);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('machmetzet.v1')!));
  expect(st.others).toHaveLength(0);
  expect(st.plan).not.toBeNull();
});
