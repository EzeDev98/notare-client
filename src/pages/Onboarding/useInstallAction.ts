import { useState } from 'react';

import { getInstallFlowSupport } from '@/pwa/installSupport';
import { useInstallAvailability } from '@/pwa/useInstallAvailability';

interface InstallActionOptions {
  /** The person accepted the browser's install dialog. */
  onInstalled: () => void;
  /** This browser has no install dialog to show: go to the manual steps. */
  onManual: () => void;
}

/** The one "Install Notare" button behaviour, shared by every screen that offers it. */
export function useInstallAction({ onInstalled, onManual }: InstallActionOptions): {
  busy: boolean;
  install: () => Promise<void>;
} {
  const { available, promptInstall } = useInstallAvailability();
  // A browser cannot gain or lose this API mid-session, so it is read once.
  const [support] = useState(getInstallFlowSupport);
  const [busy, setBusy] = useState(false);

  async function install(): Promise<void> {
    if (support !== 'native' || !available) {
      onManual();
      return;
    }
    setBusy(true);
    try {
      // Dismissing the dialog leaves the person where they are, free to press the button again.
      if ((await promptInstall()) === 'accepted') onInstalled();
    } finally {
      setBusy(false);
    }
  }

  return { busy, install };
}
