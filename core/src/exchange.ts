/** Recipe export/import (JSON, CSV) and a standalone shareable HTML page. Pure functions, no DOM. */
import { allFlours } from './flours.js';

export interface RecipeData {
  id: string;
  name: string;
  fav: boolean;
  derivedFrom?: string;
  loaves: number;
  rolls: number;
  weight: number;
  shape: 'free' | 'tin';
  inclusions: string[];
  kneading: 'hand' | 'machine';
  cold: boolean;
  folds?: number;
  foldGapMin?: number;
  hydration: number;
  mix: { flour: string; grams: number }[];
}

export interface Bundle {
  app: 'machmetzet';
  v: 1;
  recipes: RecipeData[];
  customFlours: { id: string; name: string; absorption: number }[];
}

export const toJson = (recipes: RecipeData[], customFlours: Bundle['customFlours'] = []): string =>
  JSON.stringify({ app: 'machmetzet', v: 1, recipes, customFlours } satisfies Bundle, null, 2);

const num = (x: unknown, d: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);

/** Accepts anything, keeps only well-formed recipes. Throws on text that is not a bundle. */
export function fromJson(text: string): Bundle {
  const raw = JSON.parse(text) as Partial<Bundle>;
  if (!raw || raw.app !== 'machmetzet' || !Array.isArray(raw.recipes)) throw new RangeError('not a recipe file');
  const recipes = raw.recipes.flatMap((r): RecipeData[] => {
    if (!r || typeof r.name !== 'string' || !r.name.trim() || !Array.isArray(r.mix)) return [];
    return [{
      id: String(r.id ?? ''), name: r.name.trim(), fav: !!r.fav, ...(r.derivedFrom ? { derivedFrom: String(r.derivedFrom) } : {}),
      loaves: num(r.loaves, 0), rolls: num(r.rolls, 0), weight: num(r.weight, 900), shape: r.shape === 'tin' ? 'tin' : 'free',
      inclusions: Array.isArray(r.inclusions) ? r.inclusions.map(String) : [],
      kneading: r.kneading === 'machine' ? 'machine' : 'hand', cold: r.cold !== false,
      ...(r.folds !== undefined ? { folds: num(r.folds, 4) } : {}), ...(r.foldGapMin ? { foldGapMin: num(r.foldGapMin, 30) } : {}),
      hydration: num(r.hydration, 0.72),
      mix: r.mix.filter((m) => m && typeof m.flour === 'string' && num(m.grams, 0) > 0).map((m) => ({ flour: m.flour, grams: m.grams })),
    }];
  });
  const customFlours = Array.isArray(raw.customFlours)
    ? raw.customFlours.filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string').map((f) => ({ id: f.id, name: f.name, absorption: num(f.absorption, 0) }))
    : [];
  return { app: 'machmetzet', v: 1, recipes, customFlours };
}

const HEAD = ['name', 'fav', 'loaves', 'rolls', 'weight', 'shape', 'kneading', 'cold', 'folds', 'foldGapMin', 'hydration', 'flours', 'inclusions'];
const q = (s: string) => (/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** One row per recipe; flours as `id:grams` and inclusions joined by `|`, so the file opens cleanly in a spreadsheet. */
export function toCsv(recipes: RecipeData[]): string {
  const rows = recipes.map((r) => [
    r.name, r.fav ? '1' : '0', r.loaves, r.rolls, r.weight, r.shape, r.kneading, r.cold ? '1' : '0', r.folds ?? 4, r.foldGapMin ?? '',
    Math.round(r.hydration * 100), r.mix.map((m) => `${m.flour}:${m.grams}`).join('|'), r.inclusions.join('|'),
  ].map((c) => q(String(c))).join(','));
  return [HEAD.join(','), ...rows].join('\n');
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') inQ = false; else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

export function fromCsv(text: string): RecipeData[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const head = parseCsvLine(lines[0] ?? '');
  if (!head.includes('name') || !head.includes('flours')) throw new RangeError('not a recipe csv');
  return lines.slice(1).flatMap((l, k): RecipeData[] => {
    const c = Object.fromEntries(head.map((h, i) => [h, parseCsvLine(l)[i] ?? '']));
    if (!c.name?.trim()) return [];
    const mix = (c.flours ?? '').split('|').flatMap((p) => {
      const [flour, g] = p.split(':');
      return flour && Number(g) > 0 ? [{ flour, grams: Number(g) }] : [];
    });
    return [{
      id: `csv${k}`, name: c.name.trim(), fav: c.fav === '1', loaves: Number(c.loaves) || 0, rolls: Number(c.rolls) || 0,
      weight: Number(c.weight) || 900, shape: c.shape === 'tin' ? 'tin' : 'free', kneading: c.kneading === 'machine' ? 'machine' : 'hand',
      cold: c.cold !== '0', ...(c.folds ? { folds: Number(c.folds) } : {}), ...(c.foldGapMin ? { foldGapMin: Number(c.foldGapMin) } : {}),
      hydration: (Number(c.hydration) || 72) / 100,
      inclusions: (c.inclusions ?? '').split('|').filter(Boolean), mix,
    }];
  });
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A single self-contained RTL page (no scripts, no external files) to send to a friend. */
export function recipeHtml(r: RecipeData, inclusionPct: Record<string, number> = {}): string {
  const total = r.mix.reduce((s, m) => s + m.grams, 0) || 1;
  const name = (id: string) => allFlours().find((f) => f.id === id)?.name ?? id;
  const flours = r.mix.map((m) => `<tr><td>${esc(name(m.flour))}</td><td>${Math.round((m.grams / total) * 100)}%</td></tr>`).join('');
  const incl = r.inclusions.map((n) => `<tr><td>${esc(n)}</td><td>${inclusionPct[n] !== undefined ? `${Math.round(inclusionPct[n]! * 100)}%` : ''}</td></tr>`).join('');
  const pieces = [r.loaves > 0 && `${r.loaves} לחמים של ${r.weight >= 1000 ? `${r.weight / 1000} ק"ג` : `${r.weight} ג'`}${r.shape === 'tin' ? ' בתבנית' : ''}`, r.rolls > 0 && `${r.rolls} לחמניות`].filter(Boolean).join(' + ');
  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(r.name)}</title>
<style>body{margin:0;background:#FFF6E5;color:#2B1D3A;font-family:Rubik,system-ui,sans-serif;line-height:1.6}main{max-width:560px;margin:0 auto;padding:20px}h1{font-size:30px;margin:8px 0}.card{background:#fff;border-radius:24px;padding:12px 18px;margin:14px 0}table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:2px solid #FFF6E5}td:last-child{text-align:left}small{color:#6B5B7A}</style></head>
<body><main><small>מחמצת לעד</small><h1>${r.fav ? '★ ' : ''}${esc(r.name)}</h1>
<p>${esc(pieces)}</p>
<div class="card"><strong>קמחים (אחוז מהקמח)</strong><table>${flours}</table></div>
<div class="card"><strong>הידרציה</strong><p>${Math.round(r.hydration * 100)}% מים מכלל הקמח</p><small>מחמצת כ־20% ומלח כ־2%, כמו בבצק רגיל</small></div>
${incl ? `<div class="card"><strong>תוספות (אחוז מהקמח)</strong><table>${incl}</table></div>` : ''}
<div class="card"><strong>שיטה</strong><p>לישה ${r.kneading === 'machine' ? 'במכונה' : 'ידנית'}, ${r.folds ?? 4} קיפולים, התפחה אחרונה ${r.cold ? 'לילה במקרר' : 'באותו יום'}.</p></div>
</main></body></html>`;
}
