import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createTranslator, initialLanguage, LANGUAGE_STORAGE_KEY, type Language, type TranslationKey } from './i18n';
import { historicalSkinCount } from './skinPriceReference';
import { skinPrice, sanctumMaximumRp, type Rarity, type PricePreference, type SpecialKind } from './skinPricing';

type OwnedFilter = 'all' | 'owned' | 'missing' | 'unknown';
type RawSkin = Record<string, unknown>;
type SkinMeta = { rarity: Rarity | null; loadScreenPath: string | null };
const DRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/';
const SKINS_METADATA_URL = DRAGON_BASE + 'v1/skins.json';

function normalizeRarity(value: unknown): Rarity | null {
  if (typeof value !== 'string') return null;
  const v = value.toLowerCase().replace(/[^a-z]/g, '');
  if (v.includes('transcendent')) return 'transcendent';
  if (v.includes('exalted')) return 'exalted';
  if (v.includes('ultimate')) return 'ultimate';
  if (v.includes('legendary')) return 'legendary';
  if (v.includes('mythic')) return 'mythic';
  if (v.includes('epic')) return 'epic';
  if (v.includes('normal') || v.includes('common') || v.includes('norarity') || v.includes('rare')) return 'normal';
  return null;
}

function dragonAssetUrl(path: unknown): string | null {
  if (typeof path !== 'string' || !path) return null;
  // Never interpolate arbitrary remote URLs from imported files.
  const prefix = '/lol-game-data/assets/';
  if (!path.toLowerCase().startsWith(prefix)) return null;
  const suffix = path.slice(prefix.length).toLowerCase();
  if (!/^[a-z0-9_./-]+$/.test(suffix) || suffix.includes('..')) return null;
  return DRAGON_BASE + suffix;
}

function extractMetadata(data: unknown): Record<string, SkinMeta> {
  if (!data || typeof data !== 'object') return {};
  const items = Array.isArray(data) ? data : Object.values(data);
  const map: Record<string, SkinMeta> = {};
  for (const candidate of items) {
    if (!candidate || typeof candidate !== 'object') continue;
    const entry = candidate as Record<string, unknown>;
    const id = String(entry.id ?? '');
    if (!/^\d+$/.test(id)) continue;
    map[id] = {
      rarity: normalizeRarity(entry.rarity),
      loadScreenPath: dragonAssetUrl(entry.loadScreenPath),
    };
  }
  return map;
}

const specialLabel: Record<SpecialKind, TranslationKey> = {
  ranked: 'acquisitionRanked', promo: 'acquisitionPromo', gift: 'acquisitionGift',
  pass: 'acquisitionPass', special: 'acquisitionSpecial',
};

function normalizePricePreferences(value: unknown): Record<string, PricePreference> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, PricePreference> = {};
  for (const [id, candidate] of Object.entries(value)) {
    if (!/^\d{1,10}$/.test(id) || !candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const row = candidate as Record<string, unknown>;
    const preference: PricePreference = {};
    if (row.mode === 'essence' || row.mode === 'sanctum' || row.mode === 'unknown') preference.mode = row.mode;
    if (row.essence === null) preference.essence = null;
    else if (typeof row.essence === 'number' && [100, 125, 150, 200].includes(row.essence)) preference.essence = row.essence;
    if (row.rpOverride === null) preference.rpOverride = null;
    else if (row.rpOverride !== undefined) preference.rpOverride = validPrice(row.rpOverride);
    result[id] = preference;
  }
  return result;
}

type Skin = {
  id: string;
  name: string;
  championId: string;
  owned: boolean;
  rp: number | null;
};
type CollectionTab = 'skins' | 'icons' | 'wards' | 'chromas';
type Collectible = {
  id: string;
  name: string;
  image: string;
  owned: boolean;
  ownedKnown: boolean;
  skinId?: string;
  skinName?: string;
  championId?: string;
};
type Category = Exclude<CollectionTab, 'skins'>;
type SavedCollection = {
  accountLabel: string;
  importedAt: string;
  skins: Skin[];
  icons: Collectible[];
  wards: Collectible[];
  chromas: Collectible[];
  extrasIncluded: boolean;
  chromaScan?: { checkedSkins: number; totalSkins: number };
  pricing: Record<string, PricePreference>;
};
type Champion = { id: string; name: string };

const STORAGE_KEY = 'skinvault-react-collection-v1';

const safeText = (value: unknown) => typeof value === 'string' ? value : '';

function isClassic(skin: RawSkin) {
  const id = String(skin.id ?? skin.skinId ?? '');
  const champ = String(skin.championId ?? '');
  const alias = String(skin.championAlias ?? skin.championKey ?? skin.alias ?? '');
  return /^60\d{6}$/.test(id) || /^60\d{3}$/.test(champ)
    || /^Jade_/i.test(alias) || skin.mode === 'classic' || skin.gameMode === 'classic';
}

function validPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000) return null;
  return Math.round(number);
}

function normalizeSkin(raw: RawSkin): Skin | null {
  const id = String(raw.id ?? raw.skinId ?? '');
  if (!/^\d+$/.test(id) || Number(id) % 1000 === 0 || isClassic(raw)) return null;
  const name = safeText(raw.name).trim() || `Skin ${id}`;
  return {
    id,
    name,
    championId: String(raw.championId ?? Math.floor(Number(id) / 1000)),
    owned: typeof raw.selectedOwned === 'boolean' ? raw.selectedOwned : raw.owned === true,
    rp: validPrice(raw.rp),
  };
}

function normalizeCollection(skins: unknown[]): Skin[] {
  const unique = new Map<string, Skin>();
  for (const raw of skins) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const skin = normalizeSkin(raw as RawSkin);
    if (skin) unique.set(skin.id, skin);
  }
  return [...unique.values()];
}

/** Pengu 0.4 exports icons/wards/chromas with an ownedKnown flag.
 * An unknown status is NOT an unowned item: do not count it as missing. */
function normalizeCollectibles(raw: unknown, category: Category): Collectible[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, Collectible>();
  for (const value of raw) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const item = value as Record<string, unknown>;
    const id = String(item.id ?? '');
    if (!/^\d{1,12}$/.test(id)) continue;
    const skinId = String(item.skinId ?? '');
    if (category === 'chromas' && /^60\d{6}$/.test(skinId)) continue;
    const owned = item.owned === true;
    // Old exports sometimes have explicit ownership but not ownedKnown.
    const ownedKnown = typeof item.ownedKnown === 'boolean'
      ? item.ownedKnown
      : typeof item.owned === 'boolean';
    const label = category === 'icons' ? 'Icono' : category === 'wards' ? 'Guardián' : 'Chroma';
    map.set(id, {
      id,
      name: safeText(item.name).trim().slice(0, 160) || `${label} ${id}`,
      image: safeText(item.image),
      owned,
      ownedKnown,
      ...(category === 'chromas' ? {
        skinId,
        skinName: safeText(item.skinName).slice(0, 160),
        championId: String(item.championId ?? ''),
      } : {}),
    });
  }
  return [...map.values()];
}

function numberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function collectibleArtwork(item: Collectible, category: Category): string[] {
  const sources: Array<string | null> = [dragonAssetUrl(item.image)];
  if (category === 'icons') sources.push(`${DRAGON_BASE}v1/profile-icons/${item.id}.jpg`);
  if (category === 'wards') sources.push(`${DRAGON_BASE}content/src/leagueclient/wardskinimages/wardhero_${item.id}.png`);
  if (category === 'chromas' && /^\d+$/.test(item.championId ?? '')) {
    sources.push(`${DRAGON_BASE}v1/champion-chroma-images/${item.championId}/${item.id}.png`);
  }
  return [...new Set(sources.filter((url): url is string => !!url))];
}

function CollectionArtwork({ item, category, language }: { item: Collectible; category: Category; language: Language }) {
  const t = useMemo(() => createTranslator(language), [language]);
  const sources = useMemo(() => collectibleArtwork(item, category), [item, category]);
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(0); }, [item.id, item.image, category]);
  return (
    <div className={`collection-square ${category} ${item.ownedKnown && item.owned ? 'collected' : 'not-collected'}`}>
      <div className="collection-square-inner">
        {sources[index] ? (
          <img className="collection-image" src={sources[index]} alt={t('imageAlt', { name: item.name })}
            loading="lazy" decoding="async" onError={() => setIndex(previous => previous + 1)} />
        ) : (
          <div className="collection-image-fallback"><span>✦</span><small>{t('imageUnavailable')}</small></div>
        )}
      </div>
      <img className="square-ornament" src={`${import.meta.env.BASE_URL}collection-square-frame.svg`} aria-hidden="true" alt="" loading="lazy" />
      {item.ownedKnown && item.owned && (
        category === 'wards'
          ? <span className="ward-orb" aria-hidden="true" />
          : category === 'icons'
            ? <img className="square-gem" src={`${DRAGON_BASE}v1/rarity-gem-icons/epic.png`} aria-hidden="true" alt="" />
            : <span className="chroma-medallion" aria-hidden="true">✧</span>
      )}
      {!item.ownedKnown && <span className="collection-unknown-mark" title={t('unverified')}>?</span>}
    </div>
  );
}

function loadSaved(): SavedCollection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const data = parsed as Record<string, unknown>;
    if (!Array.isArray(data.skins)) return null;
    return {
      accountLabel: safeText(data.accountLabel) || 'Mi colección',
      importedAt: safeText(data.importedAt),
      skins: normalizeCollection(data.skins),
      icons: normalizeCollectibles(data.icons, 'icons'),
      wards: normalizeCollectibles(data.wards, 'wards'),
      chromas: normalizeCollectibles(data.chromas, 'chromas'),
      pricing: normalizePricePreferences(data.pricing),
      extrasIncluded: data.extrasIncluded === true || Array.isArray(data.icons) || Array.isArray(data.wards) || Array.isArray(data.chromas),
      chromaScan: data.chromaScan && typeof data.chromaScan === 'object' ? {
        checkedSkins: numberOrZero((data.chromaScan as Record<string, unknown>).checkedSkins),
        totalSkins: numberOrZero((data.chromaScan as Record<string, unknown>).totalSkins),
      } : undefined,
    };
  } catch {
    return null;
  }
}

function getArtwork(skin: Skin, champions: Record<string, Champion>): string | null {
  const championKey = skin.championId || String(Math.floor(Number(skin.id) / 1000));
  const champ = champions[championKey] || champions[String(Math.floor(Number(skin.id) / 1000))];
  if (!champ) return null;
  const number = Number(skin.id) % 1000;
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champ.id}_${number}.jpg`;
}

/**
 * Marco del inventario de LoL: el recurso de CommunityDragon mide 264 × 453.
 * Los trazos decorativos ocupan aprox. los primeros 410 px; el resto es una
 * banda transparente para los emblemas. No estiramos el PNG ni lo encajamos
 * con object-fit:fill: mantenemos su anchura y proporción originales.
 */
function Art({ skin, champions, meta, rarity, language }: {
  skin: Skin; champions: Record<string, Champion>; meta: SkinMeta | undefined;
  rarity: Rarity | null; language: Language;
}) {
  const t = useMemo(() => createTranslator(language), [language]);
  const ddragonUrl = getArtwork(skin, champions);
  const preferred = meta?.loadScreenPath ?? ddragonUrl;
  const [source, setSource] = useState(preferred);
  const [failed, setFailed] = useState(false);
  const [frameFailed, setFrameFailed] = useState(false);
  useEffect(() => { setSource(preferred); setFailed(false); }, [preferred]);

  const frameName = rarity ?? 'normal';
  const frameFilename = frameName === 'transcendent'
    ? 'borders_transcendent_0.png'
    : `borders_${frameName}.png`;
  const frameUrl = `${DRAGON_BASE}v1/rarity-skin-borders/${frameFilename}`;
  useEffect(() => setFrameFailed(false), [frameUrl]);

  return (
    <div className={`artwork rarity-${frameName} ${skin.owned ? 'portrait-owned' : 'portrait-missing'} ${frameFailed ? 'frame-fallback' : ''}`}>
      <div className="portrait-frame-area">
        <div className="portrait-image-viewport">
          {source && !failed ? (
            <img className="art-image" src={source} alt={t('imageAlt', { name: skin.name })}
              loading="lazy" decoding="async"
              onError={() => {
                if (source !== ddragonUrl && ddragonUrl) setSource(ddragonUrl);
                else setFailed(true);
              }} />
          ) : (
            <div className="art-placeholder"><span>✦</span><small>{t('imageUnavailable')}</small></div>
          )}
          {!skin.owned && <span className="art-muted" aria-hidden="true" />}
        </div>
        {skin.owned && !frameFailed && (
          <img className="riot-rarity-frame" src={frameUrl} alt="" aria-hidden="true"
            loading="lazy" decoding="async" onError={() => setFrameFailed(true)} />
        )}
      </div>
      {skin.owned && rarity && rarity !== 'normal' && (
        <img className="rarity-gem" src={`${DRAGON_BASE}v1/rarity-gem-icons/${rarity}.png`}
          alt="" aria-hidden="true" loading="lazy" decoding="async"
          onError={event => { event.currentTarget.style.display = 'none'; }} />
      )}
    </div>
  );
}

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const t = useMemo(() => createTranslator(language), [language]);
  const formatNumber = useMemo(() => new Intl.NumberFormat(language === 'ca' ? 'ca-ES' : language === 'es' ? 'es-ES' : 'en-US'), [language]);
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* preference not saved */ }
  }, [language]);
  const [collection, setCollection] = useState<SavedCollection | null>(() => loadSaved());
  const [champions, setChampions] = useState<Record<string, Champion>>({});
  const [skinMetadata, setSkinMetadata] = useState<Record<string, SkinMeta>>({});
  const [raritiesError, setRaritiesError] = useState(false);
  const [activeTab, setActiveTab] = useState<CollectionTab>('skins');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<OwnedFilter>('all');
  const [visibleLimit, setVisibleLimit] = useState(90);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [imagesError, setImagesError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        if (!versionsResponse.ok) throw new Error('No se pudo obtener la versión de LoL');
        const versions: string[] = await versionsResponse.json();
        const version = versions[0];
        if (!version) throw new Error('Versión vacía');
        const championsResponse = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/${language === 'en' ? 'en_US' : 'es_ES'}/champion.json`);
        if (!championsResponse.ok) throw new Error('No se pudo obtener el catálogo de campeones');
        const data: { data: Record<string, { key: string; id: string; name: string }> } = await championsResponse.json();
        if (!cancelled) {
          setChampions(Object.fromEntries(Object.values(data.data).map(champ => [champ.key, { id: champ.id, name: champ.name }])));
          setImagesError(false);
        }
      } catch {
        if (!cancelled) setImagesError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(SKINS_METADATA_URL);
        if (!response.ok) throw new Error(`Metadata HTTP ${response.status}`);
        const data: unknown = await response.json();
        const normalized = extractMetadata(data);
        if (Object.keys(normalized).length === 0) throw new Error('Metadatos vacíos');
        if (!cancelled) { setSkinMetadata(normalized); setRaritiesError(false); }
      } catch {
        if (!cancelled) { setRaritiesError(true); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      if (collection) localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { setError(t('backupError')); }
  }, [collection, t]);

  const skins = collection?.skins ?? [];
  const stats = useMemo(() => {
    const owned = skins.filter(skin => skin.owned);
    let rp = 0, essence = 0, sanctum = 0, sanctumMaxRp = 0, special = 0, priced = 0;
    let essenceCount = 0, exaltedCount = 0, variantsCount = 0;
    for (const skin of owned) {
      const price = skinPrice(skin, skinMetadata[skin.id]?.rarity ?? null);
      if (price.currency === 'rp') { rp += price.amount; priced++; }
      else if (price.currency === 'essence' && price.amount !== null) { essence += price.amount; essenceCount++; }
      else if (price.currency === 'sanctum') { sanctum++; sanctumMaxRp += sanctumMaximumRp(price.pity); if (price.pity === 80) exaltedCount++; else variantsCount++; }
      else if (price.currency === 'special') special++;
    }
    return { owned: owned.length, missing: skins.length - owned.length, rp, essence, sanctum, sanctumMaxRp,
      special, priced, essenceCount, exaltedCount, variantsCount };
  }, [skins, skinMetadata]);

  const visible = useMemo(() => skins.filter(skin => {
    if (filter === 'owned' && !skin.owned) return false;
    if (filter === 'missing' && skin.owned) return false;
    const champKey = skin.championId || String(Math.floor(Number(skin.id) / 1000));
    const championName = champions[champKey]?.name || '';
    const q = search.trim().toLocaleLowerCase(language);
    return !q || `${skin.name} ${championName} ${skin.id}`.toLocaleLowerCase(language).includes(q);
  }).sort((a, b) => a.name.localeCompare(b.name, language)), [skins, filter, search, champions, language]);

  const collectibleItems = activeTab === 'skins' ? [] : collection?.[activeTab] ?? [];
  const categoryStats = useMemo(() => {
    const total = collectibleItems.length;
    const owned = collectibleItems.filter(item => item.ownedKnown && item.owned).length;
    const missing = collectibleItems.filter(item => item.ownedKnown && !item.owned).length;
    return { total, owned, missing, unknown: total - owned - missing };
  }, [collectibleItems]);
  const visibleCollectibles = useMemo(() => collectibleItems.filter(item => {
    if (filter === 'owned' && !(item.ownedKnown && item.owned)) return false;
    if (filter === 'missing' && !(item.ownedKnown && !item.owned)) return false;
    if (filter === 'unknown' && item.ownedKnown) return false;
    const q = search.trim().toLocaleLowerCase(language);
    return !q || `${item.name} ${item.id} ${item.skinName ?? ''}`.toLocaleLowerCase(language).includes(q);
  }).sort((a, b) => a.name.localeCompare(b.name, language)), [collectibleItems, search, filter, language]);
  useEffect(() => setVisibleLimit(90), [activeTab, search, filter]);
  const selectedTotal = activeTab === 'skins' ? skins.length : categoryStats.total;
  const selectedOwned = activeTab === 'skins' ? stats.owned : categoryStats.owned;
  const selectedMissing = activeTab === 'skins' ? stats.missing : categoryStats.missing;
  const selectedUnknown = activeTab === 'skins' ? 0 : categoryStats.unknown;
  const verifiedTotal = selectedTotal - selectedUnknown;

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    setError(''); setNotice('');
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error(t('fileTooLarge'));
      const json: unknown = JSON.parse(await file.text());
      if (!json || typeof json !== 'object') throw new Error(t('invalidFile'));
      const data = json as Record<string, unknown>;
      if (data.application !== 'SkinVault' || !Array.isArray(data.skins)) {
        throw new Error(t('wrongFile'));
      }
      const accountLabel = safeText(data.accountLabel) || 'Mi colección';
      // Pengu does not export price edits. Keep previous manual RP values when
      // reimporting the same account; a SkinVault backup with pricing is authoritative.
      const previousPrices = accountLabel === collection?.accountLabel && !data.pricing
        ? new Map(collection.skins.map(skin => [skin.id, skin.rp])) : null;
      const cleaned = normalizeCollection(data.skins).map(skin => ({
        ...skin,
        rp: skin.rp ?? previousPrices?.get(skin.id) ?? null,
      }));
      if (cleaned.length === 0 && ![data.icons, data.wards, data.chromas].some(Array.isArray)) throw new Error(t('noSkins'));
      setCollection({
        accountLabel,
        importedAt: new Date().toISOString(),
        skins: cleaned,
        pricing: data.pricing && typeof data.pricing === 'object' ? normalizePricePreferences(data.pricing) :
          (accountLabel === collection?.accountLabel ? collection.pricing : {}),
        // Importación v0.4: cuando un JSON antiguo no tiene estas claves,
        // conserva las categorías extra cargadas anteriormente.
        icons: Array.isArray(data.icons) ? normalizeCollectibles(data.icons, 'icons') : collection?.icons ?? [],
        wards: Array.isArray(data.wards) ? normalizeCollectibles(data.wards, 'wards') : collection?.wards ?? [],
        chromas: Array.isArray(data.chromas) ? normalizeCollectibles(data.chromas, 'chromas') : collection?.chromas ?? [],
        extrasIncluded: [data.icons, data.wards, data.chromas].some(Array.isArray) || collection?.extrasIncluded === true,
        chromaScan: data.chromaScan && typeof data.chromaScan === 'object' ? {
          checkedSkins: numberOrZero((data.chromaScan as Record<string, unknown>).checkedSkins),
          totalSkins: numberOrZero((data.chromaScan as Record<string, unknown>).totalSkins),
        } : collection?.chromaScan,
      });
      setNotice(t('importedAll', {
        skins: formatNumber.format(cleaned.length),
        icons: formatNumber.format(Array.isArray(data.icons) ? data.icons.length : collection?.icons.length ?? 0),
        wards: formatNumber.format(Array.isArray(data.wards) ? data.wards.length : collection?.wards.length ?? 0),
        chromas: formatNumber.format(Array.isArray(data.chromas) ? data.chromas.length : collection?.chromas.length ?? 0),
      }));
      setSearch(''); setFilter('all');
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : t('cannotOpen'));
    }
  }

  function updateSkin(id: string, change: Pick<Skin, 'owned'>) {
    setCollection(previous => previous ? {
      ...previous,
      skins: previous.skins.map(skin => skin.id === id ? { ...skin, ...change } : skin),
    } : previous);
  }

  function updateCollectible(category: Category, id: string, owned: boolean) {
    setCollection(previous => previous ? {
      ...previous,
      [category]: previous[category].map(item => item.id === id ? { ...item, owned, ownedKnown: true } : item),
    } : previous);
  }

  function exportCollection() {
    if (!collection) return;
    const data = {
      application: 'SkinVault', format: 2, exportedAt: new Date().toISOString(),
      accountLabel: collection.accountLabel,
      skins: collection.skins.map(skin => ({ ...skin, selectedOwned: skin.owned })),
      icons: collection.icons,
      wards: collection.wards,
      chromas: collection.chromas,
      chromaScan: collection.chromaScan,
      pricing: collection.pricing,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'skinvault-backup.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-icon">◇</span><div><strong>SKIN<span>VAULT</span></strong><small>{t('tagline')}</small></div></div>
        <div className="top-actions">
          <label className="language-control"><span>{t('language')}</span>
            <select aria-label={t('language')} value={language} onChange={e => setLanguage(e.target.value as Language)}>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="ca">Català</option>
            </select>
          </label>
          {collection && <button className="button button-outline" onClick={exportCollection}>{t('copy')}</button>}
          <button className="button button-primary" onClick={() => inputRef.current?.click()}>{t('import')}</button>
        </div>
      </header>

      <main className="content">
        <div className="eyebrow">{t('inventory')} <span className="eyebrow-line" /></div>
        <div className="heading-row">
          <div><h1>{t(activeTab === 'skins' ? 'heading' : 'extraHeading', { category: t(activeTab === 'icons' ? 'tabIcons' : activeTab === 'wards' ? 'tabWards' : 'tabChromas') })}</h1><p>{t(activeTab === 'skins' ? 'intro' : 'extraIntro')}</p></div>
          {collection && <div className="account"><span>{t('importedAccount')}</span><strong>{language !== 'es' && collection.accountLabel === 'Mi colección' ? t('myCollection') : collection.accountLabel}</strong></div>}
        </div>

        {collection && (
          <nav className="collection-tabs" aria-label={t('collectionTabs')}>
            {(['skins', 'icons', 'wards', 'chromas'] as const).map(category => (
              <button key={category} type="button"
                className={`collection-tab ${activeTab === category ? 'selected' : ''}`}
                aria-current={activeTab === category ? 'page' : undefined}
                onClick={() => { setActiveTab(category); setSearch(''); setFilter('all'); }}>
                <span className="collection-tab-symbol" aria-hidden="true">{category === 'skins' ? '◈' : category === 'icons' ? '◉' : category === 'wards' ? '♜' : '✧'}</span>
                {t(category === 'skins' ? 'tabSkins' : category === 'icons' ? 'tabIcons' : category === 'wards' ? 'tabWards' : 'tabChromas')}
                <small>{formatNumber.format(category === 'skins' ? skins.length : collection[category].length)}</small>
              </button>
            ))}
          </nav>
        )}
        <section className="stats-grid" aria-label={t('statistics')}>
          <div className="stat"><span>{t(activeTab === 'skins' ? 'registered' : 'registeredObjects')}</span><strong>{formatNumber.format(selectedTotal)}</strong><small>{activeTab === 'skins' ? t('noClassic') : t('catalogImported')}</small></div>
          <div className="stat"><span>{t('obtained')}</span><strong>{formatNumber.format(selectedOwned)}</strong><small>{verifiedTotal ? t('progressCatalog', { percent: Math.round(selectedOwned / verifiedTotal * 100) }) : t('noData')}</small></div>
          <div className="stat"><span>{t('missing')}</span><strong>{formatNumber.format(selectedMissing)}</strong><small>{activeTab === 'skins' ? t('fromCatalog') : t('onlyVerified')}</small></div>
          {activeTab === 'skins' ? (
            <div className="stat stat-gold"><span>{t('rpReference')}</span><strong>{formatNumber.format(stats.rp)} <em>RP</em></strong><small>{t('rpOnly', { count: stats.priced })}</small></div>
          ) : (
            <div className="stat stat-gold"><span>{t('unverified')}</span><strong>{formatNumber.format(selectedUnknown)}</strong><small>{t('pendingVerification')}</small></div>
          )}
        </section>

        {activeTab === 'skins' && collection && (
          <section className="pricing-overview" aria-label={t('pricingOverview')}>
            <div><span>{t('mythicEssence')}</span><strong>{formatNumber.format(stats.essence)} <small>EM</small></strong><small>{t('mythicCount', { count: stats.essenceCount })}</small></div>
            <div><span>{t('sanctumMaxRp')}</span><strong>{formatNumber.format(stats.sanctumMaxRp)} <small>RP</small></strong><small>{t('sanctumBreakdown', { variants: stats.variantsCount, exalted: stats.exaltedCount })}</small></div>
            <div><span>{t('noRpPrice')}</span><strong>{formatNumber.format(stats.special)}</strong><small>{t('noRpExplanation')}</small></div>
            <p>{t('sanctumExplanation')} {t('catalogCoverage', { count: formatNumber.format(historicalSkinCount) })}</p>
          </section>
        )}
        {error && <div className="message error" role="alert">{error}</div>}
        {notice && <div className="message success" role="status">{notice}</div>}
        {imagesError && <div className="message hint">{t('dragonError')}</div>}
        {raritiesError && <div className="message hint">{t('rarityError')}</div>}

        {!collection ? (
          <section className="welcome">
            <div className="welcome-icon">✧</div>
            <h2>{t('welcomeHeading')}</h2>
            <p>{t('welcomeText1')} <strong>{t('welcomeRead')}</strong> {t('welcomeText2')} <strong>{t('welcomeExport')}</strong> {t('welcomeText3')}</p>
            <button className="button button-primary" onClick={() => inputRef.current?.click()}>{t('pickFile')}</button>
            <div className="privacy">{t('privacy')}</div>
          </section>
        ) : (
          <>
            <div className="collection-progress"><div className="progress-copy"><span>{t('progress')}</span><strong>{verifiedTotal ? Math.round(selectedOwned / verifiedTotal * 100) : 0} %</strong></div><div className="progress-track"><div style={{ width: `${verifiedTotal ? selectedOwned / verifiedTotal * 100 : 0}%` }} /></div></div>
            <section className="library-head">
              <div><div className="eyebrow">{t('library')}</div><h2>
                {t(activeTab === 'skins' ? 'allSkins' : activeTab === 'icons' ? 'tabIcons' : activeTab === 'wards' ? 'tabWards' : 'tabChromas')}
                <span> ({formatNumber.format(activeTab === 'skins' ? visible.length : visibleCollectibles.length)})</span>
              </h2></div>
              <div className="toolbar">
                <input aria-label={t('searchLabel')} type="search"
                  placeholder={t(activeTab === 'skins' ? 'search' : 'searchObjects')}
                  value={search} onChange={e => setSearch(e.target.value)} />
                <div className="filters" role="group" aria-label={t('statusFilter')}>
                  <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{t('all')}</button>
                  <button className={filter === 'owned' ? 'active' : ''} onClick={() => setFilter('owned')}>{t('ownedFilter')}</button>
                  <button className={filter === 'missing' ? 'active' : ''} onClick={() => setFilter('missing')}>{t('missingFilter')}</button>
                  {activeTab !== 'skins' && <button className={filter === 'unknown' ? 'active' : ''} onClick={() => setFilter('unknown')}>{t('unverified')}</button>}
                </div>
              </div>
            </section>
            {activeTab !== 'skins' && !collection.extrasIncluded && (
              <div className="message hint">{t('reimportExtras')}</div>
            )}
            {activeTab === 'chromas' && collection.chromaScan && collection.chromaScan.totalSkins > 0 && (
              <div className="message hint">{t('chromaProgress', {
                checked: collection.chromaScan.checkedSkins,
                total: collection.chromaScan.totalSkins,
              })}</div>
            )}
            {activeTab === 'skins' ? <>

            {visible.length ? (
              <div className="skin-grid">
                {visible.map(skin => {
                  const champKey = skin.championId || String(Math.floor(Number(skin.id) / 1000));
                  const rarity = skinMetadata[skin.id]?.rarity ?? null;
                  const price = skinPrice(skin, rarity);
                  return <article className={`skin-card ${skin.owned ? 'skin-owned' : 'skin-unowned'}`} key={skin.id}>
                    <Art skin={skin} champions={champions} meta={skinMetadata[skin.id]} rarity={rarity} language={language} />
                    <div className="skin-info"><div className="skin-category-line"><span className="champ-name">{champions[champKey]?.name || t('champFallback', { id: champKey })}</span>{rarity && <span className="rarity-readonly" title={t('rarity')}>{t(rarity)}</span>}</div><h3 title={skin.name}>{skin.name}</h3>
                      <div className="skin-controls"><button type="button" className={`owned-button ${skin.owned ? 'yes' : 'no'}`} onClick={() => updateSkin(skin.id, { owned: !skin.owned })}>{skin.owned ? t('own') : t('dontOwn')}</button>{price.currency === 'rp' ? (
                        <span className="skin-cost-badge auto" title={price.automatic ? t('automaticPrice') : t('importedPrice')}>
                          {formatNumber.format(price.amount)} RP
                        </span>
                      ) : price.currency === 'essence' ? (
                        <span className="skin-cost-badge auto" title={t('fixedEssencePrice')}>
                          {price.amount !== null ? `${formatNumber.format(price.amount)} EM` : t('unknownPrice')}
                        </span>
                      ) : price.currency === 'sanctum' ? (
                        <span className="skin-cost-badge gacha" title={t('sanctumPriceHint', { sparks: price.pity, rp: formatNumber.format(sanctumMaximumRp(price.pity)) })}>
                          ≤{formatNumber.format(sanctumMaximumRp(price.pity))} RP
                        </span>
                      ) : price.currency === 'special' ? (
                        <span className="skin-cost-badge no-rp" title={t('noRpPrice')}>{t(specialLabel[price.kind])}</span>
                      ) : (
                        <span className="skin-cost-badge pending" title={t('unknownPrice')}>{t('unknownPrice')}</span>
                      )}</div>
                    </div>
                  </article>;
                })}
              </div>
            ) : <div className="nothing">{t('noMatches')}</div>}
            </> : (
              visibleCollectibles.length ? (
                <>
                <div className="collectible-grid">
                  {visibleCollectibles.slice(0, visibleLimit).map(item => (
                    <article className={`collectible-card ${item.ownedKnown && item.owned ? 'skin-owned' : ''}`} key={`${activeTab}:${item.id}`}>
                      <CollectionArtwork item={item} category={activeTab as Category} language={language} />
                      <div className="collectible-info">
                        <div className="collectible-label"><span>#{item.id}</span><span className={`status-chip ${!item.ownedKnown ? 'pending' : item.owned ? 'has' : 'lacks'}`}>
                          {!item.ownedKnown ? t('unverified') : item.owned ? t('ownedFilter') : t('missingFilter')}
                        </span></div>
                        <h3 title={item.name}>{item.name}</h3>
                        {activeTab === 'chromas' && <p className="chroma-source" title={item.skinName}>{item.skinName || t('unknownSkin')}</p>}
                        <button className={`owned-button ${item.ownedKnown && item.owned ? 'yes' : 'no'}`} type="button"
                          onClick={() => updateCollectible(activeTab as Category, item.id, !(item.ownedKnown && item.owned))}>
                          {!item.ownedKnown ? t('markAsOwned') : item.owned ? t('own') : t('dontOwn')}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {visibleLimit < visibleCollectibles.length && (
                  <button type="button" className="button button-outline load-more"
                    onClick={() => setVisibleLimit(n => n + 90)}>
                    {t('showMore', { count: formatNumber.format(visibleCollectibles.length - visibleLimit) })}
                  </button>
                )}
                </>
              ) : <div className="nothing">{!collection.extrasIncluded ? t('reimportExtras') : t('noObjects')}</div>
            )}
            <p className="disclaimer">{t(activeTab === 'skins' ? 'pricingDisclaimer' : 'extraDisclaimer')}</p>
          </>
        )}
      </main>
      <footer className="bottom">{t('footer')}</footer>
      <input ref={inputRef} type="file" accept=".json,application/json" className="sr-only" onChange={importFile} />
    </div>
  );
}
