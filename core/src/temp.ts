/** Temperature-aware fermentation: how much of the bulk rise is done, how much is left,
 *  and what to do when the dough is warmer or cooler than planned. */
import { tempFactor } from './starter.js';

const MIN = 60_000;

/** Something you measured. Every field is optional: give what you have. */
export interface Reading {
  at: number;
  /** dough temperature, °C */
  doughC?: number;
  /** kitchen temperature, °C */
  roomC?: number;
  /** how much the dough has risen, percent (50 = one and a half times its size) */
  risePct?: number;
  /** fridge temperature, °C */
  fridgeC?: number;
}

export interface BulkOptions {
  startAt: number;
  /** minutes the whole bulk takes at 24°C */
  refMin: number;
  /** temperature at the start, °C */
  startC: number;
  /** rise that means "done", percent (default 75) */
  targetRise?: number;
}

export interface BulkState {
  /** 0 to 1 */
  progress: number;
  remainingMin: number;
  /** temperature the estimate assumes from now on, °C */
  tempC: number;
}

/**
 * Where the bulk stands. Time at a temperature counts for more or less: an hour at 30°C is
 * worth about 1.7 hours at 24°C. A rise measurement overrides the estimate from that moment.
 */
export function bulkState(readings: Reading[], now: number, o: BulkOptions): BulkState {
  const target = o.targetRise ?? 75;
  const sorted = readings.filter((r) => r.at > o.startAt && r.at <= now).sort((a, b) => a.at - b.at);
  let effective = 0;
  let cursor = o.startAt;
  let temp = o.startC;
  for (const r of sorted) {
    effective += (r.at - cursor) / MIN / tempFactor(temp);
    cursor = r.at;
    if (r.doughC !== undefined) temp = r.doughC;
    else if (r.roomC !== undefined) temp = r.roomC;
    if (r.risePct !== undefined) effective = Math.min(1, Math.max(0, r.risePct) / target) * o.refMin;
  }
  effective += (now - cursor) / MIN / tempFactor(temp);
  const progress = Math.min(1, Math.max(0, effective / o.refMin));
  return { progress, remainingMin: Math.max(0, (o.refMin - effective) * tempFactor(temp)), tempC: temp };
}

export type TempLevel = 'ok' | 'cold' | 'hot';

export interface TempAdvice {
  level: TempLevel;
  /** how much faster (+) or slower (-) the dough ferments than at the target, percent */
  speedPct: number;
  text: string;
}

/** Say what a dough temperature means and what to do about it. */
export function doughTempAdvice(doughC: number, targetC = 25): TempAdvice {
  const speedPct = Math.round((tempFactor(targetC) / tempFactor(doughC) - 1) * 100);
  const diff = doughC - targetC;
  if (Math.abs(diff) <= 1.5) {
    return { level: 'ok', speedPct, text: `${doughC}° זה בדיוק בטווח (יעד ${targetC}°). ההתפחה לפי התוכנית.` };
  }
  if (diff < 0) {
    return {
      level: 'cold', speedPct,
      text: `${doughC}° קר מהיעד (${targetC}°), ההתפחה איטית בכ־${Math.abs(speedPct)}%. אפשר להעביר למקום חם: תנור כבוי עם האור דולק, או קערה מעל מים חמימים. בפעם הבאה: מים חמים יותר.`,
    };
  }
  return {
    level: 'hot', speedPct,
    text: `${doughC}° חם מהיעד (${targetC}°), ההתפחה מהירה בכ־${speedPct}%. כדאי מקום קריר יותר, או 30-60 דק' במקרר. בפעם הבאה: מים קרים יותר.`,
  };
}

/** Tips for the kitchen temperature. */
export function roomTempTip(roomC: number): string {
  if (roomC >= 29) return `${roomC}° חם במטבח: מים קרים לבצק, קיצור זמני ההתפחה, ושעון קצר לבדיקה.`;
  if (roomC >= 26) return `${roomC}° חמים: ההתפחה מהירה, כדאי לבדוק מוקדם.`;
  if (roomC >= 21) return `${roomC}° טמפרטורת מטבח נוחה.`;
  if (roomC >= 18) return `${roomC}° קריר: מים חמימים לבצק והתפחה ארוכה יותר.`;
  return `${roomC}° קר: מים חמים (כ־35°), מקום חם להתפחה (תנור כבוי עם אור), וזמנים ארוכים בהרבה.`;
}

export const TARGET_DOUGH_C = { bread: 25, roll: 25, pizza: 24 } as const;

/** The temperature to aim for at a given step, and what to measure. */
export function targetFor(kind: string, roomC = 24): { what: string; text: string } {
  switch (kind) {
    case 'revive': case 'feed':
      return { what: 'סטארטר', text: 'סטארטר מתפתח הכי טוב ב־24–26°. אם המטבח קר, מקום חם כמו תנור כבוי עם אור.' };
    case 'autolyse': case 'mix': case 'soak':
      return { what: 'מים ובצק', text: `יעד לבצק אחרי הערבוב: ${TARGET_DOUGH_C.bread}°. מדוד את הבצק מיד אחרי הערבוב.` };
    case 'fold':
      return { what: 'בצק', text: `בצק ב־${TARGET_DOUGH_C.bread - 1}–${TARGET_DOUGH_C.bread + 1}° מתפיח לפי התוכנית. מטבח עכשיו ${roomC}°.` };
    case 'divide': case 'shape': case 'shapeRolls': case 'enrich':
      return { what: 'בצק ומקרר', text: 'לפני המקרר מדוד את הבצק, ובמקרר יעד 3–5°. מקרר חם מהיר את ההתפחה הקרה.' };
    case 'fridge':
      return { what: 'מקרר', text: 'יעד במקרר 3–5°.' };
    default:
      return { what: 'מטבח', text: `טמפרטורת המטבח משפיעה על כל זמני ההתפחה. עכשיו ${roomC}°.` };
  }
}

/** Tip for the fridge temperature during the cold proof. */
export function fridgeTip(c: number): string {
  if (c > 6) return `${c}° במקרר חם: ההתפחה הקרה מהירה, כדאי לאפות מוקדם יותר או להנמיך את המקרר ל־4°.`;
  if (c < 2) return `${c}° במקרר קר מאוד: ההתפחה איטית, אפשר להוציא שעה לפני האפייה.`;
  return `${c}° במקרר בטווח (3–5°).`;
}
