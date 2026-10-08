/**
 * 32-bit FNV-1a over UTF-16 code units (`charCodeAt`). Every code unit,
 * including both halves of a surrogate pair, contributes to the result, so
 * distinct non-BMP characters do not collide. Returns an unsigned integer.
 */
export function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
