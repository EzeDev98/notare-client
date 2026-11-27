import { useEffect, useRef, useState } from 'react';
import { RouterProvider } from 'react-router';

import { AppErrorBoundary } from '@/app/AppErrorBoundary';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { router } from '@/app/router';
import { OfflineFirstOpen } from '@/app/startup/OfflineFirstOpen';
import { StartupSplash } from '@/app/startup/StartupSplash';
import { STARTUP_COPY } from '@/app/startup/startupContent';
import { useStartup } from '@/app/startup/useStartup';
import { done, run } from '@/design-system/motion/motion';
import { OnboardingPage } from '@/pages/Onboarding/Onboarding';
import { ToastProvider, useToast } from '@/design-system/ui';
import { UpdateRequiredModal } from '@/pwa/components/UpdateRequiredModal';
import { useUpdatedToast } from '@/pwa/useUpdatedToast';

/**
 * The single start-up hand-off (master 5.5). The splash (the same element as
 * the static one in index.html) stays on top until useStartup has decided and
 * moved the router, then fades out over the screen that is already there, so
 * there is no redirect to see and no second splash.
 *
 * Final answers only move forward: once the router is showing, nothing later
 * (auth changes, a display-mode blip) swaps the tree back, because that would
 * unmount everything and read as a reload.
 *
 * A child of AuthProvider because useStartup reads the session.
 */
function AppStage() {
  const { outcome, retry, continueInBrowser } = useStartup();
  const { toast } = useToast();
  const splashRef = useRef<HTMLDivElement>(null);
  const [splashGone, setSplashGone] = useState(false);
  const revealed = outcome !== 'waiting';
  useUpdatedToast(revealed);

  useEffect(() => {
    const splash = splashRef.current;
    if (!revealed || !splash) return;
    let cancelled = false;
    const fade = run(splash, [{ opacity: 1 }, { opacity: 0 }], {
      duration: '--motion-reveal',
      easing: '--ease-out',
      fill: 'forwards',
    });
    void done(fade).then(() => {
      if (!cancelled) setSplashGone(true);
    });
    return () => {
      cancelled = true;
      fade.cancel();
    };
  }, [revealed]);

  async function retryAndWelcome(): Promise<boolean> {
    const connected = await retry();
    if (connected) toast(STARTUP_COPY.connected, { tone: 'success' });
    return connected;
  }

  return (
    <>
      {outcome === 'install' ? <OnboardingPage onContinueInBrowser={continueInBrowser} /> : null}
      {outcome === 'offline' ? <OfflineFirstOpen onRetry={retryAndWelcome} /> : null}
      {outcome === 'app' ? (
        <QueryProvider>
          <RouterProvider router={router} />
        </QueryProvider>
      ) : null}
      {splashGone ? null : <StartupSplash ref={splashRef} />}
    </>
  );
}

/**
 * The one toast host (step 7e). Mounted once, above the stage, so a toast works
 * on every screen, including the ones that show before the router does (the
 * offline first-open screen).
 */
function AppBoot() {
  return (
    <ToastProvider>
      <AppStage />
    </ToastProvider>
  );
}

/**
 * The composition root. Providers wrap RouterProvider and accumulate here as
 * later steps add them - auth, query client, sync.
 *
 * ThemeProvider is outermost: an error boundary rendering inside the router
 * should still be themed.
 *
 * UpdateRequiredModal sits outside AuthProvider: the server can say "too old"
 * whether or not anyone is signed in, and nothing should be usable behind it.
 */
export function App() {
  return (
    <ThemeProvider>
      <AppErrorBoundary>
        <UpdateRequiredModal />
        <AuthProvider>
          <AppBoot />
        </AuthProvider>
      </AppErrorBoundary>
    </ThemeProvider>
  );
}
