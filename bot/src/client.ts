/** Used by the app (not the Worker) to keep the bot's copy of the plan in sync. */
import type { Step } from '../../core/src/plan.js';

export interface BotClient {
  /** "/start <token>" the user sends to the bot to link this device */
  startCommand: string;
  linked(): Promise<boolean>;
  /** latest plan from the bot (includes presses made in Telegram) */
  pull(): Promise<{ rev: number; steps: Step[] }>;
  /** send the app's plan; resolves with the new rev, or `conflict` with the bot's newer plan */
  push(steps: Step[], baseRev: number): Promise<{ rev: number } | { conflict: { rev: number; steps: Step[] } }>;
}

export function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!);
}

export function botClient(baseUrl: string, token: string, tz = Intl.DateTimeFormat().resolvedOptions().timeZone): BotClient {
  const call = (path: string, init?: RequestInit) =>
    fetch(baseUrl.replace(/\/$/, '') + path, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  return {
    startCommand: `/start ${token}`,
    linked: async () => ((await (await call('/api/status')).json()) as { linked: boolean }).linked,
    pull: async () => (await call('/api/plan')).json() as Promise<{ rev: number; steps: Step[] }>,
    push: async (steps, baseRev) => {
      const r = await call('/api/plan', { method: 'PUT', body: JSON.stringify({ steps, baseRev, tz }) });
      const j = (await r.json()) as { rev: number; steps?: Step[] };
      return r.status === 409 ? { conflict: { rev: j.rev, steps: j.steps ?? [] } } : { rev: j.rev };
    },
  };
}
