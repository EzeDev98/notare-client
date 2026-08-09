/**
 * Client-side mirrors of the server's bean-validation rules.
 *
 * DUPLICATION, deliberately. B2 means the server now returns per-field errors,
 * so it CAN tell us what is wrong — but a network round trip to learn that a
 * password needs a digit is a poor experience for a rule we already know.
 *
 * The cost is drift: change the server regex and this silently disagrees. The
 * mitigation is not cleverness, it is placement — one module, and the server's
 * own message strings copied VERBATIM so a mismatch is visible from either
 * side.
 *
 * These are for feedback, never for security. The server revalidates
 * everything and remains the only authority.
 */

/** ^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$ — copied from RegistrationRequest. */
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/;

export const AUTH_LIMITS = {
  usernameMin: 3,
  usernameMax: 30,
  passwordMin: 8,
  passwordMax: 64,
  nameMax: 50,
  otpLength: 6,
} as const;

export function validateUsername(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return 'Username is required.';
  if (trimmed.length < AUTH_LIMITS.usernameMin || trimmed.length > AUTH_LIMITS.usernameMax) {
    return 'Username must be between 3 and 30 characters.';
  }
  return undefined;
}

export function validateEmail(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return 'Email address is required.';
  /*
   * Deliberately loose. A regex that tries to fully implement RFC 5322 is
   * famously long and still rejects valid addresses — and the only real proof
   * an address works is that a code arrives at it, which is the next step
   * anyway. This catches typos, not invalid addresses.
   */
  if (!trimmed.includes('@') || trimmed.startsWith('@') || trimmed.endsWith('@')) {
    return 'Please provide a valid email address.';
  }
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (value === '') return 'Password is required.';
  if (value.length < AUTH_LIMITS.passwordMin || value.length > AUTH_LIMITS.passwordMax) {
    return 'Password must be between 8 and 64 characters.';
  }
  if (!PASSWORD_PATTERN.test(value)) {
    return 'Password must contain at least one uppercase letter, one lowercase letter, and one digit.';
  }
  return undefined;
}

export function validateConfirmation(password: string, confirmation: string): string | undefined {
  if (confirmation === '') return 'Please confirm your password.';
  if (password !== confirmation) return 'Passwords do not match.';
  return undefined;
}

export function validateRequiredName(value: string, label: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return `${label} is required.`;
  if (trimmed.length > AUTH_LIMITS.nameMax) return `${label} must not exceed 50 characters.`;
  return undefined;
}

export function validateOtpCode(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return 'Code is required.';
  if (!/^\d{6}$/.test(trimmed)) return 'Enter the 6-digit code.';
  return undefined;
}
