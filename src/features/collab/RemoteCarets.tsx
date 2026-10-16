import type { Editor } from '@tiptap/core';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Awareness } from 'y-protocols/awareness';

import { COLLAB_CARET_LABEL_MS } from '@/core/config/timings';
import { run } from '@/design-system/motion/motion';
import { fadeOut } from '@/design-system/motion/patterns';
import { absoluteOf, remotePeople, type CursorColor } from '@/features/collab/presence';

import './RemoteCarets.css';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Placed {
  key: number;
  name: string;
  colorIndex: CursorColor;
  caret: Box;
  selection: Box[];
}

const relativeTo = (rect: { left: number; top: number; width: number; height: number }, origin: DOMRect): Box => ({
  x: rect.left - origin.left,
  y: rect.top - origin.top,
  w: rect.width,
  h: rect.height,
});

/** Where every remote caret and selection is now, measured against the overlay. Reads only. */
function measure(editor: Editor, awareness: Awareness, overlay: HTMLElement): Placed[] {
  if (editor.isDestroyed) return [];
  const origin = overlay.getBoundingClientRect();
  const placed: Placed[] = [];
  try {
    const { view } = editor;
    for (const person of remotePeople(awareness)) {
      if (!person.cursor) continue;
      const head = absoluteOf(view.state, person.cursor.head);
      const anchor = absoluteOf(view.state, person.cursor.anchor);
      if (head === null || anchor === null) continue;

      const at = view.coordsAtPos(head);
      const selection: Box[] = [];
      if (anchor !== head) {
        const from = view.domAtPos(Math.min(anchor, head));
        const to = view.domAtPos(Math.max(anchor, head));
        const range = document.createRange();
        range.setStart(from.node, from.offset);
        range.setEnd(to.node, to.offset);
        for (const rect of range.getClientRects()) selection.push(relativeTo(rect, origin));
      }
      placed.push({
        key: person.clientId,
        name: person.name,
        colorIndex: person.colorIndex,
        caret: relativeTo({ left: at.left, top: at.top, width: 0, height: at.bottom - at.top }, origin),
        selection,
      });
    }
  } catch {
    return []; // The editor is not on screen yet, or a position moved: the next change measures again.
  }
  return placed;
}

const FADE_IN = { duration: '--motion-fast', easing: '--ease-out' } as const;

/** The name fades out after COLLAB_CARET_LABEL_MS without movement, and returns when the caret moves. */
function CaretLabel({ name, moved }: { name: string; moved: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const hidden = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (hidden.current) {
      el.getAnimations().forEach((animation) => {
        animation.cancel();
      });
      run(el, [{ opacity: 0 }, { opacity: 1 }], FADE_IN);
      hidden.current = false;
    }
    const timer = window.setTimeout(() => {
      fadeOut(el);
      hidden.current = true;
    }, COLLAB_CARET_LABEL_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [moved]);

  return (
    <span ref={ref} className="remote-caret__label">
      {name}
    </span>
  );
}

interface RemoteCaretsProps {
  editor: Editor;
  awareness: Awareness;
}

/**
 * Other people's carets and selections (step 16d), drawn in their own layer above the editor, never
 * inside the ProseMirror document (master pitfall 17). Nothing here writes to the editor, moves its
 * caret or scrolls it. Render this for editors only: viewers see presence avatars and no carets (O-08).
 */
export function RemoteCarets({ editor, awareness }: RemoteCaretsProps) {
  const overlay = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<Placed[]>([]);

  useEffect(() => {
    const layer = overlay.current;
    if (!layer) return undefined;
    let frame = 0;
    const schedule = (): void => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setPlaced(measure(editor, awareness, layer));
      });
    };
    awareness.on('change', schedule);
    editor.on('transaction', schedule);
    window.addEventListener('resize', schedule);
    const resize = new ResizeObserver(schedule);
    if (layer.parentElement) resize.observe(layer.parentElement);
    schedule();
    return () => {
      awareness.off('change', schedule);
      editor.off('transaction', schedule);
      window.removeEventListener('resize', schedule);
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [editor, awareness]);

  return (
    <div ref={overlay} className="remote-carets" aria-hidden="true">
      {placed.map(({ key, name, colorIndex, caret, selection }) => (
        <div
          key={key}
          className="remote-caret"
          style={{ '--caret-color': `var(--color-cursor-${String(colorIndex)})` } as CSSProperties}
        >
          {selection.map((box, index) => (
            <span
              key={index}
              className="remote-caret__selection"
              style={{ insetInlineStart: box.x, insetBlockStart: box.y, inlineSize: box.w, blockSize: box.h }}
            />
          ))}
          <span
            className="remote-caret__line"
            style={{ insetInlineStart: caret.x, insetBlockStart: caret.y, blockSize: caret.h }}
          >
            <CaretLabel name={name} moved={`${String(caret.x)}:${String(caret.y)}`} />
          </span>
        </div>
      ))}
    </div>
  );
}
