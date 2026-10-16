/** How many words a text has: runs of non-space characters. Used to say how much someone added. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}
