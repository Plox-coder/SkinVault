/**
 * Portable, versioned skin-ID snapshots for static hosting.
 * Only owned skin IDs are shared. No account name, passwords, JSON backup,
 * browser storage, or prices entered by the account owner leave the device.
 *
 * IDs are sorted and delta-encoded as unsigned base-128 varints, then
 * base64url-encoded in a URL fragment (never sent in the HTTP request).
 */
const PREFIX = '#share=v1.';
const MAX_SKINS = 6000;
const MAX_LINK_PAYLOAD = 60000;
const MAX_SKIN_ID = 9_999_999_999;

export type ParsedShare =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'shared'; ids: string[] };

function isSkinId(value: string): boolean {
  if (!/^\d{1,10}$/.test(value)) return false;
  const num = Number(value);
  return Number.isSafeInteger(num) && num > 0 && num <= MAX_SKIN_ID && num % 1000 !== 0;
}

function writeVarint(value: number, into: number[]): void {
  while (value >= 128) {
    into.push((value % 128) | 128);
    value = Math.floor(value / 128);
  }
  into.push(value);
}

function readVarint(bytes: Uint8Array, offset: { pos: number }): number {
  let value = 0;
  let multiplier = 1;
  for (let i = 0; i < 8; i++) {
    if (offset.pos >= bytes.length) throw new Error('Truncated integer');
    const byte = bytes[offset.pos++];
    value += (byte & 127) * multiplier;
    if (!Number.isSafeInteger(value)) throw new Error('Invalid integer');
    if (byte < 128) return value;
    multiplier *= 128;
  }
  throw new Error('Integer too large');
}

export function encodeShareHash(ownedIds: readonly string[]): string {
  const ids = [...new Set(ownedIds)];
  if (!ids.length || ids.length > MAX_SKINS || !ids.every(isSkinId)) {
    throw new Error('Invalid shared skin collection');
  }
  ids.sort((a, b) => Number(a) - Number(b));
  const bytes: number[] = [];
  writeVarint(ids.length, bytes);
  let previous = 0;
  for (const id of ids) {
    const value = Number(id);
    writeVarint(value - previous, bytes);
    previous = value;
  }
  // Avoid spreading thousands of arguments into String.fromCharCode.
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return PREFIX + btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function parseShareHash(hash: string): ParsedShare {
  if (!hash.startsWith('#share=')) return { kind: 'none' };
  if (!hash.startsWith(PREFIX)) return { kind: 'invalid' };
  const encoded = hash.slice(PREFIX.length);
  if (!encoded || encoded.length > MAX_LINK_PAYLOAD || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    return { kind: 'invalid' };
  }
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
    const cursor = { pos: 0 };
    const count = readVarint(bytes, cursor);
    if (!count || count > MAX_SKINS) throw new Error('Invalid count');
    const ids: string[] = [];
    let previous = 0;
    for (let i = 0; i < count; i++) {
      const delta = readVarint(bytes, cursor);
      if (delta <= 0) throw new Error('Invalid order');
      previous += delta;
      const id = String(previous);
      if (!isSkinId(id)) throw new Error('Invalid skin ID');
      ids.push(id);
    }
    if (cursor.pos !== bytes.length) throw new Error('Unexpected content');
    return { kind: 'shared', ids };
  } catch {
    return { kind: 'invalid' };
  }
}
