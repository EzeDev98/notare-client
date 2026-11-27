/** Words on the sign-in, registration and password screens. */
export const RESEND_COOLDOWN_SECONDS = 60;

export const WELCOME = {
  title: 'Welcome to Notare',
  description: 'Write, speak and share your notes. They stay with you, even offline.',
  createAccount: 'Create account',
  signIn: 'Sign in',
} as const;

export const LOGIN = {
  title: 'Sign in',
  description: 'Welcome back. Enter your username or email and your password.',
  submit: 'Sign in',
  resetLink: 'Reset your password',
  labels: {
    identifier: 'Username or email',
    password: 'Password',
  },
} as const;

export const REGISTER_PERSONAL = {
  title: 'Create your account',
  description: 'Tell us who you are.',
  submit: 'Continue',
  labels: {
    firstName: 'First name',
    lastName: 'Last name',
  },
} as const;

export const REGISTER_ACCOUNT = {
  title: 'Choose how you sign in',
  description: 'Pick a username and a password.',
  submit: 'Create account',
  labels: {
    username: 'Username',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
  },
  hints: {
    username: '3 to 30 characters.',
    password: 'At least 8 characters, with an uppercase letter, a lowercase letter and a digit.',
  },
} as const;

export const REGISTER_STEPS = {
  total: 2,
  label: (step: number): string => `Step ${String(step)} of ${String(REGISTER_STEPS.total)}`,
} as const;

export const CHECK_EMAIL = {
  title: 'Check your email',
  description: (email: string): string =>
    `We sent a verification link to ${email}. Open it, then sign in.`,
  descriptionLost:
    'We sent a verification link to the email address on your account. Open it, then sign in.',
  identifierLabel: 'Email or Notarian ID',
  resend: 'Resend email',
  resendIn: (seconds: number): string => `Resend email in ${String(seconds)}s`,
  backToSignIn: 'Sign in',
} as const;

export const RESET_REQUEST = {
  title: 'Reset your password',
  description: 'Enter your email address and we will send you a code.',
  submit: 'Send code',
  labels: { email: 'Email address' },
} as const;

export const RESET_CODE = {
  title: 'Enter the code',
  description: (email: string): string =>
    `If an account exists for ${email}, a code is on its way. Codes expire after 10 minutes.`,
  submit: 'Verify',
  resend: 'Resend code',
  resendIn: (seconds: number): string => `Resend code in ${String(seconds)}s`,
  otpLabel: 'Verification code',
  otpDigitLabel: (index: number, length: number): string =>
    `Digit ${String(index)} of ${String(length)}`,
} as const;

export const RESET_NEW_PASSWORD = {
  title: 'Choose a new password',
  description: 'Use a password you have not used here before.',
  submit: 'Update password',
  labels: {
    password: 'New password',
    confirmPassword: 'Confirm new password',
  },
  hint: 'At least 8 characters, with an uppercase letter, a lowercase letter and a digit.',
} as const;

export const ERRORS = {
  wrongCredentials: 'Incorrect username or password.',
  accountUnavailable: 'This account is unavailable. Please contact support.',
  notVerified: 'Your account is not verified yet. Open the link we emailed you, then sign in.',
  notVerifiedAction: 'Check email',
  offline: 'Cannot reach Notare. Check your connection and try again.',
  generic: 'Something went wrong. Please try again.',
  usernameTaken: 'That username is taken.',
  emailTaken: 'An account with this email already exists.',
  wrongCode: 'That code is not right.',
} as const;

export const SESSION_BANNERS = {
  expired: {
    title: 'Your session expired',
    text: 'Please sign in again to continue.',
  },
  revoked: {
    title: 'You were signed out',
    text: 'This session was signed out from another device. Sign in again to continue.',
  },
} as const;

export const TOASTS = {
  passwordUpdated: 'Password updated. Sign in with your new password.',
} as const;

export const LOGIN_FIELD_ERRORS = {
  identifierRequired: 'Enter your username or email address.',
  passwordRequired: 'Enter your password.',
} as const;

export const VERIFIED_BANNER = 'Your account is verified. Sign in to continue.';

export const CHECK_EMAIL_MESSAGES = {
  goToSignIn: 'Go to sign in',
  identifierRequired: 'Enter your email or Notarian ID.',
  resentToast: 'A new email is on its way.',
} as const;

export const REGISTER_CONFLICT = 'That username or email is already registered.';

export const RESET_MESSAGES = {
  resentToast: 'A new code is on its way.',
  linkExpired: 'That reset link has expired. Start again.',
} as const;
