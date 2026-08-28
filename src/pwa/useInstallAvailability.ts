import { useEffect, useState } from 'react';

import { getInstallAvailability, onInstallAvailable, promptInstall } from '@/pwa/installPrompt';

/**
 * Step 1b. Boot-oriented sibling of useInstallPrompt.ts.
 *
 * Exists separately from useInstallPrompt (used by InstallBanner, which
 * is retired in Step 5) because boot orchestration has a stricter
 * requirement: the initial value must be correct on the very first
 * render, not one effect-cycle later. Seeding useState from
 * `getInstallAvailability()` (a lazy initializer, so it's only read
 * once) achieves that; subscribing via `onInstallAvailable` keeps it
 * live for the rest of the session, same as useInstallPrompt does.
 *
 * Step 1c will build on this to distinguish "not yet fired" from
 * "will never fire on this platform" — this hook alone cannot tell
 * those apart, since both currently report `false`.
 */
export function useInstallAvailability() {
  const [available, setAvailable] = useState(getInstallAvailability);

  useEffect(() => onInstallAvailable(setAvailable), []);

  return { available, promptInstall };
}
