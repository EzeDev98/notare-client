import { useState } from 'react';
import { CheckIcon, PlusIcon, ShareSquareIcon } from '@patternfly/react-icons';

import { Button } from '@/design-system/components/Button/Button';
import { Logo } from '@/design-system/components/Logo/Logo';
import { useIsStandalone } from '@/pwa/displayMode';
import { getInstallFlowSupport } from '@/pwa/installSupport';
import { useInstallPrompt } from '@/pwa/useInstallPrompt';
import './InstallPage.css';

/**
 * Step 3b. Real Notare copy — see prior revision's note on why each
 * bullet maps to something the product actually does (manifest
 * description, README's local-first claim, real src/features areas).
 *
 * Step 3c: wired to promptInstall().
 *
 * Step 3d. Hard-gate behaviour. Two things make this a gate rather than
 * just a themed dialog:
 *
 * 1. NO SKIP/DISMISS CONTROL, anywhere on this page — deliberately.
 *    There is no "not now" the way InstallBanner has one. The only way
 *    off this screen is the standalone signal below actually flipping,
 *    or Step 4's bootPhase independently deciding to move on. Nothing
 *    rendered here gives the user a way to bypass it themselves.
 *
 * 2. useIsStandalone(), not just useInstallPrompt()'s `available`. Read
 *    installPrompt.ts closely: promptInstall() sets
 *    `dismissedOrInstalled = true` and notifies `available: false` on
 *    ANY resolved userChoice — accepted OR dismissed. That means
 *    `available` alone cannot tell "installed" and "dismissed" apart,
 *    and a gate that treated them the same would either declare victory
 *    on a dismissal or keep nagging after a real install. The
 *    `display-mode` media query is the one signal that only changes
 *    when installation actually succeeds — so THAT is what decides
 *    whether to show a done state, not `available`.
 *
 * `available` still has its own, narrower job here: while it's false
 * (event not yet captured, or already consumed by a prior click), the
 * button is disabled rather than silently doing nothing, with copy
 * that tells the user their one recovery path (reload) instead of
 * leaving a dead button with no explanation. `prompting` covers the
 * in-flight moment between click and userChoice resolving.
 *
 * Step 9. Icon badge + bordered benefits box added around the same
 * content, for a more intentional mobile layout — see InstallPage.css.
 * No logic changed here, only the wrapping markup.
 */

/**
 * Step 3e. The instructional variant. `installSupport.ts` collapses
 * every non-native case into one 'instructional' bucket — iOS Safari,
 * iOS Chrome/Firefox/Edge, AND non-iOS browsers that simply lack
 * beforeinstallprompt. This leads with the single most common real
 * case (iOS Safari, "Add to Home Screen") and closes with a
 * deliberately generic line covering everyone else in that bucket.
 *
 * window.close() is NOT guaranteed here — most browsers only allow a
 * script to close a tab it opened itself. Where the browser blocks it,
 * calling it is simply a silent no-op.
 */
function InstallInstructions() {
  return (
    <>
      <ol className="install-page__steps">
        <li>
          <ShareSquareIcon aria-hidden="true" className="install-page__benefit-icon" />
          <span>Tap the Share icon in your browser's toolbar.</span>
        </li>
        <li>
          <PlusIcon aria-hidden="true" className="install-page__benefit-icon" />
          <span>Scroll down and tap "Add to Home Screen".</span>
        </li>
        <li>
          <CheckIcon aria-hidden="true" className="install-page__benefit-icon" />
          <span>Tap "Add" to finish.</span>
        </li>
      </ol>
      <p className="install-page__status" role="status">
        On iPhone or iPad, this works in Safari. On a computer, look for "Install Notare" in your
        browser's menu instead.
      </p>

      <Button
        variant="primary"
        className="install-page__cta"
        onClick={() => {
          window.close();
        }}
      >
        Continue
      </Button>
    </>
  );
}

export function InstallPage() {
  const { available, promptInstall } = useInstallPrompt();
  const isStandalone = useIsStandalone();
  const [prompting, setPrompting] = useState(false);
  // installSupport.ts's own doc comment: a browser cannot gain or lose
  // this API mid-session, so this is read once via lazy useState init,
  // not recomputed on every one of this component's other re-renders.
  const [flowSupport] = useState(getInstallFlowSupport);

  async function handleInstallClick(): Promise<void> {
    setPrompting(true);
    try {
      await promptInstall();
    } finally {
      setPrompting(false);
    }
  }

  return (
    <div className="install-page" role="status" aria-live="polite">
      <div className="install-page__panel">
        <div className="install-page__icon">
          <Logo />
        </div>

        {isStandalone ? (
          /*
           * The definitive done state — display-mode actually flipped
           * to standalone. Step 4's bootPhase will notice this too and
           * move on; this exists so there's never a visible moment of
           * "keep waiting" after installation has genuinely succeeded.
           */
          <p className="install-page__status" role="status">
            Notare is installed. Continuing…
          </p>
        ) : (
          <>
            <h1 className="install-page__heading">Ready to install</h1>
            <p className="install-page__description">
              Install Notare on your device for the full local-first experience — no browser bar,
              opens like any other app.
            </p>

            <div className="install-page__benefits-box">
              <ul className="install-page__benefits">
                <li>
                  <CheckIcon aria-hidden="true" className="install-page__benefit-icon" />
                  <span>Works offline — your notes and voice memos are always there</span>
                </li>
                <li>
                  <CheckIcon aria-hidden="true" className="install-page__benefit-icon" />
                  <span>Opens instantly from your home screen, full-screen</span>
                </li>
                <li>
                  <CheckIcon aria-hidden="true" className="install-page__benefit-icon" />
                  <span>Syncs and shares with collaborators the moment you're back online</span>
                </li>
              </ul>
            </div>

            {flowSupport === 'native' ? (
              <>
                <Button
                  variant="primary"
                  className="install-page__cta"
                  disabled={!available}
                  loading={prompting}
                  onClick={() => void handleInstallClick()}
                >
                  Install now
                </Button>

                {!available && !prompting ? (
                  <p className="install-page__status" role="status">
                    Waiting for your browser to allow installation. Already saw a prompt and
                    closed it? Reload this page to try again.
                  </p>
                ) : null}
              </>
            ) : (
              <InstallInstructions />
            )}
          </>
        )}
      </div>
    </div>
  );
}
