/** Whether the app can be installed right now. */
import { useEffect, useState } from 'react';

import { getInstallAvailability, onInstallAvailable, promptInstall } from '@/pwa/installPrompt';

export function useInstallAvailability() {
  const [available, setAvailable] = useState(getInstallAvailability);

  useEffect(() => onInstallAvailable(setAvailable), []);

  return { available, promptInstall };
}
