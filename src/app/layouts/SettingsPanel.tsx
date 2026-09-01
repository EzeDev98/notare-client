import type { AnimationEventHandler } from 'react';
import { Link } from 'react-router';
import { RotateCcw, User, X } from 'lucide-react';

import { ThemeToggle } from '@/design-system/components/ThemeToggle/ThemeToggle';
import './SettingsPanel.css';

interface SettingsPanelProps {
  onClose: () => void;
  isClosing: boolean;
  onAnimationEnd: AnimationEventHandler<HTMLDivElement>;
  onResetDevice: () => void;
}

/**
 * Responsive layout plan, next step. The mobile bottom bar's Settings icon
 * (replacing the far-right Account link at that width — AppLayout.tsx's
 * own comment on accountItem's sibling markup) opens this: a slide-in
 * panel from the RIGHT, stopping at 50% width / 100% height — the mirror
 * image of MobileNotesPanel's own left slide-in, both scoped to the same
 * <640px range.
 *
 * Content is exactly what was asked for: the Account destination (icon +
 * "Accounts" label) near the top, and the same three-way ThemeToggle the
 * desktop sidebar's folders panel already uses, pinned to the bottom of
 * this panel the way it's pinned to the bottom of that one
 * (.app-shell__theme-toggle's own "auto margin claims the remaining
 * space" trick, reused here rather than reinvented).
 *
 * Not a portal — same reasoning NotificationsPanel and MobileNotesPanel
 * already give for skipping one: nothing in .app-shell's ancestry sets
 * transform/filter/contain, so `position: fixed` here resolves against
 * the viewport regardless of where in the tree this mounts.
 */
export function SettingsPanel({
  onClose,
  isClosing,
  onAnimationEnd,
  onResetDevice,
}: SettingsPanelProps) {
  return (
    <div
      className="settings-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      data-closing={isClosing || undefined}
      onAnimationEnd={onAnimationEnd}
    >
      <header className="settings-panel__header">
        <button
          type="button"
          className="settings-panel__close"
          aria-label="Close settings"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </header>

      <div className="settings-panel__body">
        <Link to="/account/sessions" className="settings-panel__account" onClick={onClose}>
          <User aria-hidden="true" />
          <span>Accounts</span>
        </Link>

        {/*
          Directly under Accounts, same row styling — this doesn't
          navigate anywhere, so a <button> rather than a <Link>, closing
          the sheet first so the confirmation modal it opens (AppLayout's
          own Reset-confirmation Modal) isn't fighting this slide-in
          panel's own z-index/animation for the screen at the same time.
        */}
        <div
          role="button"
          tabIndex={0}
          className="settings-panel__account settings-panel__reset"
          onClick={() => {
            onClose();
            onResetDevice();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onClose();
              onResetDevice();
            }
          }}
        >
          <RotateCcw aria-hidden="true" />
          <span>Reset this device</span>
        </div>

        {/* Pinned to the bottom — see this file's own top comment. */}
        <div className="settings-panel__theme">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
