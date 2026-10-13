import { SETTINGS_COPY } from './settingsContent';

const NAMES = SETTINGS_COPY.devices.names;
const BROWSERS = SETTINGS_COPY.devices.browsers;

/* Order matters: an iPhone string also says "Mac OS X", an Android one also says "Linux". */
const PLATFORMS: ReadonlyArray<[RegExp, string]> = [
  [/iPhone/, NAMES.iphone],
  [/iPad/, NAMES.ipad],
  [/Android/, NAMES.android],
  [/CrOS/, NAMES.chromebook],
  [/Windows/, NAMES.windows],
  [/Macintosh|Mac OS X/, NAMES.mac],
  [/Linux/, NAMES.linux],
];

/* Edge, Opera and Chrome all say "Chrome" too, so the specific ones come first. */
const BROWSER_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/Edg\//, BROWSERS.edge],
  [/OPR\//, BROWSERS.opera],
  [/Firefox\/|FxiOS/, BROWSERS.firefox],
  [/CriOS|Chrome\//, BROWSERS.chrome],
  [/Safari\//, BROWSERS.safari],
];

/** "Mac, Chrome". Until the server sends a device label (B-14) this is read from the browser string. */
export function deviceName(userAgent: string | null): string {
  if (!userAgent) return NAMES.unknown;
  const platform = PLATFORMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const browser = BROWSER_PATTERNS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const parts = [platform, browser].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? parts.join(', ') : NAMES.unknown;
}
