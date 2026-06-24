export const PRODUCTS = [
  // ── Botulinum toxins ─────────────────────────────────────────────────────
  { key: 'botox',      label: 'Botox',        mid: 'IEALLPHAWE',       country: 'IE', patterns: [/botox/i, /\bBOT\s+\d+IU\b/i] },
  { key: 'xeomin',     label: 'Xeomin',       mid: 'DEMERPHA100FRA',   country: 'DE', patterns: [/xeomin/i, /\bXEO\s+\d+IU\b/i] },
  { key: 'azzalure',   label: 'Azzalure',     mid: 'GBIPSBIOWRE',      country: 'GB', patterns: [/azzalure/i] },
  { key: 'dysport',    label: 'Dysport',      mid: 'GBIPS37LON',       country: 'GB', patterns: [/dysport/i, /\bDYS\s*\d+/i] },
  { key: 'bocouture',  label: 'Bocouture 50', mid: 'DEMERPHA100FRA',   country: 'DE', patterns: [/bocouture/i] },

  // ── GLP-1 / Diabetes / Obesity ───────────────────────────────────────────
  { key: 'ozempic',    label: 'Ozempic',      mid: 'DKNOVNORBAG',      country: 'DK', patterns: [/ozempic/i] },
  { key: 'wegovy',     label: 'Wegovy',       mid: 'DKNOVNORBAG',      country: 'DK', patterns: [/wegovy/i] },
  { key: 'mounjaro',   label: 'Mounjaro',     mid: 'CHELILIL16GEN',    country: 'CH', patterns: [/mounjaro/i, /tirzepatide/i] },
  { key: 'jardiance',  label: 'Jardiance',    mid: 'DEBOEING173ING',   country: 'DE', patterns: [/jardiance/i] },

  // ── Growth hormone ───────────────────────────────────────────────────────
  { key: 'norditropin', label: 'Norditropin 15mg', mid: 'DKNOVNOR1BAG', country: 'DK', patterns: [/norditropin/i] },

  // ── Dermal fillers / aesthetics ──────────────────────────────────────────
  { key: 'restylane',  label: 'Restylane (all)', mid: 'SEQ-M21UPP',    country: 'SE', patterns: [/restylane/i] },
  { key: 'juvederm',   label: 'Juvederm (all)', mid: 'FRALLPRIN',      country: 'FR', patterns: [/juvederm/i] },
  { key: 'teosyal',    label: 'Teosyal',      mid: 'CHTEOSA105GE',     country: 'CH', patterns: [/teosyal/i] },
  { key: 'stylage',    label: 'Stylage',      mid: 'FRLABVIV44PAR',    country: 'FR', patterns: [/stylage/i] },
  { key: 'radiesse',   label: 'Radiesse',     mid: 'DEMERAES100FRA',   country: 'DE', patterns: [/radiesse/i] },
  { key: 'profhilo',   label: 'Profhilo',     mid: 'ITISSFAR2LOD',     country: 'IT', patterns: [/profhilo/i] },
  { key: 'saypha',     label: 'Saypha',       mid: 'ATCROPHA6LEO',     country: 'AT', patterns: [/saypha/i] },
  { key: 'fillmed',    label: 'Fillmed',      mid: 'FRLABFIL38PAR',    country: 'FR', patterns: [/fillmed/i] },
  { key: 'sunekos',    label: 'Sunekos',      mid: 'ITPRODIE1MIL',     country: 'IT', patterns: [/sunekos/i] },
  { key: 'letybo',     label: 'Letybo',       mid: 'ATCROPHA6LEO',     country: 'AT', patterns: [/letybo/i] },
  { key: 'prxt33',     label: 'PRX-T33',      mid: 'ITVIAMAR16MUG',    country: 'IT', patterns: [/prx[\s-]?t33/i] },
  { key: 'bcn',        label: 'BCN',          mid: 'ESINSBCN2BAR',     country: 'ES', patterns: [/\bBCN\b/] },
  { key: 'smb',        label: 'SMB',          mid: 'GBRFMED17STH',     country: 'GB', patterns: [/\bSMB\b/] },

  // ── Ophthalmology ────────────────────────────────────────────────────────
  { key: 'vabysmo',    label: 'Vabysmo',      mid: 'ATROCREG1VIE',     country: 'AT', patterns: [/vabysmo/i, /faricimab/i] },
  { key: 'lumigan',    label: 'Lumigan',      mid: 'GBABBVIEMAI',      country: 'GB', patterns: [/lumigan/i] },

  // ── Contraceptives / Women's health ──────────────────────────────────────
  { key: 'nexplanon',  label: 'Nexplanon',    mid: 'GBORGPHACRA',      country: 'GB', patterns: [/nexplanon/i] },
  { key: 'jaydess',    label: 'Jaydess',      mid: 'GBBAY400REA',      country: 'GB', patterns: [/jaydess/i] },
  { key: 'yasmin',     label: 'Yasmin',       mid: 'NLBAYBV36HOO',     country: 'NL', patterns: [/yasmin/i] },
  { key: 'orgalutran', label: 'Orgalutran',   mid: 'NLNVORG6OSS',      country: 'NL', patterns: [/orgalutran/i, /ganirelix/i] },
  { key: 'fostimon',   label: 'Fostimon',     mid: 'SKIBSSLO42BRA',    country: 'SK', patterns: [/fostimon/i] },
  { key: 'meriofert',  label: 'Meriofert',    mid: 'ITIBSFAR2LOD',     country: 'IT', patterns: [/meriofert/i] },
  { key: 'zivafert',   label: 'Zivafert',     mid: 'ITIBSFAR2LOD',     country: 'IT', patterns: [/zivafert/i] },
  { key: 'cylogest',   label: 'Cylogest',     mid: 'PLGEDRIC5GRO',     country: 'PL', patterns: [/cylogest/i, /progesterone/i] },
  { key: 'estrofem',   label: 'Estrofem',     mid: 'NLNOVNOR8ALP',     country: 'NL', patterns: [/estrofem/i] },
  { key: 'lucrin',     label: 'Lucrin Depot', mid: 'NLABB9HOO',        country: 'NL', patterns: [/lucrin/i, /leuprorelin/i] },

  // ── Oncology ─────────────────────────────────────────────────────────────
  { key: 'verzenios',      label: 'Verzenios 150mg', mid: 'CHELILIL16GEN',  country: 'CH', patterns: [/verzenios/i, /abemaciclib/i] },
  { key: 'verzenio-es',    label: 'Verzenio (ES)',    mid: 'ESLILLY30MAD',   country: 'ES', patterns: [/\bverzenio\b/i] },
  { key: 'tagrisso',       label: 'Tagrisso',         mid: 'SEAST15185SOD',  country: 'SE', patterns: [/tagrisso/i] },
  { key: 'osimertinib',    label: 'Osimertinib 80mg', mid: 'SEASTAB18SOD',   country: 'SE', patterns: [/osimertinib/i] },
  { key: 'revlimid',       label: 'Revlimid',         mid: 'IEBRIMYE22DUB',  country: 'IE', patterns: [/revlimid/i] },
  { key: 'lenalidomide',   label: 'Lenalidomide',     mid: 'DEZEN50FRA',     country: 'DE', patterns: [/lenalidomide/i] },
  { key: 'alecensa',       label: 'Alecensa',         mid: 'CHROC124BAS',    country: 'CH', patterns: [/alecensa/i, /alectinib/i] },
  { key: 'aubagio',        label: 'Aubagio 14mg',     mid: 'DESANAVE703FRA', country: 'DE', patterns: [/aubagio/i, /teriflunomide/i] },
  { key: 'filspari',       label: 'Filspari 400mg',   mid: 'CHCSLVIF37SAN',  country: 'CH', patterns: [/filspari/i, /sparsentan/i] },
  { key: 'jinarc',         label: 'Jinarc',           mid: 'NLOTSPHA292AMS', country: 'NL', patterns: [/jinarc/i, /tolvaptan/i] },

  // ── Biologics / immunology ───────────────────────────────────────────────
  { key: 'hemlibra',   label: 'Hemlibra',     mid: 'DEROC1GRE',        country: 'DE', patterns: [/hemlibra/i, /emicizumab/i] },
  { key: 'orencia',    label: 'Orencia',      mid: 'IEBRIMYESQU254DUB', country: 'IE', patterns: [/orencia/i, /abatacept/i] },
  { key: 'crysvita',   label: 'Crysvita',     mid: 'NLKYOKIR2HOO',     country: 'NL', patterns: [/crysvita/i, /burosumab/i] },
  { key: 'takhzyro',   label: 'Takhzyro 300mg', mid: 'IETAKPHA5058DUB', country: 'IE', patterns: [/takhzyro/i, /lanadelumab/i] },
  { key: 'enbrel',     label: 'Enbrel 50mg',  mid: 'BEPFI-MAN12PUU',   country: 'BE', patterns: [/enbrel/i, /etanercept/i] },
  { key: 'humira',     label: 'Humira 80mg',  mid: 'GBABBLTD64MAI',    country: 'GB', patterns: [/humira/i, /adalimumab/i] },

  // ── Bone / osteoporosis ──────────────────────────────────────────────────
  { key: 'prolia',     label: 'Prolia',       mid: 'PRAMGMAN31JUN',    country: 'PR', patterns: [/prolia/i, /denosumab/i] },
  { key: 'synvisc',    label: 'Synvisc Hylan', mid: 'NLGENEUR25AMS',   country: 'NL', patterns: [/synvisc/i] },

  // ── Other Rx ─────────────────────────────────────────────────────────────
  { key: 'gardasil',   label: 'Gardasil',     mid: 'NLMERSHA39HAA',    country: 'NL', patterns: [/gardasil/i] },
  { key: 'emla',       label: 'Emla',         mid: 'IEASPPHA3016DUB',  country: 'IE', patterns: [/\bemla\b/i] },
  { key: 'clexane',    label: 'Clexane',      mid: 'FRSANVIN82GEN',    country: 'FR', patterns: [/clexane/i, /enoxaparin/i] },
  { key: 'radicut',    label: 'Radicut 50ml', mid: 'JPMITTAN3210OSA',  country: 'JP', patterns: [/radicut/i, /edaravone/i] },
];

export function detectProduct(text) {
  if (!text) return null;
  for (const product of PRODUCTS) {
    for (const pattern of product.patterns) {
      if (pattern.test(text)) return product;
    }
  }
  return null;
}

export function findProductByKey(key) {
  return PRODUCTS.find((p) => p.key === key) || null;
}

export function ciCommentForProduct(product) {
  if (!product || !product.mid) return '';
  return `MID: ${product.mid}`;
}

export const PRODUCT_STATUSES = ['active', 'inactive', 'hold', 'withdrawn'];

// Seed rows for the D1 product catalog, derived from the built-in list. Built-in
// products keep their regex patterns (looked up by key at runtime); DB-only
// products detect by name + keywords.
export function builtinSeedProducts() {
  return PRODUCTS.map((p) => ({
    key: p.key,
    name: p.label,
    mid: p.mid,
    country: p.country,
    description: '',
    hsCode: '',
    manufacturerName: '',
    manufacturingCountry: p.country,
    manufacturingAddress: '',
    keywords: '',
    status: 'active',
  }));
}

// Build a runtime catalog: DB products merged with the built-in regex patterns
// (by key) so seeded products keep their precise detection.
export function buildCatalog(dbProducts) {
  const patByKey = {};
  for (const b of PRODUCTS) patByKey[b.key] = b.patterns;
  return (dbProducts || []).map((p) => ({ ...p, patterns: patByKey[p.key] || null }));
}

function termMatches(text, term) {
  const t = String(term || '').trim();
  if (t.length < 2) return false;
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${esc}`, 'i').test(text);
}

// Detect a product from text against a runtime catalog. Only 'active' products
// are considered. Built-in regex patterns win; otherwise the product name or any
// of its comma-separated keywords must appear (word-start, case-insensitive).
export function detectFromCatalog(text, catalog) {
  if (!text || !catalog) return null;
  for (const p of catalog) {
    if (p.status && p.status !== 'active') continue;
    if (p.patterns && p.patterns.length) {
      for (const re of p.patterns) if (re.test(text)) return p;
    }
  }
  // Name/keyword pass second so a precise regex on another product wins first.
  for (const p of catalog) {
    if (p.status && p.status !== 'active') continue;
    const terms = [p.name, ...String(p.keywords || '').split(',')].map((s) => s.trim()).filter(Boolean);
    for (const term of terms) if (termMatches(text, term)) return p;
  }
  return null;
}
