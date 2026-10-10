import { BannerSlot, Button, InfoBanner } from '@/design-system/ui';

import { Both } from './Both';

/** Gallery: row 6, InfoBanner and the banner slot. */
export function Row6() {
  return (
    <>
      <h2 className="gallery-group">Row 6: InfoBanner, BannerSlot</h2>
      <Both title="InfoBanner: info, error">
        <div className="gallery-stack">
          <InfoBanner>Your notes are saved on this device.</InfoBanner>
          <InfoBanner tone="error">Could not reach the server.</InfoBanner>
        </div>
      </Both>
      <Both title="InfoBanner: title and action">
        <div className="gallery-stack">
          <InfoBanner title="Your session ended" action={<Button>Sign in</Button>}>
            Sign in again to keep syncing.
          </InfoBanner>
          <InfoBanner
            tone="error"
            title="Sync paused"
            action={<Button>Retry</Button>}
          >
            We could not reach the server. Your notes are safe on this device.
          </InfoBanner>
        </div>
      </Both>
      <Both title="BannerSlot: empty, info, error (the dashed box is the reserved space)">
        <div className="gallery-stack">
          <div className="gallery-slot">
            <BannerSlot />
          </div>
          <div className="gallery-slot">
            <BannerSlot>
              <InfoBanner>You are offline. Notes are saved on this device.</InfoBanner>
            </BannerSlot>
          </div>
          <div className="gallery-slot">
            <BannerSlot>
              <InfoBanner tone="error">Sync paused.</InfoBanner>
            </BannerSlot>
          </div>
        </div>
      </Both>
    </>
  );
}
