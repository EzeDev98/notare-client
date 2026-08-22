import { describe, expect, it } from 'vitest';

import { deriveNoteLabel, EMPTY_NOTE_LABEL } from '@/features/notes/local/noteLabel';

describe('deriveNoteLabel', () => {
  it('labels a brand new note "New Note", not "Untitled"', () => {
    expect(deriveNoteLabel('')).toEqual({ label: EMPTY_NOTE_LABEL, remainder: '' });
  });

  it('treats whitespace-only content the same as no content', () => {
    expect(deriveNoteLabel('   \n\t\n   ')).toEqual({ label: EMPTY_NOTE_LABEL, remainder: '' });
  });

  it('uses the only line as the label when there is just one', () => {
    expect(deriveNoteLabel('Grocery list')).toEqual({ label: 'Grocery list', remainder: '' });
  });

  it('trims surrounding whitespace on a single-line note', () => {
    expect(deriveNoteLabel('  Grocery list  ')).toEqual({
      label: 'Grocery list',
      remainder: '',
    });
  });

  it('splits the first line off as the label and collapses the rest into the remainder', () => {
    expect(deriveNoteLabel('Grocery list\nMilk\nEggs\nBread')).toEqual({
      label: 'Grocery list',
      remainder: 'Milk Eggs Bread',
    });
  });

  it('skips leading blank lines to find the label', () => {
    // .trim() on the whole string already eats leading/trailing blank
    // lines, so this and the "only line" case land on the same result —
    // asserted separately because that collapsing is the load-bearing
    // behaviour a naive `content.split('\n')[0]` would get wrong.
    expect(deriveNoteLabel('\n\n  Grocery list\nMilk')).toEqual({
      label: 'Grocery list',
      remainder: 'Milk',
    });
  });

  it('collapses blank lines and extra whitespace inside the remainder to single spaces', () => {
    expect(deriveNoteLabel('Grocery list\n\n  Milk  \n\n\nEggs')).toEqual({
      label: 'Grocery list',
      remainder: 'Milk Eggs',
    });
  });

  it('returns an empty remainder when the note is a single line, even with trailing newlines', () => {
    expect(deriveNoteLabel('Grocery list\n\n\n')).toEqual({
      label: 'Grocery list',
      remainder: '',
    });
  });
});
