// @ts-nocheck -- small renderer over trusted, build-time docs/HELP.md
// Tiny markdown -> HTML renderer for docs/HELP.md (headings, lists, tables, quotes, bold/italic/code, links).
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const slug = (s: string) =>
  s.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');

function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) =>
      u.startsWith('#') ? `<a href="${u}" data-anchor="${u.slice(1)}">${t}</a>` : `<span class="ext">${t}</span>`,
    );
}

export function renderMd(src: string): string {
  const lines = src.split('\n') as string[] & { [k: number]: string };
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i] ?? "";
    let m: RegExpMatchArray | null;
    if (!l.trim()) { i++; continue; }
    if (/^---+$/.test(l.trim())) { out.push('<hr>'); i++; continue; }
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) {
      const n = m[1].length;
      out.push(`<h${n} id="${slug(m[2])}">${inline(m[2])}</h${n}>`); i++; continue;
    }
    if (l.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|[\s:|-]+\|?$/.test(lines[i])) rows.push(lines[i].replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim()));
        i++;
      }
      const [h = [], ...b] = rows;
      out.push(`<div class="tbl"><table><thead><tr>${h.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${b
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (l.startsWith('>')) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`); continue;
    }
    const li = /^\s*([-*]|\d+\.)\s+(.*)/;
    if ((m = l.match(li))) {
      const ord = /\d/.test(m[1]);
      const items: string[] = [];
      while (i < lines.length && (lines[i].match(li) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        const mm = lines[i].match(li);
        if (mm) items.push(inline(mm[2])); else items[items.length - 1] += " " + inline(lines[i].trim());
        i++;
      }
      const t = ord ? 'ol' : 'ul';
      out.push(`<${t}>${items.map((x) => `<li>${x}</li>`).join('')}</${t}>`); continue;
    }
    const p: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||>|---|\s*([-*]|\d+\.)\s)/.test(lines[i])) p.push(lines[i++]);
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return out.join('\n');
}
