/** Gallery row: Overlay as modal, sheet and drawer. */
import { useState } from 'react';

import { Button, DetailRow, Overlay, TextField } from '@/design-system/ui';

export function Row7() {
  const [modal, setModal] = useState(false);
  const [forced, setForced] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [drawer, setDrawer] = useState(false);

  return (
    <>
      <h2 className="gallery-group">Row 7: Overlay (modal, sheet, drawer)</h2>
      <section className="gallery-section">
        <h2 className="gallery-section__title">Overlays follow the Theme toggle. Escape closes the top one only.</h2>
        <div className="gallery-row">
          <Button
            onClick={() => {
              setModal(true);
            }}
          >
            Modal
          </Button>
          <Button
            onClick={() => {
              setForced(true);
            }}
          >
            Modal, not dismissible
          </Button>
          <Button
            onClick={() => {
              setSheet(true);
            }}
          >
            Bottom sheet (with stacked modal)
          </Button>
          <Button
            onClick={() => {
              setDrawer(true);
            }}
          >
            Drawer
          </Button>
        </div>
      </section>

      <Overlay
        open={modal}
        onClose={() => {
          setModal(false);
        }}
        title="Delete this note?"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setModal(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setModal(false);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="gallery-text">It is removed for good. This cannot be undone.</p>
      </Overlay>

      <Overlay
        open={forced}
        onClose={() => {
          setForced(false);
        }}
        title="Confirm to continue"
        dismissible={false}
        footer={
          <Button
            variant="primary"
            onClick={() => {
              setForced(false);
            }}
          >
            Understood
          </Button>
        }
      >
        <p className="gallery-text">No close button, and Escape and a click outside do nothing. Only the button closes it.</p>
      </Overlay>

      <Overlay
        open={sheet}
        onClose={() => {
          setSheet(false);
        }}
        variant="sheet"
        title="Note details"
        footer={
          <Button
            variant="ghost"
            onClick={() => {
              setDiscard(true);
            }}
          >
            Discard changes
          </Button>
        }
      >
        <div className="gallery-stack">
          <TextField label="Title" defaultValue="Weekend plan" data-autofocus="" />
          <div>
            <DetailRow label="Created">Today</DetailRow>
            <DetailRow label="Edited">2 min ago</DetailRow>
            <DetailRow label="Words">184</DetailRow>
          </div>
        </div>
      </Overlay>

      <Overlay
        open={discard}
        onClose={() => {
          setDiscard(false);
        }}
        title="Discard changes?"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setDiscard(false);
              }}
            >
              Keep editing
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDiscard(false);
                setSheet(false);
              }}
            >
              Discard
            </Button>
          </>
        }
      >
        <p className="gallery-text">This modal sits on top of the sheet. Escape closes this one first.</p>
      </Overlay>

      <Overlay
        open={drawer}
        onClose={() => {
          setDrawer(false);
        }}
        variant="drawer"
        title="Menu"
        footer={
          <Button
            variant="secondary"
            block
            onClick={() => {
              setDrawer(false);
            }}
          >
            Sign out
          </Button>
        }
      >
        <div className="gallery-stack gallery-pad">
          <Button variant="ghost">All notes</Button>
          <Button variant="ghost">Archived</Button>
          <Button variant="ghost">Settings</Button>
        </div>
      </Overlay>
    </>
  );
}
