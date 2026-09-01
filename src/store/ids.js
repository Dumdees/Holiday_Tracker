// Short, unique, URL-safe ids. Prefix tells you what kind of record it is.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

export function newId(prefix = 'x') {
  let s = '';
  const bytes = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${s}`;
}
