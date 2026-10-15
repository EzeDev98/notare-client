import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { Button } from '@/design-system/ui';
import { forceReduced, reduced } from '@/design-system/motion/motion';
import {
  bannerIn,
  drawerIn,
  fadeOut,
  listFirstLoad,
  menuIn,
  menuOut,
  modalIn,
  rowOut,
  screenIn,
  screenOut,
  sheetIn,
  statusSwap,
  toastIn,
  toastOut,
} from '@/design-system/motion/patterns';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import './MotionPage.css';

const ROWS = ['Groceries', 'Meeting notes', 'Voice memo', 'Ideas', 'Reading list'];
const STATUS = ['Saved', 'Saving', 'Offline'];

/** Dev only. One button per helper in patterns.ts, plus a reduced-motion switch. */
export function MotionPage() {
  useDocumentTitle('Motion');
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const status = useRef<HTMLSpanElement>(null);
  const [rows, setRows] = useState(ROWS);
  const [word, setWord] = useState(0);
  const [forced, setForced] = useState(false);

  const play = (fn: (el: HTMLElement) => unknown) => () => {
    if (box.current) fn(box.current);
  };
  const removeFirst = () => {
    const first = list.current?.firstElementChild;
    if (!first || !list.current) return;
    void rowOut(first, list.current, () => {
      flushSync(() => {
        setRows((r) => r.slice(1));
      });
    });
  };
  const swapStatus = () => {
    const next = (word + 1) % STATUS.length;
    if (status.current) {
      void statusSwap(status.current, () => {
        flushSync(() => {
          setWord(next);
        });
      });
    }
  };

  return (
    <main className="motion-page">
      <h1>Motion</h1>
      <p className="motion-note">
        Every button calls one helper from patterns.ts. System reduced motion is{' '}
        {reduced() && !forced ? 'ON' : 'OFF'}.
      </p>

      <label className="motion-toggle">
        <input
          type="checkbox"
          checked={forced}
          onChange={(event) => {
            setForced(event.target.checked);
            forceReduced(event.target.checked ? true : null);
          }}
        />
        Force reduced motion
      </label>

      <div ref={box} className="motion-box">
        Demo box
      </div>

      <h2>Screens and overlays</h2>
      <div className="motion-buttons">
        <Button onClick={play((el) => screenIn(el, 1))}>screenIn forward</Button>
        <Button onClick={play((el) => screenIn(el, -1))}>screenIn back</Button>
        <Button onClick={play((el) => screenOut(el, 1))}>screenOut forward</Button>
        <Button onClick={play((el) => screenOut(el, -1))}>screenOut back</Button>
        <Button onClick={play(modalIn)}>modalIn</Button>
        <Button onClick={play(drawerIn)}>drawerIn</Button>
        <Button onClick={play(sheetIn)}>sheetIn</Button>
        <Button onClick={play(bannerIn)}>bannerIn</Button>
      </div>

      <h2>Menus and toasts</h2>
      <div className="motion-buttons">
        <Button onClick={play(menuIn)}>menuIn</Button>
        <Button onClick={play(menuOut)}>menuOut</Button>
        <Button onClick={play(toastIn)}>toastIn</Button>
        <Button onClick={play(toastOut)}>toastOut</Button>
        <Button onClick={play(fadeOut)}>fadeOut</Button>
      </div>

      <h2>Lists and text</h2>
      <div className="motion-buttons">
        <Button onClick={removeFirst}>rowOut (first row)</Button>
        <Button onClick={() => { setRows(ROWS); }}>Reset rows</Button>
        <Button
          onClick={() => {
            if (list.current) listFirstLoad([...list.current.children]);
          }}
        >
          listFirstLoad
        </Button>
        <Button onClick={swapStatus}>statusSwap</Button>
      </div>

      <p className="motion-status">
        Status: <span ref={status}>{STATUS[word]}</span>
      </p>
      <ul ref={list} className="motion-list">
        {rows.map((row) => (
          <li key={row} className="motion-row">
            {row}
          </li>
        ))}
      </ul>
    </main>
  );
}
