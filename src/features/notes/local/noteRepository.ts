/** Old entry point to the note tables, kept for existing imports. */
import { noteCommands } from '@/features/notes/local/noteCommands';
import { noteQueries } from '@/features/notes/local/noteQueries';
import { noteServerWrites } from '@/features/notes/local/noteServerWrites';

export const noteRepository = { ...noteQueries, ...noteCommands, ...noteServerWrites };

export { metaRepository } from '@/features/notes/local/metaRepository';
export { outboxRepository } from '@/features/notes/local/outboxRepository';
