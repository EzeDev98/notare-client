/* eslint-disable max-lines -- TODO(step 11): delete or split, listed in docs/decisions.md */
import {
  type AnimationEvent,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';
import { Link, NavLink, useLocation, useMatch, useNavigate } from 'react-router';
import {
  ArchiveIcon,
  BarsIcon,
  BellIcon,
  BookIcon,
  CogIcon,
  DesktopIcon,
  EditIcon,
  ExclamationTriangleIcon,
  HandshakeIcon,
  MoonIcon,
  PencilAltIcon,
  SearchIcon,
  ShareSquareIcon,
  SunIcon,
  TimesIcon,
  TrashIcon,
  UndoIcon,
  UsersIcon,
} from '@patternfly/react-icons';

import { navItems, type NavItem } from '@/app/layouts/navItems';
import { AnimatedRoutes } from '@/app/AnimatedRoutes';
import { useAuth } from '@/app/providers/auth-context';
import { useTheme } from '@/app/providers/theme-context';
import type { ThemePreference } from '@/lib/theme/theme';
import { useFoldersPanel } from '@/app/layouts/useFoldersPanel';
import { useSidebarWidth } from '@/app/layouts/useSidebarWidth';
import { MobileNotesPanel } from '@/app/layouts/MobileNotesPanel';
import { SettingsPanel } from '@/app/layouts/SettingsPanel';
import { AnimatedSidebarNoteList } from '@/features/notes/components/AnimatedSidebarNoteList/AnimatedSidebarNoteList';
import {
  NoteContextMenu,
  type NoteContextMenuActions,
} from '@/features/notes/components/NoteContextMenu/NoteContextMenu';
import { useDeviceReset } from '@/features/auth/hooks/useDeviceReset';
import { useDeleteNote } from '@/features/notes/hooks/useDeleteNote';
import { useNoteActions } from '@/features/notes/hooks/useNoteActions';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { gateway } from '@/core/adapter';
import {
  createLocalNote,
  fromNoteResponse,
  toView,
  type NoteView,
} from '@/features/notes/local/noteMappers';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { isEmptyNote } from '@/features/notes/local/isEmptyNote';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { isOffline } from '@/lib/http/errors';
import { NotificationsPanel } from '@/features/notifications/components/NotificationsPanel/NotificationsPanel';
import { useSync } from '@/sync/useSync';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { ThemeToggle } from '@/design-system/components/ThemeToggle/ThemeToggle';
import { Modal } from '@/design-system/components/Modal/Modal';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import './AppLayout.css';
import { ROUTES, ROUTE_PATTERNS } from '@/app/routes';
import { LEGACY_NOTE_LIFECYCLE_DELAY_MS as NOTE_LIFECYCLE_DELAY_MS } from '@/core/config/timings';

/*
 * Archived, Trash, Voice, Shared with me, Collaboration, Account — the FOLDERS PANEL's
 * contents now (moved out of the note-list sidebar's own footer). Still
 * defined here rather than in navItems.tsx: navItems.tsx no longer drives
 * any rendered nav — the <1024px compact nav mirrors this same six-item
 * list instead (see compactNavItems, below foldersNavItems). navItems.tsx
 * is only read from, below, to reuse two of its existing icon/label pairs
 * (Voice, Account) rather than redefining them.
 */
/*
 * A deliberate beat around every note creation and every auto-delete of an
 * abandoned empty note — both act on Dexie, and the sidebar's FLIP
 * animation (AnimatedSidebarNoteList) is entirely reactive to THAT write,
 * so writing instantly made the slide read as an abrupt cut rather than
 * something that just happened.
 *
 * THE SAME DELAY, BUT PLACED ON OPPOSITE SIDES of the write, and that's
 * deliberate, not an inconsistency — the goal in both cases is that the
 * INSTANT change (an editor swapping to a different note — unavoidably
 * abrupt, there is no good way to animate that) and the ANIMATED change
 * (a row sliding in or out of the sidebar) never land on the same frame.
 * Landing together is what reads as jankier than either looks alone.
 *
 * Auto-delete already had the right shape without trying: navigating to
 * the note you actually clicked is instant and unrelated to this delay at
 * all, so by construction it happens first; delaying the write (below)
 * just holds the OLD note's exit animation back until well after that
 * settles, so the two never compete for attention at once.
 *
 * Creation has no such note to instantly reveal — there is nothing to
 * navigate to before the write happens. So here the write goes first,
 * unblocked, and starts the sidebar's enter animation immediately; THIS
 * delay instead sits between that write and the navigate() that swaps the
 * main pane over to it, so the instant swap lands while the sidebar
 * animation is already a beat into its own motion rather than starting in
 * the same frame as it.
 */
// Value: LEGACY_NOTE_LIFECYCLE_DELAY_MS in core/config/timings.ts (removed by U-02).

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const desktopOnlyItems: NavItem[] = [
  {
    to: ROUTES.legacy.archived(),
    label: 'Archived',
    icon: <ArchiveIcon aria-hidden="true" />,
  },
  {
    to: ROUTES.legacy.trash(),
    label: 'Trash',
    icon: <TrashIcon aria-hidden="true" />,
  },
];

// Everything BUT Notes, plus Archived/Trash — the folders panel's full
// contents. Derived here rather than edited into navItems.tsx: navItems
// itself stays untouched, still exactly the historical four-item list
// (Notes/Voice/Notifications/Account) it always was — it no longer drives
// any nav on its own (see compactNavItems' own comment, below
// foldersNavItems, for what does).
//
// Shared with me is NOT part of navItems (that array never had it, and
// isn't edited to add it) — it's inserted here directly, between
// voiceNotesItem and collaborationItem in foldersNavItems below, so it
// picks up the same NavLink rendering as everything else in this panel
// without touching navItems.tsx at all.
const sharedWithMeItem: NavItem = {
  to: ROUTES.legacy.shared(),
  label: 'Shared with me',
  icon: <UsersIcon aria-hidden="true" />,
};

const voiceNotesItem: NavItem = {
  ...navItems.find((item) => item.to === ROUTES.legacy.voice())!,
  label: 'Voice notes',
};

const collaborationItem: NavItem = {
  to: ROUTES.legacy.collaborations(),
  label: 'Collaborations',
  icon: <HandshakeIcon aria-hidden="true" />,
};

const accountItem: NavItem = {
  ...navItems.find((item) => item.to === ROUTES.legacy.accountSessions())!,
  label: 'Accounts',
};

const foldersNavItems = [
  voiceNotesItem,
  sharedWithMeItem,
  collaborationItem,
  ...desktopOnlyItems,
  accountItem,
];

/*
 * The compact nav (icon rail at 640-1023px, bottom bar below 640px - see
 * Step 5) renders these same six destinations, in the same order, as the
 * desktop folders panel. This is a deliberate product decision (responsive
 * layout plan, Step 3): a single source of truth for "what are the six
 * destinations" shared between the two, so mobile/tablet nav can never
 * silently drift out of sync with desktop's folders panel the way the old,
 * now-deleted four-item compact nav did against navItems.tsx. If the two
 * ever need to diverge, replace this alias with its own item list built the
 * same way foldersNavItems is above - do not fork the six item objects
 * themselves.
 */
const compactNavItems = foldersNavItems;

/**
 * The authenticated application shell.
 *
 * Three layouts from one DOM structure, entirely in CSS:
 *   < 640px    bottom bar
 *   640-1023   icon-only rail
 *   >= 1024    sidebar with labels
 *
 * No JavaScript, no resize listeners, no state. A media query has no render
 * cost and cannot get out of sync with the viewport, which a
 * useWindowWidth hook can and does — it is wrong on the first paint and again
 * on every orientation change until the listener fires.
 *
 * STEP 4D wraps this route's element in <RequireAuth>.
 *
 * THE SIDEBAR NOTE LIST (desktop only). At >=1024px, "Notes" no longer
 * exists as a nav destination — the sidebar itself lists every note live,
 * with a "New note" entry pinned at the top, Archived/Trash/Voice/Shared
 * with me/Account pinned at the bottom below the scrollable list, and the
 * theme toggle below that.
 *
 * ONLY at >=1024px. A live, scrollable note list cannot fit in a 56px
 * icon rail or a mobile bottom bar without redesigning those layouts
 * outright — so <1024px shows `.app-shell__compact-nav` instead: the same
 * six destinations as the desktop folders panel (Voice, Shared with me,
 * Collaborations, Archived, Trash, Account — see compactNavItems above),
 * not the historical four-item navItems.tsx list. `/notifications` and
 * `/search` have no persistent nav entry at any breakpoint (reached via
 * the toolbar's bell/search controls instead) but remain fully reachable
 * by direct URL, same as every other route — nothing was removed, only
 * which nav links point where.
 */

/*
 * The tablet rail's theme button (below) cycles through these in order on
 * each click, wrapping back to the start after System — module scope
 * since it's a fixed constant, not something that needs to be recreated
 * every render.
 */
const THEME_CYCLE: ThemePreference[] = ['light', 'dark', 'system'];

export function AppLayout() {
  const navigate = useNavigate();

  // `preference`, not `resolved` — the tablet rail's theme button (Step 13)
  // is a direct 3-way cycle now (Light -> Dark -> System -> Light), and
  // cycling needs to know which of the three is currently picked, not just
  // which of the two is on screen (ThemeContextValue's own doc comment:
  // `resolved` only ever says "light" or "dark", never "system").
  const { preference: themePreference, setPreference: setThemePreference } = useTheme();

  /*
   * Drag-to-resize (>=1024px only — the handle below is hidden at every
   * other breakpoint via CSS). --sidebar-width drives BOTH
   * .app-shell's grid-template-columns and .app-shell__toolbar-nav's own
   * width, so the toolbar's left segment and the sidebar column stay
   * exactly aligned as the person drags — the same "+" intersection this
   * shell has always drawn between them, just at a width that now moves.
   *
   * dragStateRef, not more useState: the drag start point and start width
   * only matter WHILE a drag is in progress, read once per pointermove to
   * compute the next width from the pointer's absolute position (not
   * accumulated deltas, which drift under fast movement). A ref avoids a
   * render on every mousedown for a value nothing displays.
   */
  const { width: sidebarWidth, setWidth: setSidebarWidth } = useSidebarWidth();
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  /*
   * While a resize drag is in progress, the shell's width transitions must be
   * off (see the data-resizing rule at the end of AppLayout.css). They exist
   * for the folders panel sliding open/closed; during a drag each pointer move
   * restarts them, so the columns, toolbar segment and handle each trail the
   * pointer by a different amount.
   */
  function beginResizing() {
    document.documentElement.dataset['resizing'] = 'true';
  }

  function endResizing() {
    delete document.documentElement.dataset['resizing'];
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragStateRef.current = { startX: event.clientX, startWidth: sidebarWidth };
    beginResizing();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStateRef.current) return;
    const delta = event.clientX - dragStateRef.current.startX;
    setSidebarWidth(dragStateRef.current.startWidth + delta);
  }

  function handleResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  /*
   * The folders panel — Archived/Trash/Voice/Shared with me/Account, the
   * theme toggle — collapsed by default, toggled from the button at the
   * toolbar's own top-left corner (below), and drag-resizable while open
   * via its own handle, same pointer-capture pattern as the sidebar's.
   */
  const {
    isOpen: isFoldersOpen,
    toggle: toggleFolders,
    width: foldersWidth,
    setWidth: setFoldersWidth,
  } = useFoldersPanel();
  const foldersDragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  function handleFoldersResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    foldersDragStateRef.current = { startX: event.clientX, startWidth: foldersWidth };
    beginResizing();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleFoldersResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!foldersDragStateRef.current) return;
    const delta = event.clientX - foldersDragStateRef.current.startX;
    setFoldersWidth(foldersDragStateRef.current.startWidth + delta);
  }

  function handleFoldersResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    foldersDragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  // The width actually applied to the grid column — 0 while closed, so
  // the panel visually collapses to nothing rather than sitting empty at
  // its remembered width. The width itself (foldersWidth) stays whatever
  // it was dragged to, unaffected by toggling — reopening restores it.
  const appliedFoldersWidth = isFoldersOpen ? foldersWidth : 0;

  /*
   * The toolbar's Share icon acts on WHATEVER note is currently open —
   * there is no other way for a persistent, always-mounted toolbar to
   * know that, since the note id lives in a CHILD route's params
   * (/notes/:noteId, rendered through <Outlet/> below), not in
   * AppLayout's own. useMatch reads the current URL against that pattern
   * directly, which is the same thing useParams does one level down,
   * just usable from a parent.
   *
   * Only matches the bare /notes/:noteId route, not /notes/new or
   * /notes/:noteId/share themselves — sharing "the note you're sharing"
   * or "the note you're about to create" is not a real action.
   */
  const noteDetailMatch = useMatch(ROUTE_PATTERNS.note);
  const matchedNoteIdParam = noteDetailMatch?.params['noteId'];
  // Same validation parseNoteId (useNote.ts) applies — useMatch has no
  // concept of a numeric param, it matches any string in that segment.
  const activeNoteId =
    matchedNoteIdParam !== undefined && /^\d+$/.test(matchedNoteIdParam)
      ? matchedNoteIdParam
      : null;

  /*
   * Same reach as activeNoteId above, for the voice note detail route
   * instead — /voice/:voiceNoteId only, not /voice/:voiceNoteId/share
   * itself (sharing "the recording you're already sharing" isn't a real
   * action, same reasoning as the note side). This is what lets the
   * toolbar's one Share icon serve VoiceDetailPage too, so that page no
   * longer needs its own in-page Share link.
   */
  const voiceDetailMatch = useMatch(ROUTE_PATTERNS.legacy.voiceDetail);
  const matchedVoiceNoteIdParam = voiceDetailMatch?.params['voiceNoteId'];
  const activeVoiceNoteId =
    matchedVoiceNoteIdParam !== undefined && /^\d+$/.test(matchedVoiceNoteIdParam)
      ? matchedVoiceNoteIdParam
      : null;

  /*
   * The toolbar's Delete icon needs the same "whatever note is currently
   * open" reach as Share above, but for BOTH note routes — a note without a
   * serverId yet lives at /notes/local/:localId (see NoteCard's routing
   * comment), and it must be just as deletable as one that has synced.
   *
   * Share only needed the id (to build a Link). Delete needs the actual row
   * — useDeleteNote takes a NoteView, which carries version/updatedAt for
   * the trash toast and the server PATCH — so this reads Dexie directly
   * rather than re-deriving a NoteView from a bare id string.
   */
  const localNoteMatch = useMatch(ROUTE_PATTERNS.legacy.noteLocal);
  const activeLocalId = localNoteMatch?.params['localId'] ?? null;

  /*
   * The sidebar's "which note is open" highlight (SidebarNoteItem's own
   * `[aria-current='page']` CSS) is normally computed purely from the
   * route via NavLink — exactly right the rest of the time. It stops
   * being right during a pending creation: NOTE_LIFECYCLE_DELAY_MS holds
   * navigate() back on purpose (its own comment above explains why), so
   * for that whole window the route STILL points at whichever note is
   * being pushed down, and route-driven highlighting would keep that
   * note lavender all the way through its own slide-down instead of the
   * new note sliding in already highlighted.
   *
   * Set the instant the new row is written (so the highlight appears with
   * the row, not after), cleared the instant the real route catches up to
   * it — see the effect below. `null` means "no override, use the route
   * like normal," which is every moment other than this one.
   */
  const [pendingActiveLocalId, setPendingActiveLocalId] = useState<string | null>(null);

  const activeRouteKey = activeLocalId ?? activeNoteId;
  const previousActiveRouteKeyForPendingRef = useRef(activeRouteKey);
  useEffect(() => {
    if (previousActiveRouteKeyForPendingRef.current === activeRouteKey) return;
    previousActiveRouteKeyForPendingRef.current = activeRouteKey;
    // Whatever just settled — our own delayed navigate() landing on the
    // new note, or the user navigating somewhere else entirely during the
    // delay — the override has done its job or is now stale either way.
    setPendingActiveLocalId(null);
  }, [activeRouteKey]);

  /*
   * A newly-created local note is disposable until the user actually puts
   * something in it.
   *
   * When navigation leaves /notes/local/:localId, inspect the note we just
   * left. If it is still local-only and completely blank, remove it from
   * Dexie immediately.
   *
   * This deliberately does NOT use the editor's save lifecycle and does NOT
   * touch server-backed notes. It is purely the "I created a blank note and
   * changed my mind" navigation rule.
   */
  type ActiveNoteKey = { kind: 'local'; id: string } | { kind: 'server'; id: number };

  // Changes identity only when the active note changes, so the effect below
  // runs on exactly the same navigations as before.
  const activeNoteKey = useMemo<ActiveNoteKey | null>(() => {
    if (activeLocalId !== null) return { kind: 'local', id: activeLocalId };
    if (activeNoteId !== null) return { kind: 'server', id: Number(activeNoteId) };
    return null;
  }, [activeLocalId, activeNoteId]);

  const previousActiveNoteKeyRef = useRef<ActiveNoteKey | null>(activeNoteKey);

  useEffect(() => {
    const previous = previousActiveNoteKeyRef.current;
    const current = activeNoteKey;
    previousActiveNoteKeyRef.current = current;

    if (previous === null) return;
    if (current !== null && current.kind === previous.kind && current.id === previous.id) {
      return;
    }

    /*
     * The delay lives around the deletion only, not the ref update above —
     * that has to stay synchronous so the NEXT navigation still computes
     * the right "previous" key. A rapid second navigation away before this
     * timer fires cancels it via the cleanup below rather than deleting a
     * note that may no longer even be the blank one this effect first saw.
     */
    const timer = setTimeout(() => {
      void (async () => {
        const row =
          previous.kind === 'local'
            ? await noteRepository.getByLocalId(previous.id)
            : await noteRepository.getByServerId(previous.id);

        if (!row || row.deleted !== 0 || !isEmptyNote(row)) return;

        if (row.serverId === null) {
          await noteRepository.hardDelete(row.localId);
          return;
        }

        await noteRepository.setDeleted(row.localId, true);
        try {
          await gateway.deleteNote(row.serverId);
        } catch (error) {
          if (isOffline(error)) {
            await outboxRepository.enqueueDelete({ localId: row.localId, noteId: row.serverId });
          }
          // Otherwise: left dirty in the local trash, same "not lost,
          // just not yet reconciled" reasoning useDeleteNote's own doc
          // comment gives for a non-offline failure there.
        }
      })();
    }, NOTE_LIFECYCLE_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [activeNoteKey]);

  const activeNoteRow = useLiveQuery(async () => {
    if (activeLocalId !== null) {
      return (await noteRepository.getByLocalId(activeLocalId)) ?? null;
    }
    if (activeNoteId !== null) {
      return (await noteRepository.getByServerId(Number(activeNoteId))) ?? null;
    }
    return null;
  }, [activeLocalId, activeNoteId]);

  const deleteNote = useDeleteNote();
  const { togglePin, setArchived } = useNoteActions();

  /*
   * WHICH note a pending delete confirmation is for — not a bare boolean
   * any more. Before the sidebar's own context menu existed, this dialog
   * could only ever be opened for the toolbar's own "whatever note is
   * currently open" (activeNoteRow), so a boolean plus that one ambient row
   * was enough. The context menu's Delete item can now ask for confirmation
   * on ANY row in the list, including one that is not open at all — so the
   * note itself has to travel with the "confirm?" state, not be re-derived
   * from whatever happens to be active once the user clicks through.
   */
  const [noteToDelete, setNoteToDelete] = useState<NoteView | null>(null);

  async function handleConfirmDelete() {
    if (!noteToDelete) return;

    // Capture before the delete/navigate below can change what "active"
    // means (deleting the open note through useDeleteNote does not itself
    // navigate anywhere).
    const deletingActiveNote =
      noteToDelete.serverId !== null
        ? String(noteToDelete.serverId) === activeNoteId
        : noteToDelete.localId === activeLocalId;

    await deleteNote(noteToDelete);
    setNoteToDelete(null);

    /*
     * Only navigate away when the note that was just trashed is the one
     * currently on screen — the route it was just on now points at a
     * trashed note, same "something left the screen" case setArchived's
     * toast comment already names, except here there is nowhere left on
     * this route to redraw. /notes always has somewhere sane to land.
     *
     * A delete from the context menu on some OTHER row must NOT do this:
     * the user is reading or writing a completely different note and has
     * no reason to be bounced off it because a DIFFERENT row in the
     * sidebar was just deleted.
     */
    if (deletingActiveNote) {
      // See suppressMobileNotesCloseRef's own comment above — this
      // navigate() is the delete landing somewhere sane, not the user
      // picking a different note, so it must not close the mobile panel
      // if it happens to be open.
      suppressMobileNotesCloseRef.current = true;
      void navigate(ROUTES.notes());
    }
  }

  /*
   * Shared by the toolbar's own "New note" icon AND the sidebar context
   * menu's "New note" item — the exact same action regardless of which
   * note (if any) was right-clicked to reach it, matching the reference:
   * "New note" in a note's own menu still just creates a fresh note, it
   * is not "duplicate this note" (that is its own, separate item below).
   */
  async function handleCreateNote() {
    if (hasEmptyNote) return;
    if (authState.status !== 'authenticated' && authState.status !== 'refreshing') return;

    /*
     * Saved to the server immediately, not deferred to the first
     * keystroke. VoiceRecorder only ever mounts once a note has a
     * serverId (NoteDetailPage / LocalNoteDetailPage both gate on
     * `row.serverId !== null`), so a note that stayed local-only until
     * the user typed something left the mic invisible until that first
     * autosave round-tripped. Creating on the server up front makes the
     * mic available the instant the note opens, whether the person ever
     * types into it or not.
     *
     * Falls back to the previous local-only row when the request fails
     * (typically offline): the note still opens instantly, and the
     * ordinary create-on-first-edit path (useNoteEditor's own `save`)
     * picks it up exactly as it always has.
     */
    let row: NoteRow;
    let destination: string;
    try {
      const created = await gateway.createNote({ content: '' });
      row = fromNoteResponse(created);
      destination = ROUTES.note(created.id);
    } catch {
      row = {
        ...createLocalNote(authState.user.id),
        dirty: 0 as const,
        syncState: 'synced' as const,
      };
      destination = ROUTES.legacy.noteLocal(row.localId);
    }

    // Unblocked — this is what starts the sidebar's own enter animation for
    // the new row, immediately on click.
    await noteRepository.put(row);

    // See pendingActiveLocalId's own comment above: the new row should
    // slide in already highlighted, not pick up the highlight only once
    // navigate() below actually lands.
    setPendingActiveLocalId(row.localId);

    // See NOTE_LIFECYCLE_DELAY_MS's own comment above: held here, between
    // the write and the navigate, so the main pane's instant swap to the
    // new note lands a beat into the sidebar's animation rather than on its
    // very first frame.
    await delay(NOTE_LIFECYCLE_DELAY_MS);

    // See suppressMobileNotesCloseRef's own comment above — creating a
    // note lands on its own route as a side effect of creating it, not
    // because the user picked a different note from the list, so it
    // must not close the mobile panel if it happens to be open.
    suppressMobileNotesCloseRef.current = true;
    void navigate(destination, {
      replace: true,
      state: { skipEnterAnimation: true },
    });
  }

  /*
   * Duplicate note — a NEW note that starts out as a copy of an existing
   * one's content, not a reference to it (editing the copy afterward never
   * touches the original). Unlike New note, this one DOES carry real
   * content from the moment it's created, so unlike New note's row above it
   * is NOT written as already-synced: `createLocalNote`'s own default
   * (dirty: 1, syncState: 'pending') is exactly right here, and
   * `outboxRepository.enqueueCreate` queues the actual CREATE — the same
   * path an offline-created note's first save already takes (see that
   * method's own doc comment) — so the background sync engine picks it up
   * and pushes it to the server on its own, online or off, without this
   * handler needing to know or care which.
   */
  async function handleDuplicateNote(note: NoteView) {
    if (authState.status !== 'authenticated' && authState.status !== 'refreshing') return;
    // Duplicating an empty note would produce a second empty note while one
    // already exists — the same "only one empty note at a time" invariant
    // the toolbar's own New note icon enforces via hasEmptyNote above.
    if (isEmptyNote(note) && hasEmptyNote) return;

    const row = createLocalNote(authState.user.id, { content: note.content });

    await noteRepository.put(row);
    await outboxRepository.enqueueCreate({
      localId: row.localId,
      clientId: row.clientId,
      content: row.content,
    });

    setPendingActiveLocalId(row.localId);
    await delay(NOTE_LIFECYCLE_DELAY_MS);

    void navigate(ROUTES.legacy.noteLocal(row.localId), {
      replace: true,
      state: { skipEnterAnimation: true },
    });
  }

  /*
   * The sidebar's per-row context menu — right-click, a two-finger click on
   * a Mac trackpad, or a touch long-press, all raised as the browser's own
   * `contextmenu` event by SidebarNoteItem (its own comment explains why
   * one handler covers all three). A single slot, not a list keyed by note:
   * opening a menu for one row while another's is already open simply
   * replaces it, matching how every native context menu on the platform
   * behaves — there is never more than one open at once.
   */
  const [contextMenu, setContextMenu] = useState<{ note: NoteView; x: number; y: number } | null>(
    null,
  );

  function handleNoteContextMenu(note: NoteView, x: number, y: number) {
    setContextMenu({ note, x, y });
  }

  const noteContextMenuActions: NoteContextMenuActions = {
    onNewNote: () => {
      void handleCreateNote();
    },
    onDuplicate: (note) => {
      void handleDuplicateNote(note);
    },
    onShare: (note) => {
      if (note.serverId === null) return;
      void navigate(ROUTES.legacy.noteShare(note.serverId));
    },
    onTogglePin: (note) => {
      void togglePin(note);
    },
    onToggleArchive: (note) => {
      void setArchived(note, !note.archived);
    },
    onDelete: (note) => {
      setNoteToDelete(note);
    },
  };

  /*
   * Uncontrolled would be simpler, but the field must be CLEARABLE from
   * code too — landing back on this layout after a search shouldn't leave
   * stale text sitting in the toolbar's own box, out of sync with
   * whatever /search is actually showing.
   */
  const [toolbarSearchTerm, setToolbarSearchTerm] = useState('');

  /*
   * STEP 2B. Below 1024px the toolbar has no room for an always-visible
   * 220px search pill alongside five other icons — the pill alone
   * doesn't fit a 320px viewport next to everything else. Below 1024px
   * only, Search collapses to an icon; tapping it expands the SAME
   * form/input/handler above (toolbarSearchTerm, handleToolbarSearchSubmit
   * are completely unchanged — this only adds a visibility toggle around
   * them). At >=1024px this state is inert: the toggle button that sets
   * it is itself hidden there via CSS, and the search form's >=1024px
   * CSS rule is unconditional, so nothing here can affect desktop.
   */
  const [isToolbarSearchExpanded, setIsToolbarSearchExpanded] = useState(false);
  const toolbarSearchWrapRef = useRef<HTMLDivElement>(null);
  const toolbarSearchInputRef = useRef<HTMLInputElement>(null);

  // Land focus in the input the moment it becomes visible — otherwise a
  // keyboard/AT user who just activated the toggle has no indication
  // anything happened.
  useEffect(() => {
    if (isToolbarSearchExpanded) {
      toolbarSearchInputRef.current?.focus();
    }
  }, [isToolbarSearchExpanded]);

  // Same outside-click + Escape pattern as the notifications panel below
  // (see that state's own comment) — collapse back to the icon on
  // either, not just on submit.
  useEffect(() => {
    if (!isToolbarSearchExpanded) return;

    function handlePointerDown(event: PointerEvent) {
      if (toolbarSearchWrapRef.current?.contains(event.target as Node)) return;
      setIsToolbarSearchExpanded(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsToolbarSearchExpanded(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isToolbarSearchExpanded]);

  /*
   * Step 1 (notifications rework). The bell used to be a bare
   * `<Link to="/notifications">` — nothing to toggle, so a second click
   * did nothing and the only way "out" was navigating elsewhere or a full
   * refresh. Now it opens `NotificationsPanel` in place, and this is
   * everything responsible for closing it again.
   *
   * `notificationsRef` covers the button AND the panel together (the
   * panel renders as a sibling inside the same wrapper div below, not a
   * portal — see the panel's own CSS comment on why) — "outside" means
   * outside that whole unit, not just outside the panel, otherwise
   * clicking the bell itself while open would register as an outside
   * click and immediately reopen it.
   */
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsClosing, setNotificationsClosing] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  /*
   * Mirrors of the two state values above, kept current on every render
   * (a plain assignment during render, not an effect — mutating a ref this
   * way takes effect immediately and does not itself trigger a re-render,
   * so it's safe here). Read by requestNotificationsClose BELOW instead of
   * closing over notificationsOpen/notificationsClosing directly, which is
   * what lets that callback keep an empty dependency array and a genuinely
   * stable identity across renders.
   *
   * That stability is load-bearing, not cosmetic: the route-change effect
   * further down lists requestNotificationsClose in its own dependency
   * array (so it always calls the latest version, per the exhaustive-deps
   * rule) but is only MEANT to re-run when location.pathname actually
   * changes. Before these refs existed, requestNotificationsClose was a
   * useCallback keyed on [notificationsOpen, notificationsClosing] — a
   * brand new function identity every time either state changed. Opening
   * the panel (setNotificationsOpen(true)) is itself one of those state
   * changes, so the moment the panel opened, the route effect saw its
   * "requestNotificationsClose" dependency change, reran on that basis
   * alone (pathname hadn't moved at all), and immediately called the
   * now-passing-its-guard requestNotificationsClose() — closing the panel
   * in the same tick it opened. That's the "just flashes" bug: the enter
   * animation never got to play because the exit animation was already
   * queued a frame later. Keeping requestNotificationsClose stable removes
   * the false trigger, so the route effect now only ever fires on a real
   * pathname change, exactly as intended.
   */
  const notificationsOpenRef = useRef(notificationsOpen);
  notificationsOpenRef.current = notificationsOpen;
  const notificationsClosingRef = useRef(notificationsClosing);
  notificationsClosingRef.current = notificationsClosing;

  const requestNotificationsClose = useCallback(() => {
    if (!notificationsOpenRef.current || notificationsClosingRef.current) return;
    setNotificationsClosing(true);
  }, []);

  function handleNotificationsAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (
      event.animationName !== 'ds-notifications-panel-exit' ||
      event.target !== event.currentTarget
    ) {
      return;
    }

    setNotificationsOpen(false);
    setNotificationsClosing(false);
  }

  useEffect(() => {
    if (!notificationsOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (notificationsRef.current?.contains(event.target as Node)) return;
      requestNotificationsClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        requestNotificationsClose();
      }
    }

    // Listening only while open, not unconditionally on mount.
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationsOpen, requestNotificationsClose]);

  // Route changes use the same exit lifecycle instead of unmounting
  // the panel immediately.
  useEffect(() => {
    requestNotificationsClose();
  }, [location.pathname, requestNotificationsClose]);

  // Same idea for the expanded search toggle (2B) — landing on a new
  // route with the search overlay still open from a previous page reads
  // as stuck, not intentional.
  useEffect(() => {
    setIsToolbarSearchExpanded(false);
  }, [location.pathname]);

  function handleToolbarSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = toolbarSearchTerm.trim();
    void navigate(ROUTES.legacy.search(trimmed));
    setIsToolbarSearchExpanded(false);
  }

  /*
   * Responsive layout plan, Step 13, reworked: the tablet rail's theme
   * button used to unfold a popover in place (isThemeToggleExpanded +
   * themeToggleWrapRef + the click-outside/Escape machinery that used to
   * live here) — it's now a direct 3-way cycle instead (see the button's
   * own onClick, below), which needs no open/closed state at all, so all
   * of that is gone with it.
   */

  /*
   * Responsive layout plan, Step 13. Below 1024px there was no way to
   * reach the live note list at all (.app-shell__sidebar is desktop-only
   * by design) — this is the toggle for MobileNotesPanel, the full-screen
   * takeover that fills that gap. Mirrors notificationsOpen/
   * notificationsClosing's own open/closing-animation shape exactly (see
   * that state's own comment above for why the two booleans and the ref
   * mirrors exist) rather than a third variant of the same pattern.
   *
   * No outside-pointerdown-to-close effect, unlike notifications and the
   * search toggle: MobileNotesPanel is a full-screen takeover, not an
   * anchored popover — there is no "outside" to click while it's open.
   * Escape, its own close button, and picking a note (which navigates,
   * caught by the route-change effect below) are the three ways out.
   */
  const [isMobileNotesOpen, setIsMobileNotesOpen] = useState(false);
  const [isMobileNotesClosing, setIsMobileNotesClosing] = useState(false);
  const isMobileNotesOpenRef = useRef(isMobileNotesOpen);
  isMobileNotesOpenRef.current = isMobileNotesOpen;
  const isMobileNotesClosingRef = useRef(isMobileNotesClosing);
  isMobileNotesClosingRef.current = isMobileNotesClosing;

  /*
   * Set right before a navigate() call that is NOT "the user picked a
   * note from the list" — creating a note (below) and deleting the
   * active note (handleConfirmDelete) both land on a new route too, as
   * a side effect of what they actually do, not because the person
   * tapped a row while this panel happened to be open. The pathname
   * effect below reads and clears this once, so only that one
   * navigation is exempted — the very next real navigation (picking a
   * note) still closes the panel normally.
   */
  const suppressMobileNotesCloseRef = useRef(false);

  const requestMobileNotesClose = useCallback(() => {
    if (!isMobileNotesOpenRef.current || isMobileNotesClosingRef.current) return;
    setIsMobileNotesClosing(true);
  }, []);

  function handleMobileNotesAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    // Two different close animations can fire here depending on width:
    // `-exit` at 640-1023px (the original full-screen dialog, unchanged),
    // `-slide-out` below 640px (MobileNotesPanel.css's newer 50%-width
    // left slide-in). Recognizing only one of them meant the other left
    // isMobileNotesClosing stuck at `true` forever below 640px, which
    // permanently blocked the toolbar button's own `if (isMobileNotesClosing)
    // return;` guard from ever reopening the panel after the first close.
    if (
      (event.animationName !== 'ds-mobile-notes-panel-exit' &&
        event.animationName !== 'ds-mobile-notes-panel-slide-out') ||
      event.target !== event.currentTarget
    ) {
      return;
    }

    setIsMobileNotesOpen(false);
    setIsMobileNotesClosing(false);
  }

  useEffect(() => {
    if (!isMobileNotesOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        requestMobileNotesClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileNotesOpen, requestMobileNotesClose]);

  // Picking a note navigates — same "route change closes the overlay"
  // reasoning as notifications' and search's own identical effects above.
  // Skipped once when suppressMobileNotesCloseRef says this particular
  // pathname change was create/delete, not a row actually being picked —
  // see that ref's own comment above.
  useEffect(() => {
    if (suppressMobileNotesCloseRef.current) {
      suppressMobileNotesCloseRef.current = false;
      return;
    }
    requestMobileNotesClose();
  }, [location.pathname, requestMobileNotesClose]);

  /*
   * Outside-tap-to-close. This panel's own top comment says there is no
   * "outside" to click while it's open — true at 640-1023px, where it's
   * still the original full-screen dialog, but no longer true below
   * 640px: MobileNotesPanel.css's 50%-width slide-in leaves the other
   * half of the screen (the editor, right behind it) visible and
   * tappable, and nothing was closing the panel when that half was
   * tapped. Uses a class lookup rather than a ref, unlike the
   * notifications popover's identical-shaped effect above — there is no
   * single wrapping element to put a ref on here, since this panel's own
   * trigger button lives across the tree in the toolbar, not right next
   * to it.
   */
  useEffect(() => {
    if (!isMobileNotesOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('.mobile-notes-panel')) return;
      requestMobileNotesClose();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isMobileNotesOpen, requestMobileNotesClose]);

  /*
   * Responsive layout plan, next step. The mobile bottom bar's far-right
   * slot (Settings, replacing a direct Account link there — see
   * accountItem's sibling markup below) opens this: a slide-in panel from
   * the right, same open/closing-animation shape as
   * isMobileNotesOpen/isMobileNotesClosing and notificationsOpen/
   * notificationsClosing above (see either's own comment for why the two
   * booleans plus ref mirrors exist) rather than a fourth variant of the
   * same pattern.
   */
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsClosing, setIsSettingsClosing] = useState(false);
  const isSettingsOpenRef = useRef(isSettingsOpen);
  isSettingsOpenRef.current = isSettingsOpen;
  const isSettingsClosingRef = useRef(isSettingsClosing);
  isSettingsClosingRef.current = isSettingsClosing;

  const requestSettingsClose = useCallback(() => {
    if (!isSettingsOpenRef.current || isSettingsClosingRef.current) return;
    setIsSettingsClosing(true);
  }, []);

  function handleSettingsAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.animationName !== 'ds-settings-panel-exit' || event.target !== event.currentTarget) {
      return;
    }

    setIsSettingsOpen(false);
    setIsSettingsClosing(false);
  }

  useEffect(() => {
    if (!isSettingsOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        requestSettingsClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsOpen, requestSettingsClose]);

  // Same reasoning as MobileNotesPanel's own identical effect above —
  // navigating to a note (e.g. via the Settings panel's Account link)
  // shouldn't leave this overlay sitting open on top of the new route.
  useEffect(() => {
    requestSettingsClose();
  }, [location.pathname, requestSettingsClose]);

  // Outside-tap-to-close — same reasoning and same class-lookup approach
  // as MobileNotesPanel's own identical effect above (this panel's own
  // trigger button also lives across the tree, in the mobile bottom bar,
  // not right next to the panel). "Reset this device" doesn't fight this:
  // its own row already calls onClose() before opening the confirmation
  // modal (SettingsPanel.tsx's own comment on that), so by the time that
  // modal exists this panel is already closing.
  useEffect(() => {
    if (!isSettingsOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('.settings-panel')) return;
      requestSettingsClose();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isSettingsOpen, requestSettingsClose]);

  /*
   * Here, not in AuthProvider: this component only ever mounts for an
   * authenticated session (RequireAuth wraps its route), so "the shell
   * mounted" already means "we have a session worth syncing for" — no
   * separate check needed. It also naturally stops on logout: the shell
   * unmounts, the effect's cleanup runs, and there is no dangling listener
   * trying to sync with no session behind it.
   *
   * ownerId comes from auth context the same way useNotes reads it (7A) —
   * pull.ts needs it the moment a brand-new row is written, not whenever a
   * later screen happens to ask.
   */
  const { state: authState } = useAuth();
  const ownerId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;
  useSync(ownerId);

  /*
   * 8F. Same restraint the conflict banner and SaveIndicator both already
   * use: 'idle' (the resting state — last run succeeded, nothing pending)
   * shows NOTHING. A permanent "Synced" pill on every screen is chrome
   * competing with content for a fact nobody asked about.
   *
   * 'syncing' now shows nothing either, deliberately, same as 'idle': the
   * engine (sync/engine.ts) fires a run on app start, every debounced local
   * edit, tab-focus regain, the `online` event, and a 60s background poll —
   * all routine, and all normally near-instant. Surfacing every one of
   * those as a visible "Syncing…" pill was flashing on/off constantly
   * during ordinary use, not just for the rare slow run this was meant to
   * cover. 'offline' / 'error' are the only states still worth a line of
   * text — real conditions, not routine background activity.
   */
  const syncStatus = useSyncStatus();
  const syncMessage =
    syncStatus.status === 'offline'
      ? { label: "Offline — you're working locally", tone: 'warn' as const }
      : syncStatus.status === 'error'
        ? { label: 'Sync trouble — retrying', tone: 'danger' as const }
        : null;

  /*
   * "Reset this device" — the sidebar (directly under Accounts, below)
   * only needs `requestDeviceReset` for its own click handler; the rest
   * of this state machine (confirm, sync, confirm again if unsynced
   * changes remain, erase) lives in the hook itself, shared with nothing
   * else — SessionsPage used to own an identical copy of this before it
   * moved here. See useDeviceReset's own doc comment.
   */
  const {
    confirmation: resetConfirmation,
    resetStage: deviceResetStage,
    requestReset: requestDeviceReset,
    closeConfirmation: closeDeviceResetConfirmation,
    handleReset: handleDeviceReset,
  } = useDeviceReset();

  // Same hook, same query the "Notes" list already used (archived: false
  // by default) — the sidebar list and NotesLandingPage read the same
  // live Dexie query, so there is exactly one source of truth for "what
  // are my notes" and the two never disagree.
  const { notes } = useNotes();

  // NOT restricted to serverId === null any more: NewNotePage now saves a
  // new note to the server immediately on open (Option A — the voice
  // recorder needs a real noteId right away), so a genuinely empty note is
  // no longer necessarily a local-only one. "One empty note at a time"
  // has to mean any empty note, synced or not, or this guard would let a
  // second one through the moment the first one round-trips.
  const emptyNote = notes?.find((note) => isEmptyNote(note));

  const hasEmptyNote = emptyNote !== undefined;

  // Shared by the toolbar's own Delete icon AND MobileNotesPanel's new
  // mobile header (Step: mobile slide-in) — the exact same "whatever note
  // is currently open" action regardless of which control reached it.
  function handleDeleteActiveNote() {
    if (!activeNoteRow) return;
    setNoteToDelete(toView(activeNoteRow));
  }

  return (
    <div
      className="app-shell"
      data-folders-open={isFoldersOpen}
      style={
        {
          '--sidebar-width': `${String(sidebarWidth)}px`,
          '--folders-width': `${String(appliedFoldersWidth)}px`,
        } as CSSProperties
      }
    >
      {/*
        Bug fix: sync-status and the conflict banner used to be plain
        in-flow children here, each mounting/unmounting with no grid-column/
        grid-row of its own. CSS Grid auto-placed each one into a brand-new
        implicit row every time it appeared, and since .app-shell is capped
        at 100dvh with overflow: hidden, that row could only get its height
        by shrinking the grid's one flexible row (minmax(0, 1fr)) — the row
        the sidebar lives in. The sidebar's theme toggle is bottom-pinned via
        margin-block-start: auto, so every shrink/grow visibly jumped it up
        and dropped it back down. Wrapping both in .app-shell__status-stack
        (position: fixed, in AppLayout.css) takes them out of grid/flex flow
        entirely, so mounting or unmounting either one can no longer resize
        anything else on the page.
      */}
      {syncMessage ? (
        <div className="app-shell__status-stack">
          {syncMessage ? (
            <p className="app-shell__sync-status" aria-hidden="true" data-tone={syncMessage.tone}>
              {syncMessage.label}
            </p>
          ) : null}
        </div>
      ) : null}
      {/*
        Always rendered so the region exists before it has content — same
        reasoning SaveIndicator.tsx gives for its own live region: a region
        added at the same moment as its text is frequently not announced.
        Only 'offline' and 'error' interrupt; 'syncing' is routine progress,
        exactly as SaveIndicator treats its own 'saving'.
      */}
      <p className="pf-v6-screen-reader" role="status">
        {syncMessage && syncStatus.status !== 'syncing' ? syncMessage.label : ''}
      </p>
      {/*
        Visually hidden until focused, then the first thing a keyboard user
        reaches. Without it they tab through the whole nav on every page before
        reaching content — a cost paid on every navigation, by exactly the
        people who can least afford it.
      */}
      <a className="app-shell__skip" href="#main">
        Skip to content
      </a>

      {/*
        STEP 1 of the desktop toolbar. Structural only — no icons yet.
        Empty and display:none below 1024px, same media-query-only pattern
        the rest of this three-layouts-in-one-DOM shell already uses (this
        file's own top comment). At >=1024px it becomes the full-width bar
        above BOTH the sidebar and the content, which is why it lives here
        as a sibling of nav/main rather than inside either — nothing that
        spans both columns can be a child of one of them.
      */}
      <div className="app-shell__toolbar">
        {/*
          Same 240px as .app-shell__nav's inline-size, so this segment's
          border-inline-end lines up exactly above nav's own border below
          it — the two borders read as one line crossing the toolbar's
          border-block-end, the "+" intersection at the sidebar's top
          corner in the target design, instead of two unrelated lines that
          happen to be near each other.

          Trash lives here, right-aligned against that border — the icon
          sits on the SIDEBAR's side of the intersection, matching the
          reference. Acts on whichever note is currently open, the same
          "note above `activeNoteId`" pattern the Share icon below uses —
          see the activeNoteRow comment further down for why Delete needs
          the full row rather than just an id.
        */}
        <div className="app-shell__toolbar-nav">
          {/*
            THE toggle for the folders panel — Archived/Trash/Voice/
            Shared with me/Account, the theme toggle — collapsed by
            default, opened from here. Always the first thing in the
            toolbar's top-left corner regardless of the panel's own
            state, matching the reference exactly: this button's
            position never moves, only what's behind it does.

            >=1024px only (Step 13, AppLayout.css) — .app-shell__folders
            is desktop-only by design, so below 1024px this button would
            open a panel with nothing to show. Its sibling right below
            takes the same visual slot at every OTHER width instead, for
            a destination that actually exists there.
          */}
          <button
            type="button"
            className="app-shell__toolbar-icon-btn app-shell__toolbar-icon-btn--outlined app-shell__toolbar-folders-toggle"
            aria-label={isFoldersOpen ? 'Hide folders' : 'Show folders'}
            aria-pressed={isFoldersOpen}
            onClick={toggleFolders}
          >
            <BarsIcon aria-hidden="true" />
          </button>

          {/*
            Its <1024px-only sibling (Step 13) — same visual slot, same
            icon-button styling, different job: .app-shell__sidebar's live
            note list has no other entry point below 1024px at all (the
            compact nav's six destinations are folders-panel content, not
            the notes themselves — desktop doesn't nav-link to "Notes"
            either, the sidebar just always shows it). Opens
            MobileNotesPanel, a full-screen takeover reusing that same
            note list.
          */}
          <button
            type="button"
            className="app-shell__toolbar-icon-btn app-shell__toolbar-icon-btn--outlined app-shell__toolbar-notes-toggle"
            aria-label="Browse notes"
            aria-haspopup="dialog"
            aria-expanded={isMobileNotesOpen}
            onClick={() => {
              if (isMobileNotesClosing) return;

              if (isMobileNotesOpen) {
                requestMobileNotesClose();
                return;
              }

              setIsMobileNotesClosing(false);
              setIsMobileNotesOpen(true);
            }}
          >
            <BookIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className="app-shell__toolbar-icon-btn app-shell__toolbar-icon-btn--outlined app-shell__toolbar-delete"
            aria-label="Delete note"
            disabled={activeNoteRow == null}
            onClick={() => {
              if (!activeNoteRow) return;
              setNoteToDelete(toView(activeNoteRow));
            }}
          >
            <TrashIcon aria-hidden="true" />
          </button>
        </div>

        {/*
          Compose sits on the CONTENT side of the same intersection, right
          against .app-shell__toolbar-nav's border — "beside" the trash
          icon across that line, matching the reference. A real Link to
          /notes/new, not a placeholder: that route already exists and the
          sidebar's own "New note" button already points at it, so there is
          no reason for this one to be inert too.
        */}
        <div
          className="app-shell__toolbar-main"
          data-search-expanded={isToolbarSearchExpanded || undefined}
        >
          <button
            type="button"
            className="app-shell__toolbar-icon-btn app-shell__toolbar-icon-btn--outlined app-shell__toolbar-new-note"
            aria-label="New note"
            aria-disabled={hasEmptyNote}
            data-unavailable={hasEmptyNote || undefined}
            onClick={() => {
              void handleCreateNote();
            }}
          >
            <EditIcon aria-hidden="true" />
          </button>

          {/*
            Right-aligned group, reference order: notifications, then
            share, then search against the toolbar's own trailing edge —
            Step 13 adds one more, mobile-only, AFTER search rather than
            disturbing that three-item order. Notifications is a toggle
            button now, not a Link — see the `notificationsOpen` state
            and its two effects above for why. The full `/notifications`
            page this used to link to directly still exists and is still
            reachable, both by URL and via the panel's own "View all"
            link.

            Share now does what NoteDetail's old inline "Share" text link
            used to (that link is gone — this icon replaces it entirely,
            per note above `activeNoteId`). Enabled only while a note is
            actually open: `disabled`, not omitted, so the icon's position
            in the toolbar never shifts as you navigate in and out of a
            note.
          */}
          <div className="app-shell__toolbar-actions">
            <div className="app-shell__notifications" ref={notificationsRef}>
              <button
                type="button"
                className="app-shell__toolbar-icon-btn app-shell__toolbar-icon-btn--outlined"
                aria-label="Notifications"
                aria-haspopup="dialog"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  if (notificationsClosing) return;

                  if (notificationsOpen) {
                    requestNotificationsClose();
                    return;
                  }

                  setNotificationsClosing(false);
                  setNotificationsOpen(true);
                }}
              >
                <BellIcon aria-hidden="true" />
              </button>

              {notificationsOpen || notificationsClosing ? (
                <NotificationsPanel
                  onClose={requestNotificationsClose}
                  isClosing={notificationsClosing}
                  onAnimationEnd={handleNotificationsAnimationEnd}
                />
              ) : null}
            </div>

            {activeNoteId !== null ? (
              <Link
                to={ROUTES.legacy.noteShare(activeNoteId)}
                className="app-shell__toolbar-icon-btn app-shell__toolbar-icon-btn--outlined app-shell__toolbar-share"
                aria-label="Share this note"
              >
                <ShareSquareIcon aria-hidden="true" />
              </Link>
            ) : activeVoiceNoteId !== null ? (
              <Link
                to={ROUTES.legacy.voiceShare(activeVoiceNoteId)}
                className="app-shell__toolbar-icon-btn app-shell__toolbar-icon-btn--outlined app-shell__toolbar-share"
                aria-label="Share this recording"
              >
                <ShareSquareIcon aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                className="app-shell__toolbar-icon-btn app-shell__toolbar-icon-btn--outlined app-shell__toolbar-share"
                aria-label="Share this note"
                disabled
              >
                <ShareSquareIcon aria-hidden="true" />
              </button>
            )}

            {/*
              STEP 2B — below 1024px only (see isToolbarSearchExpanded's own
              comment above). At >=1024px this toggle button is hidden via
              CSS and the form below is unconditionally visible, exactly as
              it always was — nothing here changes desktop behavior.
            */}
            <div className="app-shell__toolbar-search-wrap" ref={toolbarSearchWrapRef}>
              <button
                type="button"
                className="app-shell__toolbar-icon-btn app-shell__toolbar-icon-btn--outlined app-shell__toolbar-search-toggle"
                aria-label="Search your notes"
                aria-expanded={isToolbarSearchExpanded}
                onClick={() => {
                  setIsToolbarSearchExpanded(true);
                }}
              >
                <SearchIcon aria-hidden="true" />
              </button>

              <form
                className="app-shell__toolbar-search"
                role="search"
                onSubmit={handleToolbarSearchSubmit}
              >
                {/*
                  Internal Auth's boxed search field (SearchBar.jsx /
                  SearchBar.module.css), copied verbatim: an icon well,
                  the input, and a submit button with its own bordered
                  well — one bordered unit, not this pill's old
                  borderless icon-then-input layout.
                */}
                <span className="app-shell__toolbar-search-icon" aria-hidden="true">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="M11 11L14.5 14.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <input
                  type="search"
                  placeholder="Search"
                  aria-label="Search your notes"
                  value={toolbarSearchTerm}
                  onChange={(event) => {
                    setToolbarSearchTerm(event.target.value);
                  }}
                  ref={toolbarSearchInputRef}
                />
                <button
                  type="submit"
                  className="app-shell__toolbar-search-submit"
                  aria-label="Submit search"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3 8H13"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9 4L13 8L9 12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {/*
                  Only meaningful below 1024px (hidden via CSS at
                  >=1024px, same as the toggle button above) — desktop's
                  search pill is always visible and was never something
                  you "close".
                */}
                <button
                  type="button"
                  className="app-shell__toolbar-search-close"
                  aria-label="Close search"
                  onClick={() => {
                    setIsToolbarSearchExpanded(false);
                  }}
                >
                  <TimesIcon aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/*
        THE FOLDERS PANEL — >=1024px only, collapsed by default. Its own
        grid column (--folders-width, 0 while closed), separate from the
        note-list sidebar below rather than a section within it: this is
        a distinct region (account-level navigation — Archived, Trash,
        Voice, Shared with me, Account, the theme toggle) that can be
        hidden entirely, where the note list underneath it cannot.
        `inert` while closed — not just clipped via overflow:hidden on
        the CSS side — so its links are neither focusable nor announced
        while the panel is width:0 and visually gone; CSS alone hides
        content but does not remove it from the tab order or a screen
        reader's view.
      */}
      <nav className="app-shell__folders" aria-label="Folders" inert={!isFoldersOpen}>
        <ul className="app-shell__bottom-nav" role="list">
          {foldersNavItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} className="app-shell__nav-link">
                <span className="app-shell__nav-icon">{item.icon}</span>
                <span className="app-shell__nav-label">{item.label}</span>
              </NavLink>
            </li>
          ))}

          {/*
            "Reset this device" — same destination and same div[role=button]
            pattern as the compact nav's own copy of this item, reused here
            so the desktop folders panel (>=1024px) has the same escape
            hatch below Accounts that the mobile slide-in already does.
          */}
          <li>
            <div
              role="button"
              tabIndex={0}
              className="app-shell__nav-link"
              onClick={requestDeviceReset}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  requestDeviceReset();
                }
              }}
            >
              <span className="app-shell__nav-icon">
                <UndoIcon aria-hidden="true" />
              </span>
              <span className="app-shell__nav-label">Reset this device</span>
            </div>
          </li>
        </ul>

        {/*
          The one control for useTheme() in the whole app — see
          ThemeToggle's own doc comment. Placed below the nav group
          rather than inside .app-shell__bottom-nav's <ul>: it isn't a
          navigation destination, it's a setting, and mixing the two
          into one semantic list would tell a screen reader "here are
          five links" for something that is five links and a radio
          group.
        */}
        <div className="app-shell__theme-toggle">
          <ThemeToggle />
        </div>
      </nav>

      {/*
        The folders panel's OWN resize handle — only rendered while open;
        dragging the edge of a width:0 panel has nothing to drag.
      */}
      {isFoldersOpen ? (
        <div
          className="app-shell__folders-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize folders panel"
          onPointerDown={handleFoldersResizePointerDown}
          onPointerMove={handleFoldersResizePointerMove}
          onPointerUp={handleFoldersResizePointerUp}
          onLostPointerCapture={endResizing}
        />
      ) : null}

      {/*
        Nav is FIRST in the DOM at every breakpoint and moves to the bottom
        visually on mobile via flex `order`.

        The trade: keyboard order follows the DOM, so on mobile a keyboard user
        reaches the bottom bar before the content. Unusual, but consistent
        across breakpoints and answered by the skip link above. Putting content
        first would fix mobile and give desktop a stranger problem — Tab
        reaching the sidebar only AFTER the entire page.
      */}
      <nav className="app-shell__nav" aria-label="Main">
        {/*
          COMPACT NAV — visible <1024px only (icon rail 640-1023px, bottom
          bar below 640px; gated by AppLayout.css, not this markup — see
          the responsive layout plan's Steps 6-8 for each range's own
          direction/spacing/positioning rules).

          Same six destinations as the desktop folders panel below
          (compactNavItems, aliased directly to foldersNavItems — see that
          constant's own comment above), rendered with the identical
          NavLink/aria-current pattern the folders panel already uses, so
          active-route highlighting can't drift between the two navs.

          `aria-label` is set on this <ul> itself rather than wrapping it in
          a second, nested <nav> — this element already has one landmark
          ("Main"), and the sidebar note list below is ALSO a list of links,
          so the <ul> needs its own accessible name to stay unambiguous to
          assistive tech and to test queries alike.
        */}
        <ul className="app-shell__compact-nav" role="list" aria-label="Primary navigation">
          {compactNavItems.slice(0, -1).map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} className="app-shell__nav-link">
                <span className="app-shell__nav-icon">{item.icon}</span>
                <span className="app-shell__nav-label">{item.label}</span>
              </NavLink>
            </li>
          ))}

          {/*
            The Account slot, rendered TWICE and CSS-swapped by
            breakpoint (AppLayout.css) rather than in JS — same "one DOM,
            media queries decide" rule this whole shell already follows
            (this file's own top comment). Below 640px the bottom bar
            shows Settings instead of a direct Account link; Account
            itself is still reachable from inside the panel Settings
            opens (SettingsPanel). At 640px+ this reverts to the plain
            Account link every other compact-nav item already uses.
          */}
          <li>
            <NavLink to={accountItem.to} className="app-shell__nav-link app-shell__account-link">
              <span className="app-shell__nav-icon">{accountItem.icon}</span>
              <span className="app-shell__nav-label">{accountItem.label}</span>
            </NavLink>
            <button
              type="button"
              className="app-shell__nav-link app-shell__settings-toggle"
              aria-label={isSettingsOpen ? 'Close settings' : 'Settings'}
              aria-haspopup="dialog"
              aria-expanded={isSettingsOpen}
              onClick={() => {
                if (isSettingsClosing) return;

                if (isSettingsOpen) {
                  requestSettingsClose();
                  return;
                }

                setIsSettingsClosing(false);
                setIsSettingsOpen(true);
              }}
            >
              <span className="app-shell__nav-icon">
                <CogIcon aria-hidden="true" />
              </span>
              <span className="app-shell__nav-label">Settings</span>
            </button>
          </li>
        </ul>

        {/*
          The tablet rail's own theme control — 640-1023px only
          (AppLayout.css). The theme control's toolbar home is gone at
          every width now: >=1024px always kept ThemeToggle live in the
          folders panel below, and <640px now reaches it through the
          Settings slide-in instead (SettingsPanel). This fills the one
          remaining gap — the icon-only rail, which has neither of those.

          No popover any more: a single button that cycles
          Light -> Dark -> System -> Light on each click (THEME_CYCLE,
          below), applying immediately via setPreference exactly the way
          picking an option in ThemeToggle's own radiogroup does — rather
          than opening a menu to choose from. The icon reflects
          `preference`, not `resolved` (module comment above), so System
          gets its own Monitor icon instead of silently reading as
          whichever of light/dark it currently resolves to.
        */}
        <div className="app-shell__rail-theme-wrap">
          <button
            type="button"
            className="app-shell__nav-link app-shell__rail-theme-toggle"
            aria-label={`Change theme (currently ${themePreference})`}
            onClick={() => {
              const nextIndex = (THEME_CYCLE.indexOf(themePreference) + 1) % THEME_CYCLE.length;
              // Non-null assertion: nextIndex is always 0..THEME_CYCLE.length-1
              // via the modulo above, so this index is never actually out of
              // bounds — noUncheckedIndexedAccess just can't see that statically.
              setThemePreference(THEME_CYCLE[nextIndex]!);
            }}
          >
            <span className="app-shell__nav-icon">
              {themePreference === 'system' ? (
                <DesktopIcon aria-hidden="true" />
              ) : themePreference === 'dark' ? (
                <MoonIcon aria-hidden="true" />
              ) : (
                <SunIcon aria-hidden="true" />
              )}
            </span>
            <span className="app-shell__nav-label">Theme</span>
          </button>
        </div>

        {/* DESKTOP SIDEBAR — >=1024px only. See this file's own top comment. */}
        <div className="app-shell__sidebar">
          {/*
            `notes` is `undefined` for one instant before Dexie's first
            answer (useNotes' own doc comment on why that is distinct from
            an empty array) — rendering nothing for that instant rather
            than an empty-state message avoids a flash of "no notes" on
            every single authenticated page load.
          */}
          {notes && notes.length > 0 ? (
            <AnimatedSidebarNoteList
              notes={notes}
              activeLocalId={activeLocalId}
              activeNoteId={activeNoteId}
              pendingActiveLocalId={pendingActiveLocalId}
              onNoteContextMenu={handleNoteContextMenu}
              contextMenuNoteLocalId={contextMenu?.note.localId ?? null}
            />
          ) : null}

          {notes && notes.length === 0 ? (
            <p className="app-shell__note-list-empty">No notes yet.</p>
          ) : null}
        </div>
      </nav>

      {/*
        The drag-to-resize handle — >=1024px only (AppLayout.css hides it
        below that, same as everything else scoped to the sidebar
        breakpoint). Absolutely positioned against .app-shell rather than
        given its own grid column: a column would mean redefining
        grid-template-columns as three tracks instead of two just to fit
        a handle a few pixels wide, for no benefit over positioning it at
        the boundary the existing two-column grid already has.
      */}
      <div
        className="app-shell__resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onLostPointerCapture={endResizing}
      />

      {/*
        Step 13 — the toolbar's notes-toggle button's own panel, a
        full-screen takeover below 1024px only. Mounted only while open or
        animating closed, same "open || closing" condition
        NotificationsPanel's identical render just below already uses.
      */}
      {isMobileNotesOpen || isMobileNotesClosing ? (
        <MobileNotesPanel
          notes={notes}
          activeLocalId={activeLocalId}
          activeNoteId={activeNoteId}
          pendingActiveLocalId={pendingActiveLocalId}
          onNoteContextMenu={handleNoteContextMenu}
          contextMenuNoteLocalId={contextMenu?.note.localId ?? null}
          onClose={requestMobileNotesClose}
          isClosing={isMobileNotesClosing}
          onAnimationEnd={handleMobileNotesAnimationEnd}
          onCreateNote={() => {
            void handleCreateNote();
          }}
          onDeleteActive={handleDeleteActiveNote}
          hasActiveNote={activeNoteRow != null}
        />
      ) : null}

      {isSettingsOpen || isSettingsClosing ? (
        <SettingsPanel
          onClose={requestSettingsClose}
          isClosing={isSettingsClosing}
          onAnimationEnd={handleSettingsAnimationEnd}
          onResetDevice={requestDeviceReset}
        />
      ) : null}

      {resetConfirmation === 'reset' ? (
        <Modal
          icon={<ExclamationTriangleIcon aria-hidden="true" />}
          title="Reset this device?"
          description={
            <>
              This deletes every note, draft, and cached file this browser has stored locally, and
              signs you out.
            </>
          }
          secondaryAction={{
            label: 'Cancel',
            onClick: closeDeviceResetConfirmation,
          }}
          primaryAction={{
            label: 'Reset device',
            onClick: () => {
              void handleDeviceReset();
            },
          }}
          onClose={closeDeviceResetConfirmation}
        />
      ) : null}

      {resetConfirmation === 'reset-unsynced' ? (
        <Modal
          icon={<ExclamationTriangleIcon aria-hidden="true" />}
          title="Unsynced changes remain"
          description={
            <>
              Notare tried to sync before resetting, but some local changes still have not reached
              the server — most likely because this device is offline right now. Resetting anyway
              will permanently lose them. Cancel and try again once you are back online, or reset
              anyway and discard them.
            </>
          }
          secondaryAction={{
            label: 'Cancel',
            onClick: closeDeviceResetConfirmation,
          }}
          primaryAction={{
            label: 'Reset anyway',
            onClick: () => {
              void handleDeviceReset(true);
            },
          }}
          onClose={closeDeviceResetConfirmation}
        />
      ) : null}

      {deviceResetStage !== 'idle' ? (
        <div className="app-shell__reset-progress" role="status">
          <Spinner
            label={
              deviceResetStage === 'syncing'
                ? 'Syncing your changes before resetting…'
                : 'Erasing local data…'
            }
          />
        </div>
      ) : null}

      {noteToDelete ? (
        <Modal
          title=""
          description={
            <>
              Are you sure you want to delete
              <br />
              the selected note?
            </>
          }
          icon={<PencilAltIcon aria-hidden="true" />}
          secondaryAction={{
            label: 'Cancel',
            onClick: () => {
              setNoteToDelete(null);
            },
          }}
          primaryAction={{
            label: 'Delete',
            onClick: () => {
              void handleConfirmDelete();
            },
          }}
          onClose={() => {
            setNoteToDelete(null);
          }}
        />
      ) : null}

      {contextMenu ? (
        <NoteContextMenu
          note={contextMenu.note}
          x={contextMenu.x}
          y={contextMenu.y}
          actions={noteContextMenuActions}
          onClose={() => {
            setContextMenu(null);
          }}
        />
      ) : null}

      {/* The ONLY scroll container. A page-level scroll would drift the
          editor toolbar off-screen while writing. */}
      {/* tabIndex={-1}: focusable by RouteFocus, but not a tab stop. */}
      <main className="app-shell__main" id="main" tabIndex={-1}>
        <AnimatedRoutes fill />
      </main>
    </div>
  );
}
