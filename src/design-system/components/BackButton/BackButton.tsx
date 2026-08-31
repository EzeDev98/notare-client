import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import './BackButton.css';

/**
 * One shared back control for the folder-style pages (Sessions, Voice
 * notes, Shared with me, Collaborations, Conflicts, Trash, Archived,
 * Search) that sit one level below the compact nav / bottom bar on
 * <1024px layouts.
 *
 * <1024px only (BackButton.css) — at >=1024px these destinations are
 * always one click away via the persistent folders panel/sidebar
 * (AppLayout.tsx), so a back control there is redundant chrome. Below
 * that, the compact nav and bottom bar collapse to a handful of icons and
 * these pages had no way back except the device's own back
 * gesture/button — this fills that gap, in one place, for every page that
 * renders it.
 *
 * navigate(-1), not a fixed destination: each of these pages is reached
 * from wherever the person actually was (a note, the compact nav, a
 * notification), and returning to THAT beats a hardcoded destination that
 * would strand someone who arrived from somewhere else.
 */
export function BackButton() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className="back-button"
      aria-label="Back"
      onClick={() => {
        void navigate(-1);
      }}
    >
      <ChevronLeft aria-hidden="true" />
    </button>
  );
}
