/** Shows the browser's install dialog and handles the answer. */
import { useState } from 'react';

import { getInstallFlowSupport } from '@/pwa/installSupport';
import { useInstallAvailability } from '@/pwa/useInstallAvailability';

interface InstallActionOptions {
  onInstalled: () => void;
  onManual: () => void;
}

export function useInstallAction({ onInstalled, onManual }: InstallActionOptions): {
  busy: boolean;
  install: () => Promise<void>;
} {
  const { available, promptInstall } = useInstallAvailability();
  const [support] = useState(getInstallFlowSupport);
  const [busy, setBusy] = useState(false);

  async function install(): Promise<void> {
    if (support !== 'native' || !available) {
      onManual();
      return;
    }
    setBusy(true);
    try {
      if ((await promptInstall()) === 'accepted') onInstalled();
    } finally {
      setBusy(false);
    }
  }

  return { busy, install };
}
