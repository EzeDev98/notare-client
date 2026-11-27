/** Root component: providers, start-up and the router. */
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

function AppBoot() {
  return (
    <ToastProvider>
      <AppStage />
    </ToastProvider>
  );
}

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
