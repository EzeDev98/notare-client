import {
  type AnimationEvent,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router';
import {
  Archive,
  Bell,
  Handshake,
  PanelLeft,
  Search,
  Share,
  SquarePen,
  Trash2,
  NotebookPen,
  Users,
} from 'lucide-react';

import { navItems, type NavItem } from '@/app/layouts/navItems';
import { RouteFocus } from '@/app/RouteFocus';
import { RouteTransition } from '@/app/RouteTransition';
import { useAuth } from '@/app/providers/auth-context';
import { useFoldersPanel } from '@/app/layouts/useFoldersPanel';
import { useSidebarWidth } from '@/app/layouts/useSidebarWidth';
import { AnimatedSidebarNoteList } from '@/features/notes/components/AnimatedSidebarNoteList/AnimatedSidebarNoteList';
import {
  NoteContextMenu,
  type NoteContextMenuActions,
} from '@/features/notes/components/NoteContextMenu/NoteContextMenu';
import { useDeleteNote } from '@/features/notes/hooks/useDeleteNote';
import { useNoteActions } from '@/features/notes/hooks/useNoteActions';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { createLocalNote, toView, type NoteView } from '@/features/notes/local/noteMappers';
import { isEmptyNote } from '@/features/notes/local/isEmptyNote';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { NotificationsPanel } from '@/features/notifications/components/NotificationsPanel/NotificationsPanel';
import { useSync } from '@/sync/useSync';
import { useConflictCount } from '@/sync/useConflicts';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { ThemeToggle } from '@/design-system/components/ThemeToggle/ThemeToggle';
import { Modal } from '@/design-system/components/Modal/Modal';
import './AppLayout.css';

/*
 * Archived, Trash, Voice, Shared with me, Collaboration, Account — the FOLDERS PANEL's
 * contents now (moved out of the note-list sidebar's own footer). Still
 * defined here rather than in navItems.tsx, same reasoning as before:
 * navItems.tsx drives the <1024px compact nav and stays exactly as it
 * already was, so mobile/tablet — which has no folders panel at all —
 * are untouched.
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
const NOTE_LIFECYCLE_DELAY_MS = 220;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const desktopOnlyItems: NavItem[] = [
  {
    to: '/archived',
    label: 'Archived',
    icon: <Archive aria-hidden="true" />,
  },
  {
    to: '/trash',
    label: 'Trash',
    icon: <Trash2 aria-hidden="true" />,
  },
];

// Everything BUT Notes, plus Archived/Trash — the folders panel's full
// contents. Derived here rather than edited into navItems.tsx: navItems
// itself stays untouched and still exactly matches what the compact nav
// below renders, so there is no second four-item list to keep in sync by
// hand, and mobile/tablet cannot silently grow past four icons.
//
// Shared with me is NOT part of navItems (that array drives the <1024px
// compact nav too, and Shared has no place in that unchanged four-item
// list) — it's inserted here directly, between Shared with me and Account, so it
// picks up the same NavLink rendering as everything else in this panel
// without navItems.tsx growing a fifth entry mobile/tablet never asked for.
const sharedWithMeItem: NavItem = {
  to: '/shared',
  label: 'Shared with me',
  icon: <Users aria-hidden="true" />,
};

const voiceNotesItem: NavItem = {
  ...navItems.find((item) => item.to === '/voice')!,
  label: 'Voice notes',
};

const collaborationItem: NavItem = {
  to: '/collaborations',
  label: 'Collaborations',
  icon: <Handshake aria-hidden="true" />,
};

const accountItem: NavItem = {
  ...navItems.find((item) => item.to === '/account/sessions')!,
  label: 'Accounts',
};

const foldersNavItems = [
  voiceNotesItem,
  sharedWithMeItem,
  collaborationItem,
  ...desktopOnlyItems,
  accountItem,
];

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
 * outright — so <1024px keeps the ORIGINAL four-item nav (Notes/Voice/
 * Notifications/Account) completely unchanged, via
 * `.app-shell__compact-nav`. The underlying routes (`/notes`, `/archived`,
 * `/trash`) are untouched too and still fully reachable by direct URL —
 * nothing about them was removed, only which nav links point where at
 * the one breakpoint that now shows the notes inline instead.
 */
export function AppLayout() {
  const navigate = useNavigate();

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

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragStateRef.current = { startX: event.clientX, startWidth: sidebarWidth };
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
  const { isOpen: isFoldersOpen, toggle: toggleFolders, width: foldersWidth, setWidth: setFoldersWidth } =
    useFoldersPanel();
  const foldersDragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  function handleFoldersResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    foldersDragStateRef.current = { startX: event.clientX, startWidth: foldersWidth };
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
  const noteDetailMatch = useMatch('/notes/:noteId');
  const matchedNoteIdParam = noteDetailMatch?.params['noteId'];
  // Same validation parseNoteId (useNote.ts) applies — useMatch has no
  // concept of a numeric param, it matches any string in that segment.
  const activeNoteId =
    matchedNoteIdParam !== undefined && /^\d+$/.test(matchedNoteIdParam) ? matchedNoteIdParam : null;

  /*
   * Same reach as activeNoteId above, for the voice note detail route
   * instead — /voice/:voiceNoteId only, not /voice/:voiceNoteId/share
   * itself (sharing "the recording you're already sharing" isn't a real
   * action, same reasoning as the note side). This is what lets the
   * toolbar's one Share icon serve VoiceDetailPage too, so that page no
   * longer needs its own in-page Share link.
   */
  const voiceDetailMatch = useMatch('/voice/:voiceNoteId');
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
  const localNoteMatch = useMatch('/notes/local/:localId');
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
  const previousActiveLocalIdRef = useRef<string | null>(activeLocalId);

  useEffect(() => {
    const previousLocalId = previousActiveLocalIdRef.current;
    previousActiveLocalIdRef.current = activeLocalId;

    if (previousLocalId === null || previousLocalId === activeLocalId) {
      return;
    }

    /*
     * The delay lives around the deletion only, not the ref update above —
     * that has to stay synchronous so the NEXT navigation still computes
     * the right "previous" id. A rapid second navigation away before this
     * timer fires cancels it via the cleanup below rather than deleting a
     * note that may no longer even be the blank one this effect first saw.
     */
    const timer = setTimeout(() => {
      void noteRepository.getByLocalId(previousLocalId).then((row) => {
        if (row && row.serverId === null && row.deleted === 0 && isEmptyNote(row)) {
          void noteRepository.hardDelete(previousLocalId);
        }
      });
    }, NOTE_LIFECYCLE_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [activeLocalId]);

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
      navigate('/notes');
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

    const row = {
      ...createLocalNote(authState.user.id),
      dirty: 0 as const,
      syncState: 'synced' as const,
    };

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

    void navigate(`/notes/local/${row.localId}`, {
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

    void navigate(`/notes/local/${row.localId}`, {
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
      void navigate(`/notes/${String(note.serverId)}/share`);
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

  function handleToolbarSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = toolbarSearchTerm.trim();
    navigate(trimmed === '' ? '/search' : `/search?q=${encodeURIComponent(trimmed)}`);
  }

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
   * 8E. A count, not the full list — this mounts on EVERY authenticated
   * route, and pulling in useConflicts' resolution API (and re-rendering on
   * every field of every conflicted note) here just to know whether a
   * banner should show would be wasted work on every screen that isn't
   * /conflicts.
   */
  const conflictCount = useConflictCount(ownerId);

  /*
   * 8F. Same restraint the conflict banner and SaveIndicator both already
   * use: 'idle' (the resting state — last run succeeded, nothing pending)
   * shows NOTHING. A permanent "Synced" pill on every screen is chrome
   * competing with content for a fact nobody asked about; 'syncing' /
   * 'offline' / 'error' are the only states worth a line of text.
   */
  const syncStatus = useSyncStatus();
  const syncMessage =
    syncStatus.status === 'syncing'
      ? { label: 'Syncing…', tone: 'quiet' as const }
      : syncStatus.status === 'offline'
        ? { label: "Offline — you're working locally", tone: 'warn' as const }
        : syncStatus.status === 'error'
          ? { label: 'Sync trouble — retrying', tone: 'danger' as const }
          : null;

  // Same hook, same query the "Notes" list already used (archived: false
  // by default) — the sidebar list and NotesLandingPage read the same
  // live Dexie query, so there is exactly one source of truth for "what
  // are my notes" and the two never disagree.
  const { notes } = useNotes();

  const emptyNote = notes?.find(
    (note) => note.serverId === null && isEmptyNote(note),
  );

  const hasEmptyNote = emptyNote !== undefined;

  return (
    <div
      className="app-shell"
      style={
        {
          '--sidebar-width': `${String(sidebarWidth)}px`,
          '--folders-width': `${String(appliedFoldersWidth)}px`,
        } as CSSProperties
      }
    >
      <RouteFocus targetId="main" />

      {syncMessage ? (
        <p className="app-shell__sync-status" aria-hidden="true" data-tone={syncMessage.tone}>
          {syncMessage.label}
        </p>
      ) : null}
      {/*
        Always rendered so the region exists before it has content — same
        reasoning SaveIndicator.tsx gives for its own live region: a region
        added at the same moment as its text is frequently not announced.
        Only 'offline' and 'error' interrupt; 'syncing' is routine progress,
        exactly as SaveIndicator treats its own 'saving'.
      */}
      <p className="ds-visually-hidden" role="status">
        {syncMessage && syncStatus.status !== 'syncing' ? syncMessage.label : ''}
      </p>

      {conflictCount > 0 ? (
        /*
         * role="alert": a conflict is exactly the interruption ConflictPanel
         * already treats as one (§38) — announced immediately, not queued
         * behind whatever a screen reader happens to be reading.
         */
        <div className="app-shell__conflict-banner" role="alert">
          <p>
            {conflictCount} {conflictCount === 1 ? 'note has' : 'notes have'} a conflict that
            needs your attention.
          </p>
          <NavLink className="app-shell__conflict-link" to="/conflicts">
            Review
          </NavLink>
        </div>
      ) : null}
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
          */}
          <button
            type="button"
            className="app-shell__toolbar-icon-btn"
            aria-label={isFoldersOpen ? 'Hide folders' : 'Show folders'}
            aria-pressed={isFoldersOpen}
            onClick={toggleFolders}
          >
            <PanelLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className="app-shell__toolbar-icon-btn"
            aria-label="Delete note"
            disabled={activeNoteRow == null}
            onClick={() => {
              if (!activeNoteRow) return;
              setNoteToDelete(toView(activeNoteRow));
            }}
          >
            <Trash2 aria-hidden="true" />
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
        <div className="app-shell__toolbar-main">
          <button
            type="button"
            className="app-shell__toolbar-icon-btn"
            aria-label="New note"
            aria-disabled={hasEmptyNote}
            data-unavailable={hasEmptyNote || undefined}
            onClick={() => {
              void handleCreateNote();
            }}
          >
            <SquarePen aria-hidden="true" />
          </button>

          {/*
            Right-aligned group, reference order: notifications, then
            share, then search last against the toolbar's own trailing
            edge. Notifications is a toggle button now, not a Link — see
            the `notificationsOpen` state and its two effects above for
            why. The full `/notifications` page this used to link to
            directly still exists and is still reachable, both by URL and
            via the panel's own "View all" link.

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
                className="app-shell__toolbar-icon-btn"
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
                <Bell aria-hidden="true" />
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
                to={`/notes/${activeNoteId}/share`}
                className="app-shell__toolbar-icon-btn"
                aria-label="Share this note"
              >
                <Share aria-hidden="true" />
              </Link>
            ) : activeVoiceNoteId !== null ? (
              <Link
                to={`/voice/${activeVoiceNoteId}/share`}
                className="app-shell__toolbar-icon-btn"
                aria-label="Share this recording"
              >
                <Share aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                className="app-shell__toolbar-icon-btn"
                aria-label="Share this note"
                disabled
              >
                <Share aria-hidden="true" />
              </button>
            )}

            <form
              className="app-shell__toolbar-search"
              role="search"
              onSubmit={handleToolbarSearchSubmit}
            >
              <Search aria-hidden="true" />
              <input
                type="search"
                placeholder="Search"
                aria-label="Search your notes"
                value={toolbarSearchTerm}
                onChange={(event) => {
                  setToolbarSearchTerm(event.target.value);
                }}
              />
            </form>
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
          COMPACT NAV — <1024px only. The original four items, completely
          unchanged, so the mobile bottom bar and tablet icon rail behave
          exactly as they did before this file's own top comment describes
          why: no room for a note list at those sizes.
        */}

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
      />

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
          icon={<NotebookPen aria-hidden="true" />}
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
        <RouteTransition>
          <Outlet />
        </RouteTransition>
      </main>
    </div>
  );
}