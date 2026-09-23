import type { Plugin } from 'vite';

/**
 * Puts every PatternFly component stylesheet into `@layer patternfly`.
 *
 * PatternFly's React components import their own CSS (button.css,
 * modal.css, ...) UNLAYERED, and unlayered CSS beats every @layer. Without
 * this, a `@layer pages` rule could never restyle a PatternFly Button and
 * every override would need `!important`. With it, component CSS sits at
 * the bottom of global.css's layer order, beside PatternFly's base.css, so
 * the usual `components` / `pages` precedence applies to PatternFly too.
 *
 * `enforce: 'pre'` so this sees the raw CSS before Vite's own CSS plugin.
 * The optional `?query` covers dev-server ids.
 */
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
