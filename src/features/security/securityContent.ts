/** All words for the PIN lock: the Security screen, its modal and the lock screen (master 6.6). */
export const SECURITY_COPY = {
  lock: {
    label: 'Lock Notare with a PIN',
    hint: 'Notare asks for your PIN each time you open it. The PIN stays on this device, so it works offline.',
  },
  change: 'Change PIN',
  passwordHeading: 'Password',
  password: 'Change password',
  pin: {
    label: 'PIN',
    create: {
      title: 'Create a PIN',
      desc: 'Choose a 4-digit PIN. Notare will ask for it each time you open the app.',
    },
    confirm: { title: 'Confirm your PIN', desc: 'Enter the same PIN again.' },
    current: { title: 'Enter your PIN', desc: 'Enter the PIN you use now to continue.' },
    next: { title: 'Choose a new PIN', desc: 'Choose a new 4-digit PIN.' },
    mismatch: 'The PINs do not match. Try again.',
    wrong: (left: number) => `Wrong PIN. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`,
    lockedOut: 'Too many wrong PINs. Sign in again to reset it.',
    forgot: 'Forgot PIN? Sign in again',
    turnedOn: 'App lock is on.',
    turnedOff: 'App lock is off.',
    changed: 'PIN changed.',
  },
} as const;
