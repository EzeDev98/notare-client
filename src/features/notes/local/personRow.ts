/** A person in the People list: someone connected to this account, or invited by it. */
export interface PersonRow {
  /** PRIMARY KEY. The user's id. */
  id: number;

  state: 'connected' | 'pending';

  name: string;

  /** Shown as @username. People are never identified by email. */
  username: string;

  /** The collaboration this person is in, so a pending invite can be cancelled. */
  collaborationId: number;
}
