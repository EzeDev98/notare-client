/** Tests for useOverlayBehavior. */
import { useRef, useState, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useOverlayBehavior } from './useOverlayBehavior';

function Overlay({ label, onClose, children }: { label: string; onClose: () => void; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlayBehavior(true, { ref, onClose });
  return (
    <div ref={ref} role="dialog" aria-label={label} tabIndex={-1}>
      {children}
      <button type="button">{`${label} action`}</button>
    </div>
  );
}

function Harness() {
  const [first, setFirst] = useState(false);
  const [second, setSecond] = useState(false);
  return (
    <>
      <button type="button" onClick={() => { setFirst(true); }}>
        open first
      </button>
      {first ? (
        <Overlay label="first" onClose={() => { setFirst(false); }}>
          <button type="button" onClick={() => { setSecond(true); }}>
            open second
          </button>
          {second ? <Overlay label="second" onClose={() => { setSecond(false); }} /> : null}
        </Overlay>
      ) : null}
    </>
  );
}

describe('useOverlayBehavior', () => {
  it('Escape closes only the top overlay and focus returns to its opener', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'open first' }));
    await user.click(screen.getByRole('button', { name: 'open second' }));
    expect(screen.getByRole('dialog', { name: 'second' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'second' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'first' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'open second' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'first' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'open first' })).toHaveFocus();
  });

  it('locks page scroll while open and releases it after', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open first' }));
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });
});
