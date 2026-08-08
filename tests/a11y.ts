import { run } from 'axe-core';
import { expect } from 'vitest';

/**
 * Runs axe against a rendered container and fails with the specific
 * violations rather than a bare "expected 0 to be 1".
 *
 * COLOR-CONTRAST IS DISABLED, and this is not a convenience.
 *
 * The rule needs real rendering to resolve computed colours through stacked
 * backgrounds, and jsdom has no layout engine — it reports "incomplete", not
 * "pass". Leaving it enabled would produce a green suite that says nothing
 * about contrast at all, which is worse than not checking: it looks like
 * coverage. Contrast is verified in a real browser (Lighthouse, or the axe
 * DevTools extension) against the ratios computed in 2B.
 *
 * Worth being clear about the ceiling generally: automated tools catch roughly
 * a third of accessibility issues. axe finds missing labels, bad ARIA and
 * duplicate ids — mechanically and reliably. It cannot tell you whether the
 * focus order makes sense, whether an error message is useful, or whether an
 * icon's label describes what the icon does. The manual pass in 2F covers
 * what the tool structurally cannot.
 */
export async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
  const results = await run(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });

  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}\n` +
      violation.nodes.map((node) => `    ${node.html}`).join('\n'),
  );

  expect(summary, summary.join('\n\n')).toEqual([]);
}
