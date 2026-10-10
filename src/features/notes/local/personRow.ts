/** A person in the People list: someone connected to this account, or invited. */
export interface PersonRow {
  /** PRIMARY KEY. The user's id. */
  id: number;

  state: 'connected' | 'pending';

  name: string;
  email: string;
}
