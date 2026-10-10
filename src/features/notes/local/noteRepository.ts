import { noteCommands } from '@/features/notes/local/noteCommands';
import { noteQueries } from '@/features/notes/local/noteQueries';
import { noteServerWrites } from '@/features/notes/local/noteServerWrites';

/**
 * Kept for one release so existing imports keep working (step 8c). New code
 * imports `noteQueries`, `noteCommands`, `noteServerWrites`, `outboxRepository` and
 * `metaRepository` from their own files. Delete this file after 8m.
 */
export const noteRepository = { ...noteQueries, ...noteCommands, ...noteServerWrites };

export { metaRepository } from '@/features/notes/local/metaRepository';
export { outboxRepository } from '@/features/notes/local/outboxRepository';
