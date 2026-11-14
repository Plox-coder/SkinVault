import { lookupHistoricalSkin, type HistoricalSkinInfo } from './skinPriceReference.ts';

export type Rarity = 'normal' | 'epic' | 'legendary' | 'mythic' | 'ultimate' | 'exalted' | 'transcendent';
export type SkinPriceInput = { id: string; name: string; rp: number | null };

// Preserved for compatibility with backups created by older versions. Price
// preferences no longer change the catalogue's fixed prices.
export type AcquisitionMode = 'essence' | 'sanctum' | 'unknown';
export type PricePreference = { mode?: AcquisitionMode; essence?: number | null; rpOverride?: number | null };
export type SpecialKind = Extract<HistoricalSkinInfo['kind'], 'ranked' | 'promo' | 'gift' | 'pass' | 'special'>;
export type SkinPrice =
  | { currency: 'rp'; amount: number; automatic: boolean }
  | { currency: 'essence'; amount: number | null }
  | { currency: 'sanctum'; pity: 40 | 80 }
  | { currency: 'special'; kind: SpecialKind }
  | { currency: 'unknown' };

/** One Ancient Spark costs 400 RP. This is a GUARANTEED MAXIMUM, never
 * a fixed price or an estimate of what a player actually spent. */
export const SANCTUM_RP_PER_SPARK = 400;
export function sanctumMaximumRp(pity: 40 | 80): number {
  return pity * SANCTUM_RP_PER_SPARK;
}

/**
 * The historical ID reference wins over rarity, previous manual edits, and
 * the imported JSON. Crucially, Mythic is a RARITY, not an acquisition method:
 * Mythic skins can be bought with ME, won in the Sanctum, sold for RP, or
 * exclusively rewarded for events. Do not infer 150 ME from their names.
 */
export function skinPrice(skin: SkinPriceInput, rarity: Rarity | null, _legacyPreferences: Record<string, PricePreference> = {}): SkinPrice {
  const reference = lookupHistoricalSkin(skin.id);

  // Transcendent skins generally belong to Hall of Legends bundles, not a
  // standalone skin price. No fictitious direct-RP equivalent.
  if (rarity === 'transcendent') return { currency: 'special', kind: 'special' };

  if (reference) {
    if (reference.kind === 'rp') return { currency: 'rp', amount: reference.amount, automatic: true };
    if (reference.kind === 'essence') return { currency: 'essence', amount: reference.amount };
    if (reference.kind === 'sanctum') return { currency: 'sanctum', pity: reference.pity };
    return { currency: 'special', kind: reference.kind };
  }

  if (rarity === 'exalted') return { currency: 'sanctum', pity: 80 };
  // There is no reliable, fixed fallback for an unlisted Mythic skin.
  if (rarity === 'mythic') return { currency: 'unknown' };

  // Older Pengu backups may contain an explicit price for an ID that isn't
  // in the historical reference. Keep it visible but NEVER allow UI editing.
  if (skin.rp !== null) return { currency: 'rp', amount: skin.rp, automatic: false };

  const fallback = rarity === 'epic' ? 1350
    : rarity === 'legendary' ? 1820
    : rarity === 'ultimate' ? (skin.id === '21016' ? 2775 : 3250)
    : null;
  if (fallback !== null) return { currency: 'rp', amount: fallback, automatic: true };
  return { currency: 'unknown' };
}
