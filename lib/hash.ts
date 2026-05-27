/**
 * Returns a lowercase hex SHA-256 digest of the normalised email.
 * Works in browser (Web Crypto) and Node 20+ (global crypto).
 */
export async function hashEmail(email: string): Promise<string> {
  const normalised = email.trim().toLowerCase();
  const encoded = new TextEncoder().encode(normalised);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
