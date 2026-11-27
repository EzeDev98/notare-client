/** The bar over selected text: add a link or make a list. */
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { useLayoutEffect, useState } from 'react';

import { barIn, barOut } from '@/design-system/motion/patterns';
import { usePresence } from '@/design-system/motion/usePresence';
import { SelectionBar } from '@/design-system/ui';
import { applyLink, toggleBulletList } from '@/features/editor/editorCommands';

const EDGE = 8;

export function NoteSelectionBar({ editor }: { editor: Editor }) {
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [url, setUrl] = useState('');

  const selection = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      from: current.state.selection.from,
      to: current.state.selection.to,
      empty: current.state.selection.empty,
      focused: current.isFocused,
      editable: current.isEditable,
      inList: current.isActive('bulletList'),
      href: String(current.getAttributes('link')['href'] ?? ''),
    }),
  });

  const key = `${String(selection.from)}-${String(selection.to)}`;
  const linkOpen = linkFor === key;
  const visible = selection.editable && !selection.empty && (selection.focused || linkOpen);
  const { mounted, ref: barRef } = usePresence<HTMLDivElement>(visible, { enter: barIn, exit: barOut });

  useLayoutEffect(() => {
    const bar = barRef.current;
    const container = bar?.offsetParent;
    if (!bar || !(container instanceof HTMLElement)) return;

    const box = container.getBoundingClientRect();
    const start = editor.view.coordsAtPos(selection.from);
    const end = editor.view.coordsAtPos(selection.to);
    const centre = (Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2;

    const left = Math.max(
      EDGE,
      Math.min(centre - box.left - bar.offsetWidth / 2, box.width - bar.offsetWidth - EDGE),
    );
    const above = Math.min(start.top, end.top) - box.top - bar.offsetHeight - EDGE;
    const top = above < EDGE ? Math.max(start.bottom, end.bottom) - box.top + EDGE : above;

    bar.style.left = `${String(left)}px`;
    bar.style.top = `${String(top)}px`;
  }, [editor, barRef, selection.from, selection.to, linkOpen, mounted]);

  if (!mounted) return null;

  const closeLink = (): void => {
    setLinkFor(null);
    editor.chain().focus().run();
  };

  return (
    <SelectionBar
      ref={barRef}
      floating
      listActive={selection.inList}
      onLink={() => {
        setUrl(selection.href);
        setLinkFor(key);
      }}
      onList={() => {
        toggleBulletList(editor);
      }}
      linkField={
        linkOpen
          ? {
              value: url,
              onChange: setUrl,
              onApply: () => {
                applyLink(editor, url);
                setLinkFor(null);
              },
              onCancel: closeLink,
            }
          : undefined
      }
    />
  );
}
