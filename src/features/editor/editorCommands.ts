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

/**
 * The + menu's Checklist. A blank line (other than the first, which is the
 * title) becomes a checklist item. Otherwise a new checklist item is added after
 * the current block and the caret goes into it.
 */
export function insertChecklist(editor: Editor): void {
  const { $from } = editor.state.selection;
  const blankTopLevelParagraph =
    $from.depth === 1 && $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0;
  const isFirstBlock = $from.index(0) === 0;

  if (blankTopLevelParagraph && !isFirstBlock) {
    editor.chain().focus().toggleTaskList().run();
    return;
  }

  editor
    .chain()
    .focus()
    .insertContentAt($from.after(1), {
      type: 'taskList',
      content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }],
    })
    .run();
}
