import { normalizeStr } from './utils.js';

export const LANG_ALIASES = {
  en: 'english usa american uk british australia australian canada canadian',
  'en-gb': 'british english uk united kingdom england london west end',
  'en-us': 'american english us usa united states broadway',
  'en-au': 'australian english australia',
  'en-ca': 'canadian english canada',
  de: 'german germany deutsch austria austrian switzerland swiss',
  'de-at': 'austrian german austria vienna',
  'de-ch': 'swiss german switzerland',
  nl: 'dutch netherlands holland flemish belgium',
  fr: 'french france paris belgium canada quebec',
  'fr-ca': 'canadian french quebec canada',
  es: 'spanish spain espanol castilian latin america',
  'es-419': 'latin american spanish mexico argentina',
  'es-mx': 'mexican spanish mexico',
  pt: 'portuguese portugal brazil brazilian',
  'pt-br': 'brazilian portuguese brazil',
  it: 'italian italy',
  hu: 'hungarian hungary magyar budapest',
  cs: 'czech czechia czech republic prague',
  sk: 'slovak slovakia',
  pl: 'polish poland warsaw',
  ru: 'russian russia',
  uk: 'ukrainian ukraine',
  bg: 'bulgarian bulgaria',
  ro: 'romanian romania',
  hr: 'croatian croatia',
  sr: 'serbian serbia',
  sl: 'slovenian slovene slovenia',
  et: 'estonian estonia',
  lv: 'latvian latvia',
  lt: 'lithuanian lithuania',
  fi: 'finnish finland',
  sv: 'swedish sweden stockholm',
  no: 'norwegian norway oslo',
  da: 'danish denmark copenhagen',
  is: 'icelandic iceland',
  el: 'greek greece',
  tr: 'turkish turkey',
  he: 'hebrew israel',
  ar: 'arabic middle east',
  ja: 'japanese japan tokyo',
  ko: 'korean south korea seoul',
  zh: 'chinese china mandarin cantonese',
  'zh-tw': 'traditional chinese taiwan mandarin',
  'zh-cn': 'simplified chinese china mandarin',
  'zh-hk': 'cantonese hong kong chinese',
  vi: 'vietnamese vietnam',
  th: 'thai thailand',
  id: 'indonesian indonesia',
  ms: 'malay malaysia',
  tl: 'tagalog filipino philippines',
  hi: 'hindi india',
  ga: 'irish ireland gaelic',
  cy: 'welsh wales',
  gd: 'scottish gaelic scotland',
  ca: 'catalan catalonia spain'
};

export const TERM_ALIASES = {
  '1nt': '1st national us tour first national us tour uk & and ireland tour',
  '2nt': '2nd national us tour second national us tour uk & and ireland tour',
  '3nt': '3rd national us tour third national us tour uk & and ireland tour',
  '4nt': '4th national us tour fourth national us tour uk & and ireland tour',
  nt: 'national us tour',
  'uk tour': 'united kingdom tour british tour uk & and ireland tour',
  'uk & ireland': 'uk and ireland united kingdom ireland uk tour',
  'uk and ireland': 'uk & ireland united kingdom ireland uk tour',
  'uk/ire': 'uk & and ireland united kingdom ireland uk tour',
  'uk/ie': 'uk & and ireland united kingdom ireland uk tour',
  '1st': 'first',
  '2nd': 'second',
  '3rd': 'third',
  '4th': 'fourth',
  '5th': 'fifth',
  rev: 'revival',
  'non-eq': 'non-equity non equity',
  noneq: 'non-equity non equity',
  eq: 'equity',
  we: 'west end london',
  bway: 'broadway',
  'off-bway': 'off-broadway off broadway',
  'pre-bway': 'pre-broadway pre broadway tryout',
  obc: 'original broadway cast',
  olc: 'original london cast',
  olvc: 'original london cast',
  prev: 'preview previews',
  'u/s': 'understudy',
  's/b': 'standby'
};

export const VERSION_ALIASES = {
  e: 'evening',
  m: 'matinee',
  prev: 'preview previews',
  opening: 'opening night',
  closing: 'closing night'
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lookupLangAlias(rawCode) {
  if (!rawCode) return '';
  const code = rawCode.trim().toLowerCase();
  if (LANG_ALIASES[code]) return LANG_ALIASES[code];
  const base = code.split('-')[0];
  return LANG_ALIASES[base] || '';
}

function collectAliasExpansions(text, aliasMap) {
  if (!text) return '';
  const expansions = [];
  Object.entries(aliasMap).forEach(([abbr, expansion]) => {
    const pattern = new RegExp(`(?:^|[\\s,()/.-])${escapeRegex(abbr)}(?=$|[\\s,()/.-])`, 'i');
    if (pattern.test(text)) {
      expansions.push(expansion);
    }
  });
  return normalizeStr(expansions.join(' '));
}

export function expandLangSearch(langStr) {
  if (!langStr) return '';
  const codes = langStr
    .split(/[,/]+/)
    .map(c => c.trim().toLowerCase())
    .filter(Boolean);

  const parts = [];
  codes.forEach(code => {
    parts.push(code);
    const base = code.split('-')[0];
    if (base && base !== code) parts.push(base);
    const alias = lookupLangAlias(code);
    if (alias) parts.push(alias);
  });

  return normalizeStr(parts.join(' '));
}

export function expandSubtitleSearch(parsedGroups) {
  if (!parsedGroups || parsedGroups.length === 0) return '';
  const parts = [];

  parsedGroups.forEach(group => {
    if (group.type === 'sdh') {
      parts.push('sdh deaf hard of hearing');
    } else if (group.type === 'cc') {
      parts.push('cc closed captions');
    } else if (group.type) {
      parts.push(group.type);
    }

    if (group.credit) {
      parts.push(group.credit);
    }

    group.langs.forEach(code => {
      parts.push(code);
      const base = code.split('-')[0];
      if (base && base !== code) parts.push(base);
      const alias = lookupLangAlias(code);
      if (alias) parts.push(alias);
      parts.push('subtitle subtitles sub subs');
    });
  });

  return normalizeStr(parts.join(' '));
}

export function expandTermAliases(text) {
  return collectAliasExpansions(text, TERM_ALIASES);
}

export function expandVersionAliases(versionStr) {
  if (!versionStr) return '';
  const termPart = collectAliasExpansions(versionStr, TERM_ALIASES);
  const versionPart = collectAliasExpansions(versionStr, VERSION_ALIASES);
  return [termPart, versionPart].filter(Boolean).join(' ');
}