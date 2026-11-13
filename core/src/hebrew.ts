/** Hebrew counts with the right singular, dual and plural: "לחם אחד", "שני לחמים", "5 לחמים". */
export const breadHe = (n: number): string => (n === 1 ? 'לחם אחד' : n === 2 ? 'שני לחמים' : `${n} לחמים`);

/** loaves as pieces: "כיכר אחת", "שתי כיכרות", "3 כיכרות" */
export const loafHe = (n: number): string => (n === 1 ? 'כיכר אחת' : n === 2 ? 'שתי כיכרות' : `${n} כיכרות`);

/** rolls: "לחמנייה אחת", "שתי לחמניות", "6 לחמניות"; any other name (pizza, bagels...) is kept as typed: the name for one, "N name" for more */
export const rollsHe = (n: number, name = 'לחמניות'): string => {
  if (name !== 'לחמניות') return n === 1 ? name : `${n} ${name}`;
  return n === 1 ? 'לחמנייה אחת' : n === 2 ? 'שתי לחמניות' : `${n} לחמניות`;
};

/** old saved titles were built as "1 לחמים": say them properly */
export const fixTitleHe = (t: string): string =>
  t
    .replace(/(^|[\s,·])1 לחמים/g, '$1לחם אחד')
    .replace(/(^|[\s,·])2 לחמים/g, '$1שני לחמים')
    .replace(/(^|[\s,·])1 לחמניות/g, '$1לחמנייה אחת')
    .replace(/(^|[\s,·])2 לחמניות/g, '$1שתי לחמניות');
