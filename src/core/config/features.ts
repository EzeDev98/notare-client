/** Features that are built but not switched on yet. One flag each, all in this file. */
export const FEATURES: { leaveNote: boolean; accountDelete: boolean; passwordChange: boolean } = {
  /** "Leave this note" in the row menu. The server call arrives in step 17. */
  leaveNote: false,
  /** "Delete account" on the Account screen. The server call arrives with B-03 (step 17). */
  accountDelete: false,
  /** "Change password" in Security. The server call arrives with B-02 (step 17). */
  passwordChange: false,
};
