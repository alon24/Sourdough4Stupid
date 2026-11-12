# בוט טלגרם

Cloudflare Worker + Durable Object (חינם, בלי מסד נתונים להקים). Cron כל דקה שולח הודעה בכל שלב שהגיע זמנו, עם כפתורים:
✅ בוצע · 😴 נודניק 10 · ➕15/30/60 · ⏭ דלג.
החישוב הוא מנוע התכנון של האפליקציה (`core/`): בוצע מוסיף את ההמתנות מרגע הלחיצה, ותוספת זמן מזיזה את כל השלבים הבאים.

## הפעלה (חד־פעמי)
1. בטלגרם: @BotFather ← `/newbot` ← שומרים את ה־token.
2. חשבון Cloudflare חינמי ← My Profile ← API Tokens ← תבנית "Edit Cloudflare Workers". מעתיקים את הטוקן ואת ה־Account ID.
3. ב־GitHub: Settings ← Secrets and variables ← Actions. Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BOT_TOKEN`, `WEBHOOK_SECRET` (מחרוזת אקראית ארוכה כלשהי). Variables: `BOT_DEPLOY` = `true`.
4. Actions ← Deploy bot ← Run workflow.
5. פותחים בדפדפן `https://sourdough-bot.<שם-המשתמש-שלכם>.workers.dev/setup/<WEBHOOK_SECRET>`. אמור להופיע "הבוט מחובר".

או ידנית: `cd bot && npm i && npx wrangler secret put BOT_TOKEN && npx wrangler secret put WEBHOOK_SECRET && npx wrangler deploy`.

## חיבור האפליקציה
האפליקציה יוצרת טוקן אקראי (`newToken()` ב־`src/client.ts`), מציגה "/start <טוקן>" ושולחים אותו לבוט. אחר כך `botClient(url, token)` מסנכרן: `push` אחרי כל שינוי בתוכנית, `pull` כשהאפליקציה נפתחת ובמחזור ברקע. `baseRev` שונה מ־rev בשרת (נלחץ כפתור בטלגרם) מחזיר `conflict` עם התוכנית של הבוט.

## אפשרות
`ALLOWED_CHAT_IDS` (secret/var, מופרדים בפסיק) מגביל את הבוט לצ'אט שלך.
