/** Pure bot logic: no network, no storage. The plan math is the app's own engine from /core. */
import { complete, shift, type Step } from '../../core/src/plan.js';

export interface Link {
  chatId: number;
  tz: string;
  /** bumped on every change, so app and bot can detect who changed last */
  rev: number;
  steps: Step[];
  /** stepId -> the `at` we already sent a message for (a moved step is announced again) */
  notified: Record<string, number>;
}

export type Action = 'sn' | 'p15' | 'p30' | 'p60' | 'ok' | 'skip';

const MIN = 60_000;
const STALE = 3 * 60 * MIN; // never announce steps that are more than 3h late
const SNOOZE_MIN = 10;

export const fmtTime = (ms: number, tz: string): string =>
  new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(ms);

export function dueSteps(link: Link, now: number): Step[] {
  return link.steps.filter(
    (s) => s.doneAt === undefined && s.at <= now && s.at > now - STALE && link.notified[s.id] !== s.at,
  );
}

export function stepText(link: Link, s: Step): string {
  const i = link.steps.findIndex((x) => x.id === s.id) + 1;
  const note = s.note ? `\n${s.note}` : '';
  return `⏰ ${s.title}\n${fmtTime(s.at, link.tz)} (שלב ${i} מתוך ${link.steps.length})${note}`;
}

export function keyboard(id: string) {
  const b = (text: string, a: Action) => ({ text, callback_data: `a:${a}:${id}` });
  return {
    inline_keyboard: [
      [b('✅ בוצע', 'ok'), b(`😴 נודניק ${SNOOZE_MIN}`, 'sn')],
      [b('➕15', 'p15'), b('➕30', 'p30'), b('➕60', 'p60')],
      [b('⏭ דלג', 'skip')],
    ],
  };
}

const ADD: Record<string, number> = { sn: SNOOZE_MIN, p15: 15, p30: 30, p60: 60 };

export interface Applied {
  link: Link;
  text: string;
  changed: boolean;
}

/** A button press. Waits after "done" are counted from `now`; added time moves all later steps. */
export function applyAction(link: Link, action: Action, id: string, now: number): Applied {
  const step = link.steps.find((s) => s.id === id);
  if (!step) return { link, text: 'השלב לא נמצא (התוכנית השתנתה).', changed: false };
  if (step.doneAt !== undefined) return { link, text: `${step.title}: כבר סומן כבוצע.`, changed: false };

  let steps: Step[];
  let text: string;
  if (action === 'ok') {
    steps = complete(link.steps, id, now);
    text = `✅ ${step.title} בוצע ב־${fmtTime(now, link.tz)}.`;
  } else if (action === 'skip') {
    steps = complete(link.steps, id, Math.min(now, step.at));
    text = `⏭ ${step.title} דולג.`;
  } else {
    const min = ADD[action];
    if (min === undefined) return { link, text: 'פעולה לא מוכרת.', changed: false };
    // a snooze from a late step counts from now, so it never lands in the past
    const base = Math.max(step.at, now);
    steps = shift(link.steps, id, (base - step.at) / MIN + min, true);
    const moved = steps.find((s) => s.id === id)!;
    text = `${action === 'sn' ? '😴' : '➕'} ${step.title} נדחה ל־${fmtTime(moved.at, link.tz)}. השלבים הבאים זזו איתו.`;
  }
  const next = steps.find((s) => s.doneAt === undefined && (action === 'ok' || action === 'skip') && s.id !== id);
  if (next) text += `\nהבא: ${next.title} ב־${fmtTime(next.at, link.tz)}`;
  return { link: { ...link, steps, rev: link.rev + 1 }, text, changed: true };
}

export function upcomingText(link: Link, now: number): string {
  const open = link.steps.filter((s) => s.doneAt === undefined && s.at > now - STALE).slice(0, 8);
  if (!open.length) return 'אין שלבים פתוחים. כשתתחילו אפייה באפליקציה היא תופיע כאן.';
  return ['📋 השלבים הקרובים:', ...open.map((s) => `${fmtTime(s.at, link.tz)}  ${s.title}`)].join('\n');
}

/** App pushes its plan. Rejected when the bot changed it since the app last pulled. */
export function putPlan(
  link: Link,
  steps: Step[],
  baseRev: number,
  tz?: string,
): { ok: true; link: Link } | { ok: false; link: Link } {
  if (baseRev !== link.rev) return { ok: false, link };
  return { ok: true, link: { ...link, steps, tz: tz ?? link.tz, rev: link.rev + 1 } };
}
