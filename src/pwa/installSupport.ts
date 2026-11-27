/** Which install flow this browser supports. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;

  const userAgentIsIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isIPadOSReportingAsMac =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  return userAgentIsIOS || isIPadOSReportingAsMac;
}

function supportsBeforeInstallPromptEvent(): boolean {
  return typeof window !== 'undefined' && 'onbeforeinstallprompt' in window;
}

export type InstallFlowSupport = 'native' | 'instructional';

export function getInstallFlowSupport(): InstallFlowSupport {
  if (isIOS()) return 'instructional';
  return supportsBeforeInstallPromptEvent() ? 'native' : 'instructional';
}
