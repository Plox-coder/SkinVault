import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encodeShareHash, parseShareHash } from '../src/shareCollection.ts';

test('a share link round-trips sorted owned skin IDs without duplicates', () => {
  const ids = ['222060', '11001', '4001', '11001', '43019'];
  const link = encodeShareHash(ids);
  assert.match(link, /^#share=v1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(parseShareHash(link), {kind: 'shared', ids: ['4001', '11001', '43019', '222060']});
  assert.ok(link.length < 60);
  assert.doesNotMatch(link, /Plox|account|summoner|name/i);
});

test('large owned collections fit a reasonably sized URL fragment', () => {
  const ids = Array.from({length: 2000}, (_, i) => String(1001 + i * 1000 + (i % 999)));
  const link = encodeShareHash(ids);
  assert.equal(parseShareHash(link).kind, 'shared');
  assert.ok(link.length < 7000);
});

test('rejects malformed / tampered share links safely', () => {
  assert.deepEqual(parseShareHash(''), {kind: 'none'});
  assert.deepEqual(parseShareHash('#irrelevant'), {kind: 'none'});
  for (const bad of ['#share=', '#share=v0.test', '#share=v1.', '#share=v1.*',
    '#share=v1.' + 'A'.repeat(60001), '#share=v1.' + btoa('\x01\x01')]) {
    assert.deepEqual(parseShareHash(bad), {kind: 'invalid'});
  }
  for (const badIds of [[], ['0'], ['1000'], ['hello'], ['10000000000']]) {
    assert.throws(() => encodeShareHash(badIds));
  }
});

test('only skin IDs are encoded, not collection names, RP overrides, or personal data', () => {
  const hash = encodeShareHash(['4001', '11001']);
  assert.equal(decodeURIComponent(hash).includes('name'), false);
  assert.equal(parseShareHash(hash).kind, 'shared');
});

test('the read-only view never saves shared skin data as a local collection', () => {
  const jsx = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(jsx, /if \(isSharing\) return;/);
  assert.match(jsx, /skin\.owned \? t\('own'\)/);
  assert.match(jsx, /shareReadOnly/);
});
