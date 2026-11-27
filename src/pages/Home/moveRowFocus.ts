/** Moves focus between list rows with the arrow keys. */
import type { KeyboardEvent } from 'react';

const STEP: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

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
