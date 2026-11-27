/** Vite plugin that puts PatternFly's CSS into the patternfly cascade layer. */
import type { Plugin } from 'vite';

const PATTERNFLY_COMPONENT_CSS = /[\\/]@patternfly[\\/]react-styles[\\/]css[\\/].+\.css(\?.*)?$/;

export function patternflyLayerPlugin(): Plugin {
  return {
    name: 'notare:patternfly-layer',
    enforce: 'pre',
    transform(code, id) {
      if (!PATTERNFLY_COMPONENT_CSS.test(id)) return null;
      return { code: `@layer patternfly {\n${code}\n}`, map: null };
    },
  };
}
