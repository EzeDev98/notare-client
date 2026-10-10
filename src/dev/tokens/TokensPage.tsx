import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import { contrast, parseRgb, toHex } from './contrast';

import './TokensPage.css';

const SCHEMES = ['light', 'dark'] as const;

const COLOURS = [
  '--color-brand', '--color-on-brand', '--color-bg', '--color-surface', '--color-text',
  '--color-text-muted', '--color-line', '--color-field-line', '--color-error',
  '--color-focus-tint', '--color-hover', '--color-scrim', '--color-tile', '--color-success',
  '--color-cursor-1', '--color-cursor-2', '--color-cursor-3', '--color-cursor-4',
  '--color-cursor-5', '--color-cursor-6',
];

/** [label, text colour, background, minimum ratio]. 4.5 for text, 3 for a control border. */
const PAIRS: ReadonlyArray<readonly [string, string, string, number]> = [
  ['Text on page', '--color-text', '--color-bg', 4.5],
  ['Text on surface', '--color-text', '--color-surface', 4.5],
  ['Muted text on page', '--color-text-muted', '--color-bg', 4.5],
  ['Muted text on surface', '--color-text-muted', '--color-surface', 4.5],
  ['Brand text on page', '--color-brand', '--color-bg', 4.5],
  ['Brand text on surface', '--color-brand', '--color-surface', 4.5],
  ['Button label on brand', '--color-on-brand', '--color-brand', 4.5],
  ['Error text on surface', '--color-error', '--color-surface', 4.5],
  ['Input border on surface', '--color-field-line', '--color-surface', 3],
  ...[1, 2, 3, 4, 5, 6].map(
    (n) => [`Cursor ${String(n)} name on surface`, `--color-cursor-${String(n)}`, '--color-surface', 4.5] as const,
  ),
];

const TYPE_STEPS = [
  ['xs', 'Dates, hints, counts, chips'],
  ['sm', 'Note body, buttons, row labels, previews'],
  ['md', 'Inputs, row titles, empty-state titles'],
  ['lg', 'Screen titles only'],
] as const;

const SHAPE = ['--border-width', '--radius', '--radius-sm', '--button-height', '--button-height-block', '--input-height', '--icon-button-size', '--icon-size'];
const SPACE = ['--card-pad', '--gap', '--gutter'];
const LAYOUT = ['--screen-width', '--content-width', '--bar-height', '--drawer-width', '--modal-width', '--list-width', '--editor-width', '--row-height', '--menu-width'];
const LAYERS = ['--z-overlay', '--z-menu', '--z-toast', '--z-splash'];
const MOTION = ['--motion-hover', '--motion-fast', '--motion-base', '--motion-fly', '--motion-stagger', '--motion-reveal', '--motion-reduced', '--ease-standard', '--ease-out'];

type Dictionary = Record<string, string>;

export function TokensPage() {
  useDocumentTitle('Tokens');
  const rootRef = useRef<HTMLElement>(null);
  const [swatches, setSwatches] = useState<Dictionary>({});
  const [ratios, setRatios] = useState<Dictionary>({});
  const [values, setValues] = useState<Dictionary>({});

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nextSwatches: Dictionary = {};
    const nextRatios: Dictionary = {};
    root.querySelectorAll<HTMLElement>('[data-swatch]').forEach((el) => {
      const background = getComputedStyle(el).backgroundColor;
      const rgb = background.startsWith('rgb(') ? parseRgb(background) : null;
      nextSwatches[el.dataset['swatch'] ?? ''] = rgb ? toHex(rgb) : 'translucent';
    });
    root.querySelectorAll<HTMLElement>('[data-pair]').forEach((el) => {
      const style = getComputedStyle(el);
      const fg = parseRgb(style.color);
      const bg = parseRgb(style.backgroundColor);
      nextRatios[el.dataset['pair'] ?? ''] = fg && bg ? contrast(fg, bg).toFixed(2) : 'n/a';
    });
    const rootStyle = getComputedStyle(document.documentElement);
    const nextValues: Dictionary = {};
    [...SHAPE, ...SPACE, ...LAYOUT, ...LAYERS, ...MOTION].forEach((name) => {
      nextValues[name] = rootStyle.getPropertyValue(name).trim();
    });
    setSwatches(nextSwatches);
    setRatios(nextRatios);
    setValues(nextValues);
  }, []);

  const list = (names: string[]) => (
    <dl className="tokens-list">
      {names.map((name) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{values[name] ?? ''}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <main className="tokens-page" ref={rootRef}>
      <h1>Tokens</h1>
      <p className="tokens-note">Dev only. Replaced by the gallery in step 6.</p>

      <div className="tokens-schemes">
        {SCHEMES.map((scheme) => (
          <section key={scheme} className="tokens-panel" data-scheme={scheme}>
            <h2>{scheme === 'light' ? 'Light' : 'Dark'}</h2>

            <h3>Colour</h3>
            <ul className="tokens-swatches">
              {COLOURS.map((name) => (
                <li key={name}>
                  <span className="tokens-swatch" style={{ '--swatch': `var(${name})` } as CSSProperties} data-swatch={`${scheme}:${name}`} />
                  <span>{name}</span>
                  <span className="tokens-value">{swatches[`${scheme}:${name}`] ?? ''}</span>
                </li>
              ))}
            </ul>

            <h3>Contrast</h3>
            <ul className="tokens-pairs">
              {PAIRS.map(([label, fg, bg, min]) => {
                const key = `${scheme}:${fg}:${bg}`;
                const ratio = ratios[key];
                const ok = ratio !== undefined && Number(ratio) >= min;
                return (
                  <li key={key}>
                    <span className="tokens-pair" style={{ '--fg': `var(${fg})`, '--bg': `var(${bg})` } as CSSProperties} data-pair={key}>
                      Aa
                    </span>
                    <span>{label}</span>
                    <span className="tokens-value">
                      {ratio ?? ''} : 1 {ratio === undefined ? '' : ok ? `ok (min ${String(min)})` : `BELOW ${String(min)}`}
                    </span>
                  </li>
                );
              })}
            </ul>

            <h3>Type</h3>
            {TYPE_STEPS.map(([step, use]) => (
              <p key={step} className={`tokens-type tokens-type--${step}`}>
                {step}: {use}. The quick brown fox, ₦12,500, Ọlá.
              </p>
            ))}
          </section>
        ))}
      </div>

      <section className="tokens-values">
        <h2>Shape</h2>
        {list(SHAPE)}
        <h2>Spacing</h2>
        <div className="tokens-bars">
          {SPACE.map((name) => (
            <span key={name} className="tokens-bar" style={{ '--size': `var(${name})` } as CSSProperties} />
          ))}
        </div>
        {list(SPACE)}
        <h2>Widths</h2>
        {list(LAYOUT)}
        <h2>Layers</h2>
        {list(LAYERS)}
        <h2>Motion</h2>
        {list(MOTION)}
      </section>
    </main>
  );
}
