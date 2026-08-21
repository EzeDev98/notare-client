import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useMatches } from 'react-router';
import './RouteTransition.css';

/**
 * The single transition boundary the audit asks for (§5.2): the app shell
 * — toolbar, sidebar, folders panel — stays completely outside this
 * component and never re-renders because of it. Only whatever AppLayout
 * places inside <main> (the Outlet's content) passes through here.
 *
 * Keyed by the DEEPEST MATCHED ROUTE's id, not by location.pathname.
 * pathname includes resolved param values ('/voice/12' vs '/voice/13'), so
 * keying on it would remount — and replay this page-level animation — on
 * every VoiceDetail/NoteDetail record switch too. useMatches()'s `id` is
 * generated from the route's position in router.tsx's own config tree,
 * stable for a given route DEFINITION regardless of which :voiceNoteId or
 * :noteId it currently resolves to. That keeps this component's job to
 * genuine page-to-page navigation (§47's "route transition"), leaving
 * same-route param changes to their own, subtler, Phase 5 treatment.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const matches = useMatches();
  const routeId = matches.at(-1)?.id ?? 'root';
  const location = useLocation();

  /*
   * Same problem RouteFocus.tsx solves, same shape of fix: a fresh page
   * load must render in its final state, not play an entrance animation
   * (§6). A ref flipped by a mount-only effect (empty deps) is safe to
   * read during render — by the time any navigation can actually happen,
   * the initial mount effect has long since committed, so this never needs
   * to compare this render's route to the previous one.
   */
  const hasMounted = useRef(false);

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  /*
   * Escape hatch for a PROGRAMMATIC hop the user did not navigate to —
   * currently just NewNotePage's own replace() into /notes/local/:localId
   * once the row exists. That hop is not "the user went to a new page";
   * it's the tail end of a single click on the compose icon. Without this,
   * that one click plays TWO stacked page-enter animations back to back
   * (once into the "Preparing a new note..." placeholder, once again into
   * the real editor) — the doubled fade/collapse is what reads as a jump.
   * Any navigate() call can opt in with `state: { skipEnterAnimation: true }`;
   * everything else (including browser back/forward, which react-router
   * does not attach custom state to) still animates as before.
   */
  const skipEnterAnimation =
    (location.state as { skipEnterAnimation?: boolean } | null)?.skipEnterAnimation === true;

  /*
   * Note navigation is an editor switch, not a page transition.
   *
   * `/notes/:noteId` and `/notes/local/:localId` are intentionally separate
   * routes because their identities are different (serverId vs localId), but
   * visually they are the SAME editor screen. Letting the route-transition
   * animation run when crossing between those two routes creates an enter
   * animation exactly when moving between a synced note and a newly-created
   * local note.
   *
   * Same-route note switches were already stable because routeId does not
   * change. This covers the remaining server <-> local boundary.
   */
  const isNoteEditorRoute = location.pathname.startsWith('/notes/');

  const shouldAnimate =
    hasMounted.current &&
    !skipEnterAnimation &&
    !isNoteEditorRoute;

  return (
    <div
      key={routeId}
      className="route-transition"
      data-animate={shouldAnimate ? 'true' : undefined}
    >
      {children}
    </div>
  );
}
