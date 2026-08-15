import type { ReactNode } from 'react';

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
 * Inline SVG rather than an icon library: still not clearly worth the
 * dependency at four. Reconsider once Shared joins and this is genuinely
 * five.
 *
 * aria-hidden on every icon — the adjacent text is the accessible name, and an
 * unlabelled SVG would otherwise be announced as a meaningless "graphic".
 */
export const navItems: NavItem[] = [
  {
    to: '/notes',
    label: 'Notes',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H16l4 4v12.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5Z" />
        <path d="M15.5 3v4.5H20" />
        <path d="M8 12h8M8 16h5" />
      </svg>
    ),
  },
  {
    to: '/voice',
    label: 'Voice',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3" />
      </svg>
    ),
  },
  {
    to: '/notifications',
    label: 'Notifications',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 8.5a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
        <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" />
      </svg>
    ),
  },
  {
    to: '/account/sessions',
    label: 'Account',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </svg>
    ),
  },
];
