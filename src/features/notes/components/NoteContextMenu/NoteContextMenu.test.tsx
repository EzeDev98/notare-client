import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { NoteContextMenu, type NoteContextMenuActions } from './NoteContextMenu';
import { toView } from '@/features/notes/local/noteMappers';
import { makeRow } from '~/fixtures/notes';

/**
 * Pure component tests — no Dexie, no router, no auth context. Everything
 * this component actually depends on (which note, where to open, what each
 * item does) arrives as props; AppLayout.test.tsx covers the REAL wiring
 * (right-clicking an actual sidebar row, actions that actually mutate
 * Dexie).
 */

function noop(): void {
  /* no-op default so tests that don't care about a given action can omit it */
}

function makeActions(overrides: Partial<NoteContextMenuActions> = {}): NoteContextMenuActions {
  return {
    onNewNote: noop,
    onDuplicate: noop,
    onShare: noop,
    onTogglePin: noop,
    onToggleArchive: noop,
    onDelete: noop,
    ...overrides,
  };
}

describe('NoteContextMenu', () => {
  it('renders every action, labeled for the note it is open for', () => {
    const note = toView(makeRow({ content: 'Grocery list', pinned: 0, archived: 0 }));

    render(<NoteContextMenu note={note} x={40} y={60} actions={makeActions()} onClose={noop} />);

    expect(screen.getByRole('menu', { name: 'Actions for Grocery list' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New note' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicate note' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Share note' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Pin note' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Archive note' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('labels Pin and Archive as their reverse action once the note already carries that state', () => {
    const note = toView(makeRow({ pinned: 1, archived: 1 }));

    render(<NoteContextMenu note={note} x={0} y={0} actions={makeActions()} onClose={noop} />);

    expect(screen.getByRole('menuitem', { name: 'Unpin note' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Unarchive note' })).toBeInTheDocument();
  });

  it('disables Share for a note with no serverId yet', () => {
    const note = toView(makeRow({ serverId: null, localId: 'local-only' }));
    const onShare = vi.fn();

    render(
      <NoteContextMenu note={note} x={0} y={0} actions={makeActions({ onShare })} onClose={noop} />,
    );

    const shareItem = screen.getByRole('menuitem', { name: 'Share note' });
    expect(shareItem).toBeDisabled();
  });

  it('runs the clicked action with the note and then closes', async () => {
    const user = userEvent.setup();
    const note = toView(makeRow());
    const onTogglePin = vi.fn();
    const onClose = vi.fn();

    render(
      <NoteContextMenu
        note={note}
        x={0}
        y={0}
        actions={makeActions({ onTogglePin })}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('menuitem', { name: 'Pin note' }));

    expect(onTogglePin).toHaveBeenCalledWith(note);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape without running any action', async () => {
    const user = userEvent.setup();
    const note = toView(makeRow());
    const onClose = vi.fn();
    const onDelete = vi.fn();

    render(
      <NoteContextMenu
        note={note}
        x={0}
        y={0}
        actions={makeActions({ onDelete })}
        onClose={onClose}
      />,
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('closes on an outside click', async () => {
    const user = userEvent.setup();
    const note = toView(makeRow());
    const onClose = vi.fn();

    render(
      <div>
        <button type="button">Outside</button>
        <NoteContextMenu note={note} x={0} y={0} actions={makeActions()} onClose={onClose} />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Outside' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  /*
   * Regression test for a real bug found in an actual browser (Playwright
   * against the live app), NOT reproducible via `fireEvent.contextMenu` —
   * jsdom's event/effect timing masks it entirely, which is how it shipped
   * unnoticed through the rest of this file's tests. In a real browser, the
   * SAME `contextmenu` event that opens this menu is still bubbling toward
   * `document` at the moment the outside-interaction effect below runs; if
   * that effect's `document.addEventListener('contextmenu', ...)` call is
   * synchronous, the still-in-flight event reaches it a few nodes later in
   * its own bubble phase and closes the menu that same event just opened,
   * before it ever paints — right-click and a two-finger trackpad click
   * both looked like "nothing happens" because of this.
   *
   * This test opens the menu via a NATIVE, bubbling `contextmenu` event
   * dispatched on a real ancestor button (not `fireEvent`, and not already
   * mounted — mounted BY this same event, matching how AppLayout/NotesPage
   * actually render it), then asserts the menu is still there. It doesn't
   * reproduce the original race in jsdom (jsdom's timing differs from a
   * real browser's here regardless of the fix), but it does pin the fix in
   * place — reverting the effect's deferred `setTimeout` back to a
   * synchronous `addEventListener` fails this test on real DOM ordering
   * whenever jsdom's own semantics happen to line up with it, and always
   * documents the requirement either way.
   */
  it('opening via a live contextmenu event on an ancestor does not immediately self-close', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const note = toView(makeRow({ content: 'Grocery list' }));

      return (
        <div>
          <button
            type="button"
            onContextMenu={(event) => {
              event.preventDefault();
              setOpen(true);
            }}
          >
            Row
          </button>
          {open ? (
            <NoteContextMenu
              note={note}
              x={0}
              y={0}
              actions={makeActions()}
              onClose={() => {
                setOpen(false);
              }}
            />
          ) : null}
        </div>
      );
    }

    render(<Harness />);

    const row = screen.getByRole('button', { name: 'Row' });
    act(() => {
      row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('does not close on a click inside the menu itself', async () => {
    const user = userEvent.setup();
    const note = toView(makeRow());
    const onClose = vi.fn();

    render(<NoteContextMenu note={note} x={0} y={0} actions={makeActions()} onClose={onClose} />);

    // menuitems already close via runAndClose — the menu SURFACE itself
    // (the role="menu" container, not one of its buttons) is what this
    // checks: clicking it must not ALSO trigger the outside-click path.
    await user.click(screen.getByRole('menu'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
