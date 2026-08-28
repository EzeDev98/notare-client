import { useEffect, useState } from 'react';

import { onInstallAvailable, promptInstall } from '@/pwa/installPrompt';

export function useInstallPrompt() {
  const [available, setAvailable] = useState(false);

  useEffect(() => onInstallAvailable(setAvailable), []);

  return { available, promptInstall };
}
