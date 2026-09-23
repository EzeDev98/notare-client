import type { ReactNode } from 'react';
import { BellIcon, FileAltIcon, MicrophoneIcon, UserIcon } from '@patternfly/react-icons';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

/*
 * FOUR items now — Shared is the only one from §4.2's five still missing a
 * route. Each joined here the moment its route became real: Notifications
 * with 9F, Voice with Step 10.
 *
 * Lucide, not hand-written SVG (the icon standardization pass) — every icon
 * in the app now comes from one library so size, stroke width, and color
 * are set once, globally, in tokens/icons.css, instead of drifting per
 * hand-drawn path. `User`, specifically, not `UserRound` — the simpler,
 * more angular Lucide mark, matching the rest of the app's restrained line
 * work rather than the softer rounded variant.
 *
 * No strokeWidth/size props here on purpose — tokens/icons.css's `.lucide`
 * rule sets both for every icon in the app; repeating them per call site is
 * exactly the drift this pass removes.
 *
 * aria-hidden on every icon — the adjacent text is the accessible name, and
 * an unlabelled SVG would otherwise be announced as a meaningless
 * "graphic".
 */
export const navItems: NavItem[] = [
  {
    to: '/notes',
    label: 'Notes',
    icon: <FileAltIcon aria-hidden="true" />,
  },
  {
    to: '/voice',
    label: 'Voice',
    icon: <MicrophoneIcon aria-hidden="true" />,
  },
  {
    to: '/notifications',
    label: 'Notifications',
    icon: <BellIcon aria-hidden="true" />,
  },
  {
    to: '/account/sessions',
    label: 'Account',
    icon: <UserIcon aria-hidden="true" />,
  },
];
