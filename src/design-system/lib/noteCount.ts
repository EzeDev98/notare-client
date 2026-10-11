/** "1 note", "12 notes". The one wording for a count of notes. */
export const noteCount = (count: number): string => `${String(count)} ${count === 1 ? 'note' : 'notes'}`;
