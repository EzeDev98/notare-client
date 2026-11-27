/** Every timing, limit and interval in the app. */
export const SYNC_AFTER_CHANGE_MS = 2_000;

export const SYNC_BACKOFF_MS: readonly number[] = [5_000, 15_000, 30_000, 60_000];

export const KEEP_ALIVE_MS = 180_000;

export const HTTP_TIMEOUT_MS = 15_000;

export const NOTIFICATIONS_POLL_MS = 60_000;

export const TRANSCRIPTION_POLL_MS = 1_000;

export const SEARCH_DEBOUNCE_MS = 300;

export const LONG_PRESS_MS = 500;

export const SPLASH_MIN_MS = 500;

export const FONT_WAIT_MAX_MS = 1_500;

export const OFFLINE_RETRY_MIN_BUSY_MS = 1_000;

export const INSTALL_CHECK_TIMEOUT_MS = 15_000;

export const TOAST_MS = 4_000;

export const TOAST_LONG_MS = 6_000;

export const TOAST_MAX = 3;

export const QUERY_STALE_MS = 30_000;

export const CLIP_MAX_SECONDS = 600;

export const CLIP_MAX_BYTES = 20 * 1024 * 1024;

export const SAVING_LOCAL_MS = 700;

export const SYNCED_AFTER_MS = 1_700;

export const STORAGE_NEAR_FULL_PERCENT = 90;

export const SYNC_NOW_MIN_BUSY_MS = 1_000;

export const LAST_SYNCED_REFRESH_MS = 30_000;

export const UPDATE_RELOAD_GIVE_UP_MS = 5_000;

export const LOADING_SPINNER_DELAY_MS = 150;

export const STANDALONE_RECHECK_MS = 400;

export const STANDALONE_RECHECK_LONG_MS = 1_500;

export const LEGACY_SIDEBAR_ANIMATION_MS = 640;
