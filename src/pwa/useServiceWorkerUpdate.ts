/** Whether an app update is waiting. */
import { useEffect, useState } from 'react';

import { applyUpdate, onUpdateAvailable } from '@/pwa/registerServiceWorker';

export function useServiceWorkerUpdate() {
  const [available, setAvailable] = useState(false);

  useEffect(() => onUpdateAvailable(setAvailable), []);

  return { available, applyUpdate };
}
