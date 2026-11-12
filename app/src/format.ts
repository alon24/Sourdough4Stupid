const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export const hhmm = (t: number): string => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const dayName = (t: number, now = Date.now()): string => {
  const d = new Date(t);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(d) - start(new Date(now))) / 86_400_000);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff === -1) return 'אתמול';
  return `יום ${DAYS[d.getDay()]}`;
};

export const grams = (g: number): string => `${Math.round(g).toLocaleString('he-IL')} ג'`;

export const until = (t: number, now = Date.now()): string => {
  const min = Math.round((t - now) / 60_000);
  if (min < -1) return `באיחור של ${fmtDur(-min)}`;
  if (min <= 1) return 'עכשיו';
  return `בעוד ${fmtDur(min)}`;
};

const fmtDur = (min: number): string => {
  if (min < 60) return `${min} דק'`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} שע'` : `${h}:${String(m).padStart(2, '0')} שע'`;
};

/** value for <input type="datetime-local"> in local time */
export const toLocalInput = (t: number): string => {
  const d = new Date(t - new Date(t).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};
