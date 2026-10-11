import { useRef, useState } from 'react';
import { useLocation } from 'react-router';

import { AnimatedRoutes } from '@/app/AnimatedRoutes';
import { ROUTES } from '@/app/routes';
import { NotesListPane } from '@/pages/Home/NotesListPane';

import { AppDrawer } from './AppDrawer';
import { BackOnlineToast } from './BackOnlineToast';
import { HeaderActions } from './HeaderActions';
import { SHELL_COPY } from './shellContent';
import { ShellHeader } from './ShellHeader';
import { usePaneTransition } from './usePaneTransition';
import { useStartSync } from './useStartSync';

import './Shell.css';

/**
 * The one shell for every signed-in screen (master 5.1): header, list pane,
 * note pane and overlays. It holds no business logic. Both panes stay mounted;
 * CSS decides from the container width whether one or both are shown, so
 * resizing across 800px never remounts the editor.
 */
export function Shell() {
  useStartSync();
  const [menuOpen, setMenuOpen] = useState(false);
  const list = useRef<HTMLElement>(null);
  const note = useRef<HTMLElement>(null);
  const wanted = useLocation().pathname === ROUTES.notes() ? 'list' : 'note';
  const screen = usePaneTransition(wanted, list, note);

  return (
    <div className="shell" data-screen={screen}>
      <ShellHeader
        onMenu={() => {
          setMenuOpen(true);
        }}
      >
        <HeaderActions />
      </ShellHeader>
      <div className="shell__panes">
        <section ref={list} className="shell__list" aria-label={SHELL_COPY.listPane}>
          <NotesListPane />
        </section>
        <main ref={note} className="shell__note">
          <AnimatedRoutes fill />
        </main>
      </div>
      <BackOnlineToast />
      <AppDrawer
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
        }}
      />
    </div>
  );
}
