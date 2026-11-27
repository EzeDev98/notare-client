/** Test helper that fails a test on accessibility violations found by axe. */
import { run } from 'axe-core';
import { expect } from 'vitest';

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
