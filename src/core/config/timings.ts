/**
 * Every timing, limit and interval in the app lives here (A-07). Nothing else
 * spells a duration. Each export says what it controls. Names starting with
 * LEGACY_ belong to behaviour the overhaul removes; they stay only so the old
 * code keeps its exact behaviour until the step named on each one deletes it.
 *
 * Animation durations are not here: they come from the motion tokens.
 */

// --- Sync (src/sync/engine.ts) ---------------------------------------------

/** After a local change, wait this long, then push once. */
export const SYNC_AFTER_CHANGE_MS = 2_000;

/** Waits between retries after a failed sync. The last value repeats. */
export const SYNC_BACKOFF_MS: readonly number[] = [5_000, 15_000, 30_000, 60_000];

// --- Server wake-up (src/lib/keepAlive.ts) ---------------------------------

/** Gap between keep-alive pings. Sent only while the tab is visible and online (D-14). */
export const KEEP_ALIVE_MS = 180_000;

// --- Requests (src/lib/http/client.ts) -------------------------------------

/** A request with no timeout of its own is cancelled after this long. */
export const HTTP_TIMEOUT_MS = 15_000;

// --- Polling ---------------------------------------------------------------

/** Unread-notification count refresh. React Query skips it in hidden tabs (D-14). */
export const NOTIFICATIONS_POLL_MS = 60_000;

/** Transcription status refresh. Polling stops when the status is done or failed. */
export const TRANSCRIPTION_POLL_MS = 1_000;

// --- Input -----------------------------------------------------------------

/** Wait after the last keystroke before searching (people and notes). */
export const SEARCH_DEBOUNCE_MS = 300;

/** Hold time that opens the context menu on touch screens. */
export const LONG_PRESS_MS = 500;

// --- Start-up (decideRoute, step 7c) ---------------------------------------

/** The splash stays at least this long, so it never flickers. */
export const SPLASH_MIN_MS = 500;

/** The longest the start-up waits for the font before showing the app anyway. */
export const FONT_WAIT_MAX_MS = 1_500;

// --- Install checks (pwa/installChecks.ts, step 10d) ------------------------

/** The longest an install check waits for the service worker before it counts as failed. */
export const INSTALL_CHECK_TIMEOUT_MS = 15_000;

// --- Toasts (design-system/ui/Toast) ---------------------------------------

/** Default toast time. */
export const TOAST_MS = 4_000;

/** Toasts with an action (Undo) or an error stay longer. */
export const TOAST_LONG_MS = 6_000;

/** Most toasts on screen at once. A new one pushes the oldest out. */
export const TOAST_MAX = 3;

// --- Data (providers/QueryProvider) -----------------------------------------

/** How long fetched data counts as fresh before a refetch is allowed. */
export const QUERY_STALE_MS = 30_000;

// --- Limits (used by the screens built in steps 9 to 13) -------------------

/** Days a deleted note stays in Recently deleted. */
export const TRASH_DAYS = 30;

/** Longest voice clip, in seconds (10 minutes). */
export const CLIP_MAX_SECONDS = 600;

/** Largest voice clip, in bytes (20 MB). */
export const CLIP_MAX_BYTES = 20 * 1024 * 1024;

/** Most characters in one note. */
export const NOTE_MAX_CHARS = 20_000;

// --- Note status (features/notes/status) ------------------------------------

/** "Saving on this device" shows for this long after a change. */
export const SAVING_LOCAL_MS = 700;

/** "Synced" can appear this long after a change, once the server has it. */
export const SYNCED_AFTER_MS = 1_700;

/** The length counter appears from this many characters. */
export const NOTE_COUNTER_FROM = 19_000;

// --- Old screens: removed when the screen that uses them is rebuilt --------

/** NoteDetail waits this long before showing its loading spinner. */
export const LOADING_SPINNER_DELAY_MS = 150;

/** First check that the app runs installed (pwa/displayMode.ts). Goes with useBootPhase in 7c. */
export const STANDALONE_RECHECK_MS = 400;

/** Second, later check for slow reloads (pwa/displayMode.ts). Goes with useBootPhase in 7c. */
export const STANDALONE_RECHECK_LONG_MS = 1_500;

/** Sidebar list enter and exit animation. Matches the CSS. Goes with the old sidebar. */
export const LEGACY_SIDEBAR_ANIMATION_MS = 640;


/** Old single-toast provider. Goes when PatternFly-era components retire (decisions.md, 6e). */
export const LEGACY_TOAST_MS = 8_000;
