/** Runs before every test file. */
import '@testing-library/jest-dom/vitest';

import 'fake-indexeddb/auto';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { resetDatabase } from './harness';
import { server } from './msw/server';

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ??
    ((query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList);
});

beforeAll(() => {
  if (typeof Element.prototype.scrollTo !== 'function') {
    Element.prototype.scrollTo = () => {};
  }
});

beforeAll(() => {
  if (typeof Range.prototype.getClientRects !== 'function') {
    Range.prototype.getClientRects = (): DOMRectList => [] as unknown as DOMRectList;
  }
  if (typeof Range.prototype.getBoundingClientRect !== 'function') {
    Range.prototype.getBoundingClientRect = (): DOMRect =>
      ({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON() {
          return this;
        },
      }) as DOMRect;
  }
  if (typeof document.elementFromPoint !== 'function') {
    document.elementFromPoint = (): Element | null => null;
  }
});

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

afterEach(cleanup);

afterEach(async () => {
  await resetDatabase();
});

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  localStorage.clear();
});

beforeAll(() => {
  if (typeof Element.prototype.animate !== 'function') {
    Element.prototype.animate = function animate(): Animation {
      return { finished: Promise.resolve(), cancel() {} } as unknown as Animation;
    };
  }
  if (typeof Element.prototype.getAnimations !== 'function') {
    Element.prototype.getAnimations = (): Animation[] => [];
  }
});

beforeAll(() => {
  if (typeof globalThis.ResizeObserver !== 'function') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }
});
