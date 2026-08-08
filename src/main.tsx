import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import './index.css';

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

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
