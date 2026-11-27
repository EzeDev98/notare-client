/** Editor commands for the selection bar. */
import type { Editor } from '@tiptap/core';

export function toggleBulletList(editor: Editor): void {
  editor.chain().focus().toggleBulletList().run();
}

export function normalizeLink(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function applyLink(editor: Editor, input: string): void {
  const href = normalizeLink(input);
  const chain = editor.chain().focus().extendMarkRange('link');
  if (href === '') chain.unsetLink().run();
  else chain.setLink({ href }).run();
}
