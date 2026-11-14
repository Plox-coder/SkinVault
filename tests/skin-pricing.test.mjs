import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { skinPrice, sanctumMaximumRp } from '../src/skinPricing.ts';
import { historicalSkinCount, lookupHistoricalSkin } from '../src/skinPriceReference.ts';

const makeSkin = (id, name = 'Ejemplo', rp = null) => ({ id: String(id), name, rp });

test('precios normales automáticos por ID, sin depender del idioma', () => {
  assert.ok(historicalSkinCount >= 1900);
  assert.deepEqual(skinPrice(makeSkin(11001, 'Maestro Yi asesino'), 'normal'),
    { currency: 'rp', amount: 390, automatic: true });
  assert.deepEqual(skinPrice(makeSkin(12002, 'Alistar dorado'), 'normal'),
    { currency: 'rp', amount: 390, automatic: true });
  for (const [id, amount] of [[6001, 520], [59002, 750], [59003, 975]]) {
    assert.deepEqual(skinPrice(makeSkin(id), 'normal'), { currency: 'rp', amount, automatic: true });
  }
});

test('las recompensas especiales no suman RP aunque un JSON anterior indique precio', () => {
  assert.deepEqual(skinPrice(makeSkin(4001, 'PAX Twisted Fate', 9999), 'normal'),
    { currency: 'special', kind: 'promo' });
  assert.deepEqual(skinPrice(makeSkin(59004, 'Jarvan IV victorioso'), 'normal'),
    { currency: 'special', kind: 'ranked' });
});

test('las excepciones históricas se imponen a rareza y ediciones anteriores', () => {
  assert.deepEqual(skinPrice(makeSkin(9006, 'Fiddlesticks fiesta sorpresa', 1820), 'legendary', {9006: {rpOverride: 750}}),
    { currency: 'rp', amount: 975, automatic: true });
  assert.deepEqual(skinPrice(makeSkin(21016), 'ultimate', {21016: {rpOverride: 3250}}),
    { currency: 'rp', amount: 2775, automatic: true });
  assert.deepEqual(skinPrice(makeSkin(11001, 'Master Yi', 850), 'normal'),
    { currency: 'rp', amount: 390, automatic: true });
});

test('esencia mítica asignada y bloqueada por ID: 100, 125, 150 y 200', () => {
  for (const [id, amount] of [[43019, 100], [12019, 125], [266008, 150], [24032, 200]]) {
    assert.deepEqual(skinPrice(makeSkin(id, 'Nombre arbitrario'), 'mythic', {
      [id]: { mode: 'sanctum', essence: 200, rpOverride: 55000 },
    }), { currency: 'essence', amount });
  }
});

test('las variantes del Sanctum se resuelven por ID aunque sean míticas', () => {
  for (const id of [103089, 136038, 131077, 245056, 236072, 11116, 21032, 267068, 238068]) {
    assert.deepEqual(skinPrice(makeSkin(id), 'mythic', {[id]: {mode: 'essence', essence: 150}}),
      { currency: 'sanctum', pity: 40 });
  }
  assert.equal(sanctumMaximumRp(40), 16000);
  assert.equal(sanctumMaximumRp(80), 32000);
});

test('las exaltadas muestran límite garantizado de 80 chispas', () => {
  for (const id of [222060, 82054, 25080, 875066, 234043]) {
    assert.deepEqual(skinPrice(makeSkin(id), 'exalted'), { currency: 'sanctum', pity: 80 });
  }
  assert.deepEqual(skinPrice(makeSkin(9999999), 'exalted'), { currency: 'sanctum', pity: 80 });
});

test('desconocidos no reciben precio imaginado y no aceptan ediciones guardadas', () => {
  assert.equal(lookupHistoricalSkin('9999999'), undefined);
  assert.deepEqual(skinPrice(makeSkin(9999999, 'Prestige unknown'), 'mythic', {9999999: {mode:'essence', essence: 150}}),
    { currency: 'unknown' });
  assert.deepEqual(skinPrice(makeSkin(9999999), 'normal'), { currency: 'unknown' });
  assert.deepEqual(skinPrice(makeSkin(9999999, 'Antigua', 750), 'normal'),
    { currency: 'rp', amount: 750, automatic: false });
});

test('la interfaz de las tarjetas ya no tiene editores de precios', () => {
  const jsx = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(jsx, /mythic-cost-editor|price-input|updatePricePreference\(/);
  assert.match(jsx, /className="skin-cost-badge auto"/);
  assert.match(jsx, /sanctumMaximumRp\(price\.pity\)/);
  assert.match(jsx, /sanctumMaxRp/);
});
