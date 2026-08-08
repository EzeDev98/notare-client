/**
 * Wire types shared across every domain. Generic on purpose — lib/ must not
 * know a note exists (1C's boundary rule).
 */

/**
 * The server's pagination envelope, returned by every list endpoint.
 *
 * `page` is ZERO-BASED, matching Spring's Pageable. A UI that shows "Page 1"
 * has to add one, and forgetting that is an off-by-one that only shows up on
 * the second page.
 */
export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * A timestamp as the server sends it.
 *
 * The server serialises Java LocalDateTime, which carries NO TIMEZONE and NO
 * OFFSET: "2026-08-08T09:14:11.553". JavaScript parses a zoneless ISO string
 * as LOCAL time — which happens to agree with the server for a user in the
 * same zone as the database, and is silently wrong by the offset for everyone
 * else.
 *
 * An alias rather than a branded type: a brand would need a cast at every
 * parse boundary for a payoff we cannot collect until Step 5. The name exists
 * so that `new Date(note.updatedAt)` looks wrong to a reader.
 *
 * DEBT: lib/time.ts — the single place server timestamps get interpreted — was
 * meant to land in Step 1 (decision D8) and did not. The right moment is 5B,
 * where a timestamp is displayed for the first time.
 *
 * One rule that holds regardless: a SYNC CURSOR of this type is opaque and
 * must be echoed back byte for byte. Parsing one into a Date and
 * re-serialising converts it to UTC, shifting the cursor by the local offset
 * and permanently skipping changes.
 */
export type ServerDateTime = string;

/** A JSON body with no meaningful shape — the OTP and password endpoints (B2). */
export interface MessageResponse {
  message: string;
}
