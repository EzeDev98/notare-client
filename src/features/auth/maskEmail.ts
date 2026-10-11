/** "ada.obi@example.com" -> "a******@example.com". Anything without an "@" is returned as it is. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  return `${user.charAt(0)}${'*'.repeat(Math.max(2, user.length - 1))}@${domain}`;
}
