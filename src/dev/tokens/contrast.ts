export type Rgb = readonly [number, number, number];

/** Reads "rgb(1, 2, 3)", "rgb(1 2 3)" or "rgba(...)" as the browser reports a computed colour. */
export function parseRgb(value: string): Rgb | null {
  const match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function toHex([r, g, b]: Rgb): string {
  const part = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
