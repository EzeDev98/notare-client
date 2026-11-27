/** The shell for every signed-in screen: header, list pane, note pane and overlays. */
import { useRef, useState } from 'react';
import { useLocation } from 'react-router';

import { AnimatedRoutes } from '@/app/AnimatedRoutes';
import { ROUTES } from '@/app/routes';
import { NotesListPane } from '@/pages/Home/NotesListPane';
import { BarSlotProvider } from '@/shared/hooks/useBarSlot';

import { AppDrawer } from './AppDrawer';
import { HeaderActions } from './HeaderActions';
import { SHELL_COPY } from './shellContent';
import { ShellHeader } from './ShellHeader';
import { usePaneTransition } from './usePaneTransition';
import { useStartSync } from './useStartSync';

import './Shell.css';

export function Shell() {
  useStartSync();
  const [menuOpen, setMenuOpen] = useState(false);
  const [barSlot, setBarSlot] = useState<HTMLElement | null>(null);
  const list = useRef<HTMLElement>(null);
  const note = useRef<HTMLElement>(null);
  const wanted = useLocation().pathname === ROUTES.notes() ? 'list' : 'note';
  const screen = usePaneTransition(wanted, list, note);

  return (
    <BarSlotProvider value={barSlot}>
      <div className="shell" data-screen={screen}>
        <ShellHeader
          slotRef={setBarSlot}
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
        <AppDrawer
          open={menuOpen}
          onClose={() => {
            setMenuOpen(false);
          }}
        />
      </div>
    </BarSlotProvider>
  );
}
