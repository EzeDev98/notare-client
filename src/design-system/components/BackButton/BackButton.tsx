import { AngleLeftIcon } from '@patternfly/react-icons';
import { useNavigate } from 'react-router';

import { Button } from '@/design-system/components/Button/Button';
import './BackButton.css';

/**
 * One shared back control for the folder-style pages (Sessions, Voice
 * notes, Shared with me, Collaborations, Conflicts, Trash, Archived,
 * Search). Shown below 1024px only (BackButton.css) — above that the
 * persistent sidebar is always one click away.
 *
 * navigate(-1), not a fixed destination: return to wherever the person
 * actually came from.
 */
export function BackButton() {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      className="back-button"
      aria-label="Back"
      onClick={() => {
        void navigate(-1);
      }}
    >
      <AngleLeftIcon />
    </Button>
  );
}
