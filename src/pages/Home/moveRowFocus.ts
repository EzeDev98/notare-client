import type { KeyboardEvent } from 'react';

const STEP: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

/** Arrow keys move focus between rows. Enter and Space open a row (NoteRow handles those). */
export function moveRowFocus(event: KeyboardEvent<HTMLElement>): void {
  const step = STEP[event.key];
  if (step === undefined) return;
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>('.n-row')];
  const at = rows.findIndex((row) => row === document.activeElement);
  const next = at === -1 ? undefined : rows[at + step];
  if (!next) return;
  event.preventDefault();
  next.focus();
}
