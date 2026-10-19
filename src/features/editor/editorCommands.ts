import type { Editor } from '@tiptap/core';

/** The selection bar's List button. */
export function toggleBulletList(editor: Editor): void {
  editor.chain().focus().toggleBulletList().run();
}

/** "example.com" becomes "https://example.com". Anything with a scheme is left alone. */
export function normalizeLink(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Applies the link to the selection. An empty field removes the link. */
export function applyLink(editor: Editor, input: string): void {
  const href = normalizeLink(input);
  const chain = editor.chain().focus().extendMarkRange('link');
  if (href === '') chain.unsetLink().run();
  else chain.setLink({ href }).run();
}
