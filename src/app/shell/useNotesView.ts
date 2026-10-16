import { useLocation, useSearchParams } from 'react-router';

import { NOTES_VIEWS, ROUTES, type NotesView } from '@/app/routes';

/** What the drawer marks as current: a list view, Settings, or nothing. */
export type CurrentSection = NotesView | 'settings' | null;

/**
 * Reads the current section from the URL. Under /notes it is the ?view= value
 * (All notes when absent or unknown); under /settings it is Settings.
 */
export function useNotesView(): CurrentSection {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  if (pathname.startsWith(ROUTES.settings())) return 'settings';
  if (!pathname.startsWith(ROUTES.notes())) return null;
  const asked = params.get('view');
  return NOTES_VIEWS.find((view) => view === asked) ?? 'all';
}

/** The view the list pane shows. Outside the notes routes it is All notes. */
export function useListView(): NotesView {
  const section = useNotesView();
  return section === null || section === 'settings' ? 'all' : section;
}
