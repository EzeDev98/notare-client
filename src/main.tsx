import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { startKeepAlive } from '@/lib/keepAlive';
import { initInstallPrompt } from '@/pwa/installPrompt';
import { registerServiceWorker } from '@/pwa/registerServiceWorker';
import '@/design-system/global.css';

const rootElement = document.getElementById('root');

/*
 * noUncheckedIndexedAccess is not what makes this check necessary —
 * getElementById returns HTMLElement | null regardless. But the scaffold's
 * version used a non-null assertion (`!`) to silence it, which is an assertion
 * that index.html will always contain #root. It will, right up until someone
 * edits index.html. Throwing here costs one line and names the actual problem.
 */
if (!rootElement) {
  throw new Error('Root element #root not found in index.html.');
}

// Step 11. Fire-and-forget at startup — see registerServiceWorker.ts's own
// doc comment for what this does and does not block on.
registerServiceWorker();

// Captures beforeinstallprompt before React ever renders, so the event
// can't fire and go unheard during initial mount. See installPrompt.ts.
initInstallPrompt();

// Keeps Render's free-tier instance from spinning down while this app is
// open. See keepAlive.ts's own doc comment for what this does and doesn't
// cover.
startKeepAlive();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
