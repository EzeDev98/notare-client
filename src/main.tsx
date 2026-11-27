/** Entry point: mounts the app. */
import '@/design-system/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { startKeepAlive } from '@/lib/keepAlive';
import { initInstallPrompt } from '@/pwa/installPrompt';
import { registerServiceWorker } from '@/pwa/registerServiceWorker';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found in index.html.');
}

registerServiceWorker();

initInstallPrompt();

startKeepAlive();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
