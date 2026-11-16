/** where "save" on the starter screen should return to: the bake wizard it was opened from, if any */
let returnTo: string | null = null;
export const getReturnTo = (): string | null => returnTo;
export const setReturnTo = (h: string | null): void => { returnTo = h; };
