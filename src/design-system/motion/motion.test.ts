/** Tests for motion. */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { flip, forceReduced, ms, run, stagger } from './motion';

const TOKENS: Record<string, string> = {
  '--motion-base': '260ms',
  '--motion-fast': '0.16s',
  '--motion-reduced': '120ms',
  '--motion-stagger': '70ms',
  '--ease-out': 'cubic-bezier(.2,.8,.2,1)',
  '--ease-standard': 'cubic-bezier(.4,0,.2,1)',
};

let animate: MockInstance<Element['animate']>;
const options = (call: number): KeyframeAnimationOptions =>
  animate.mock.calls[call]?.[1] as KeyframeAnimationOptions;
const keyframes = (call: number): unknown => animate.mock.calls[call]?.[0];

beforeEach(() => {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: (name: string) => TOKENS[name] ?? '',
  } as unknown as CSSStyleDeclaration);
  animate = vi.spyOn(Element.prototype, 'animate').mockReturnValue({} as Animation);
});

afterEach(() => {
  forceReduced(null);
  vi.restoreAllMocks();
});

describe('motion', () => {
  it('reads durations and easings from the CSS tokens at call time', () => {
    run(document.createElement('div'), [{ opacity: 0 }, { opacity: 1 }], {
      duration: '--motion-base',
      easing: '--ease-out',
    });
    expect(options(0)).toMatchObject({ duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
    expect(ms('--motion-fast')).toBe(160);
  });

  it('turns movement into a 120ms opacity fade under reduced motion', () => {
    forceReduced(true);
    run(
      document.createElement('div'),
      [
        { opacity: 0, transform: 'translateX(16px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: '--motion-base', easing: '--ease-out', delay: 500 },
    );
    expect(keyframes(0)).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(options(0)).toMatchObject({ duration: 120, easing: 'linear' });
    expect(options(0).delay).toBeUndefined();
  });

  it('keeps an exit a fade out, and fades in a movement with no opacity', () => {
    forceReduced(true);
    const el = document.createElement('div');
    const t = { duration: '--motion-fast', easing: '--ease-standard' } as const;
    run(el, [{ opacity: 1 }, { opacity: 0 }], t);
    run(el, [{ transform: 'translateX(-100%)' }, { transform: 'none' }], t);
    expect(keyframes(0)).toEqual([{ opacity: 1 }, { opacity: 0 }]);
    expect(keyframes(1)).toEqual([{ opacity: 0 }, { opacity: 1 }]);
  });

  it('staggers 70ms apart and stops delaying after the 8th item', () => {
    const els = Array.from({ length: 10 }, () => document.createElement('li'));
    stagger(els, [{ opacity: 0 }, { opacity: 1 }], { duration: '--motion-base', easing: '--ease-out' });
    const delays = els.map((_, i) => options(i).delay);
    expect(delays).toEqual([0, 70, 140, 210, 280, 350, 420, 490, 0, 0]);
  });

  it('does nothing but apply the change under reduced motion', () => {
    forceReduced(true);
    const mutate = vi.fn();
    flip(document.createElement('ul'), mutate);
    expect(mutate).toHaveBeenCalledOnce();
    expect(animate).not.toHaveBeenCalled();
  });
});
