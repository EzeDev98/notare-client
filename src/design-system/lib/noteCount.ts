/** "1 note", "12 notes". */
export const noteCount = (count: number): string => `${String(count)} ${count === 1 ? 'note' : 'notes'}`;
