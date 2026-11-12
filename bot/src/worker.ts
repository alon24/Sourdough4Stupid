import { DurableObject } from 'cloudflare:workers';
import type { Step } from '../../core/src/plan.js';
import {
  applyAction, dueSteps, keyboard, putPlan, stepText, upcomingText,
  type Action, type Link,
} from './logic.js';

interface Env {
  HUB: DurableObjectNamespace<Hub>;
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  /** optional, comma separated Telegram chat ids allowed to link */
  ALLOWED_CHAT_IDS?: string;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...CORS } });

async function sha(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  fetch: (req: Request, env: Env) => env.HUB.get(env.HUB.idFromName('hub')).fetch(req),
  scheduled: async (_e: ScheduledController, env: Env) => {
    await env.HUB.get(env.HUB.idFromName('hub')).fetch('https://hub/tick');
  },
};

export class Hub extends DurableObject<Env> {
  private tg(method: string, body: unknown) {
    return fetch(`https://api.telegram.org/bot${this.env.BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private get = (key: string) => this.ctx.storage.get<Link>(key);

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/tick') return this.tick();
    if (url.pathname === `/setup/${this.env.WEBHOOK_SECRET}`) {
      const r = await this.tg('setWebhook', {
        url: `${url.origin}/telegram`,
        secret_token: this.env.WEBHOOK_SECRET,
        allowed_updates: ['message', 'callback_query'],
      });
      return new Response(r.ok ? 'הבוט מחובר ✅ אפשר לסגור את הדף.' : `שגיאה: ${await r.text()}`);
    }
    if (url.pathname === '/telegram' && req.method === 'POST') {
      if (req.headers.get('x-telegram-bot-api-secret-token') !== this.env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      await this.update(await req.json());
      return new Response('ok');
    }
    if (url.pathname.startsWith('/api/')) return this.api(req, url);
    return new Response('sourdough bot');
  }

  /** App side: GET /api/plan, PUT /api/plan {steps, baseRev, tz}. Bearer = the pairing token. */
  private async api(req: Request, url: URL): Promise<Response> {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (token.length < 16) return json({ error: 'token' }, 401);
    const key = `link:${await sha(token)}`;
    const link = await this.get(key);
    if (url.pathname === '/api/status') return json({ linked: !!link });
    if (!link) return json({ linked: false }, 404);
    if (url.pathname !== '/api/plan') return json({ error: 'not found' }, 404);
    if (req.method === 'GET') return json({ rev: link.rev, steps: link.steps });
    if (req.method === 'PUT') {
      const body = (await req.json()) as { steps: Step[]; baseRev: number; tz?: string };
      const res = putPlan(link, body.steps, body.baseRev, body.tz);
      if (res.ok) await this.ctx.storage.put(key, res.link);
      return json({ rev: res.link.rev, steps: res.ok ? undefined : res.link.steps }, res.ok ? 200 : 409);
    }
    return json({ error: 'method' }, 405);
  }

  private async update(u: any): Promise<void> {
    if (u.callback_query) return this.press(u.callback_query);
    const msg = u.message;
    const chatId: number | undefined = msg?.chat?.id;
    const text: string = (msg?.text ?? '').trim();
    if (!chatId) return;
    const say = (t: string) => this.tg('sendMessage', { chat_id: chatId, text: t });

    const allowed = this.env.ALLOWED_CHAT_IDS?.split(',').map((x) => x.trim()).filter(Boolean);
    if (allowed?.length && !allowed.includes(String(chatId))) return void (await say('בוט פרטי.'));

    if (text.startsWith('/start')) {
      const token = text.split(/\s+/)[1];
      if (!token || token.length < 16) {
        return void (await say('היי! 🍞 כדי לחבר: באפליקציה, הגדרות ← טלגרם, ושלחו לי כאן את הפקודה שמופיעה שם.'));
      }
      const hash = await sha(token);
      const old = await this.ctx.storage.get<string>(`chat:${chatId}`);
      if (old && old !== hash) await this.ctx.storage.delete(`link:${old}`);
      const existing = await this.get(`link:${hash}`);
      await this.ctx.storage.put(`link:${hash}`, { chatId, tz: 'Asia/Jerusalem', rev: 0, steps: [], notified: {}, ...existing });
      await this.ctx.storage.put(`chat:${chatId}`, hash);
      return void (await say('מחובר ✅ אשלח הודעה בכל שלב, עם כפתורים לנודניק, תוספת זמן וסימון בוצע.'));
    }
    const hash = await this.ctx.storage.get<string>(`chat:${chatId}`);
    const link = hash ? await this.get(`link:${hash}`) : undefined;
    if (text.startsWith('/stop') && hash) {
      await this.ctx.storage.delete([`link:${hash}`, `chat:${chatId}`]);
      return void (await say('נותק. 👋'));
    }
    if (text.startsWith('/plan')) return void (await say(link ? upcomingText(link, Date.now()) : 'לא מחובר. שלחו /start עם הקוד מהאפליקציה.'));
    await say('פקודות: /plan לשלבים הקרובים, /stop לניתוק.');
  }

  private async press(cq: any): Promise<void> {
    const chatId: number = cq.message.chat.id;
    const [, action, id] = String(cq.data).split(':') as [string, Action, string];
    const hash = await this.ctx.storage.get<string>(`chat:${chatId}`);
    const link = hash ? await this.get(`link:${hash}`) : undefined;
    if (!hash || !link) return void (await this.tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'לא מחובר' }));
    const r = applyAction(link, action, id as string, Date.now());
    if (r.changed) await this.ctx.storage.put(`link:${hash}`, r.link);
    await this.tg('answerCallbackQuery', { callback_query_id: cq.id });
    await this.tg('editMessageText', { chat_id: chatId, message_id: cq.message.message_id, text: r.text });
  }

  /** Cron: announce every step that came due. */
  private async tick(): Promise<Response> {
    const now = Date.now();
    const links = await this.ctx.storage.list<Link>({ prefix: 'link:' });
    for (const [key, link] of links) {
      const due = dueSteps(link, now);
      if (!due.length) continue;
      const notified = { ...link.notified };
      for (const s of due) {
        const r = await this.tg('sendMessage', {
          chat_id: link.chatId, text: stepText(link, s), reply_markup: keyboard(s.id),
        });
        if (r.ok) notified[s.id] = s.at;
      }
      // re-read: a button may have changed the plan while we were sending
      const fresh = (await this.get(key)) ?? link;
      await this.ctx.storage.put(key, { ...fresh, notified: { ...fresh.notified, ...notified } });
    }
    return new Response('ok');
  }
}
