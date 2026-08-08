import type { ReactNode } from 'react';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

/*
 * ONE item, because /notes is the only route that exists. §4.2 plans five —
 * Shared (Step 9), Voice (Step 10), Notifications (Step 9), Account (Step 4) —
 * and each is added when its route is real. A nav entry to a placeholder page
 * looks like a feature.
 *
 * Inline SVG rather than an icon library: one icon does not justify a
 * dependency. Step 9 takes the nav to five and that is the moment to decide on
 * lucide-react.
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
];
