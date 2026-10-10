import { Button, useToast } from '@/design-system/ui';

/** Gallery: row 8, Toast. */
export function Row8() {
  const toast = useToast();
  return (
    <>
      <h2 className="gallery-group">Row 8: Toast</h2>
      <section className="gallery-section">
        <h2 className="gallery-section__title">Max 3 at once. 4s, or 6s for errors and Undo. Hover or focus pauses the timer.</h2>
        <div className="gallery-row">
          <Button
            onClick={() => {
              toast.show({ message: 'Note moved to Archived.' });
            }}
          >
            Neutral
          </Button>
          <Button
            onClick={() => {
              toast.show({ message: 'Copied to clipboard.', tone: 'success' });
            }}
          >
            Success
          </Button>
          <Button
            onClick={() => {
              toast.show({ message: 'Could not save. Try again.', tone: 'error' });
            }}
          >
            Error
          </Button>
          <Button
            onClick={() => {
              toast.show({ message: 'Note deleted.', action: { label: 'Undo', onAction: () => undefined } });
            }}
          >
            With Undo
          </Button>
          <Button
            onClick={() => {
              for (let count = 1; count <= 4; count += 1) {
                toast.show({ message: `Toast number ${String(count)}` });
              }
            }}
          >
            Fire four
          </Button>
        </div>
      </section>
    </>
  );
}
