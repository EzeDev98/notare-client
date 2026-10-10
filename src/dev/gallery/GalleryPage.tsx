import { useEffect, useState } from 'react';

import { forceReduced } from '@/design-system/motion/motion';
import { ToastProvider } from '@/design-system/ui';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import { GalleryBar, type Device } from './GalleryBar';
import { GalleryControls, type Panels } from './GalleryControls';
import { Row1 } from './Row1';
import { Row2 } from './Row2';
import { Row3 } from './Row3';
import { Row4 } from './Row4';
import { Row5 } from './Row5';
import { Row6 } from './Row6';
import { Row7 } from './Row7';
import { Row8 } from './Row8';
import { Row9 } from './Row9';
import { Row10 } from './Row10';
import { Row11 } from './Row11';
import { Row12 } from './Row12';
import { Row13 } from './Row13';
import { Row13b } from './Row13b';

import './GalleryPage.css';

/**
 * Dev only. Every component in src/design-system/ui, in every state, on a
 * light and a dark surface. One file per group: add a RowN file and list it here.
 */
function GalleryContent() {
  useDocumentTitle('Gallery');
  const [device, setDevice] = useState<Device>('desktop');
  const [panels, setPanels] = useState<Panels>('both');
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    forceReduced(reduced ? true : null);
    return () => {
      forceReduced(null);
    };
  }, [reduced]);

  return (
    <div className="gallery-root" data-device={device} data-panels={panels}>
      <GalleryBar device={device} onDevice={setDevice} />
      <main className="gallery-page">
        <h1 className="gallery-page__title">Component gallery</h1>
        <p className="gallery-page__note">Press Tab to see focus rings. Hover works on a mouse.</p>
        <GalleryControls panels={panels} onPanels={setPanels} reduced={reduced} onReduced={setReduced} />
        <Row1 />
        <Row2 />
        <Row3 />
        <Row4 />
        <Row5 />
        <Row6 />
        <Row7 />
        <Row8 />
        <Row9 />
        <Row10 />
      <Row11 />
      <Row12 />
      <Row13 />
      <Row13b />
      </main>
    </div>
  );
}

export function GalleryPage() {
  return (
    <ToastProvider>
      <GalleryContent />
    </ToastProvider>
  );
}
