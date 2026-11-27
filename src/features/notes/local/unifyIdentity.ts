/** Plans the database upgrade that gives every note one id. */
import type { NoteRow } from './noteRow';

export function planIdentityMerge(
  rows: Pick<NoteRow, 'localId' | 'clientId'>[],
): Map<string, string> {
  const localIds = new Set(rows.map((row) => row.localId));

  const clientIdCounts = new Map<string, number>();
  for (const row of rows) {
    clientIdCounts.set(row.clientId, (clientIdCounts.get(row.clientId) ?? 0) + 1);
  }

  const plan = new Map<string, string>();
  for (const row of rows) {
    const { localId, clientId } = row;
    if (typeof clientId !== 'string' || clientId === '' || clientId === localId) continue;
    if (clientIdCounts.get(clientId) !== 1) continue;
    if (localIds.has(clientId)) continue;
    plan.set(localId, clientId);
  }
  return plan;
}
