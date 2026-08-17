/**
 * A row from GET /user/lookup — matches the server's
 * `UserSummaryResponse` record (`com.notare.feature.user.dto.response`)
 * field-for-field: `id`, `username`, `firstName`, `lastName`. No email,
 * same public-profile shape `/user/search` returns.
 *
 * NOT the same type as `features/collaboration/types.ts`'s own
 * `UserSummaryResponse`, which additionally carries a `notarianId` field
 * that isn't part of this server DTO (that file self-flags it as inferred,
 * not confirmed). Deliberately not reused or merged with it here — this
 * type is the confirmed shape for the lookup endpoint specifically, and
 * reconciling the two is out of scope for this feature.
 */
export interface UserSummaryResponse {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
}
