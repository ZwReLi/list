import { formatDate, escapeHtml, getVal } from './utils.js';

export function getNftBadgeHtml(nftStr) {
  if (!nftStr) {
    return `<span class="badge"><i class="fa-solid fa-arrows-rotate"></i></span>`;
  }

  const parts = nftStr.split(',').map(p => p.trim()).filter(p => p.length > 0);
  if (parts.length === 0) {
    return `<span class="badge"><i class="fa-solid fa-arrows-rotate"></i></span>`;
  }

  const badges = parts.map(part => {
    const lower = part.toLowerCase();

    if (['open for trade', 'trade', 'open'].includes(lower)) {
      return `<span class="badge"><i class="fa-solid fa-arrows-rotate"></i></span>`;
    }
    if (['no trade', 'not for trade', 'no-trade'].includes(lower)) {
      return `<span class="badge badge-nft"><i class="fa-solid fa-arrows-rotate"></i></span>`;
    }

    if (['gift', 'gifting', 'gifting allowed', 'gift allowed'].includes(lower)) {
      return `<span class="badge"><i class="fa-solid fa-gift"></i></span>`;
    }
    if (['no gift', 'no gifting', 'not for gift', 'no-gift'].includes(lower)) {
      return `<span class="badge badge-nft"><i class="fa-solid fa-gift"></i></span>`;
    }

    const isoMatch = part.match(/(\d{4})-(0[0-9]|1[0-2])-(00|[0-2][0-9]|3[01])/);
    let nftDate = null;

    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = isoMatch[2] === '00' ? 0 : parseInt(isoMatch[2], 10) - 1;
      const day = isoMatch[3] === '00' ? 1 : parseInt(isoMatch[3], 10);
      nftDate = new Date(year, month, day, 23, 59, 59);
    } else {
      const parsed = Date.parse(part);
      if (!isNaN(parsed)) {
        nftDate = new Date(parsed);
      }
    }

    if (nftDate) {
      const formattedDisplay = formatDate(part);
      const now = new Date();
      if (nftDate <= now) {
        return `<span class="badge"><i class="fa-solid fa-arrows-rotate"></i> ${formattedDisplay}</span>`;
      }
      return `<span class="badge badge-nft"><i class="fa-solid fa-arrows-rotate"></i> ${formattedDisplay}</span>`;
    }

    return `<span class="badge">${escapeHtml(part)}</span>`;
  });

  return badges.join(' ');
}

export function sortSubLangs(langs, priorityLangs = ['en', 'de']) {
  const getRank = (code) => {
    const base = code.split('-')[0].toLowerCase();
    const idx = priorityLangs.indexOf(base);
    return idx === -1 ? priorityLangs.length : idx;
  };

  return [...langs].sort((a, b) => {
    const rankDiff = getRank(a) - getRank(b);
    if (rankDiff !== 0) return rankDiff;
    const baseA = a.split('-')[0];
    const baseB = b.split('-')[0];
    if (baseA === baseB && a.length !== b.length) {
      return a.length - b.length;
    }
    return a.localeCompare(b);
  });
}

export function getPrioritySubLangs(shows) {
  const totalCounts = {};
  shows.forEach(show => {
    const groups = Array.isArray(show._parsedSubtitles)
      ? show._parsedSubtitles
      : parseSubtitles(getVal(show, 'subtitles'));
    const langsInShow = new Set();
    groups.forEach(group => {
      group.normalizedLangs.forEach(l => langsInShow.add(l));
    });
    langsInShow.forEach(l => {
      totalCounts[l] = (totalCounts[l] || 0) + 1;
    });
  });

  const thirdTopLang = Object.keys(totalCounts)
    .filter(lang => lang !== 'en' && lang !== 'de')
    .sort((a, b) => (totalCounts[b] - totalCounts[a]) || a.localeCompare(b))[0];

  const priority = ['en', 'de'];
  if (thirdTopLang) priority.push(thirdTopLang);
  return priority;
}

function parseGroupItems(remainder) {
  const tokens = [];
  let current = '';
  let depth = 0;

  for (const ch of remainder) {
    if (ch === '(') depth++;
    if (ch === ')' && depth > 0) depth--;
    if (ch === ',' && depth === 0) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());

  const itemMap = new Map();
  tokens.forEach(token => {
    const match = token.match(/^([^(]+?)(?:\s*\(([^)]+)\))?$/);
    if (!match) return;
    const code = match[1].trim().toLowerCase();
    const credit = match[2] ? match[2].trim() : '';
    if (!code) return;

    if (!itemMap.has(code)) {
      itemMap.set(code, { code, credit });
    } else if (credit && !itemMap.get(code).credit) {
      itemMap.get(code).credit = credit;
    }
  });

  const rawItems = Array.from(itemMap.values());
  if (rawItems.length === 0) return { items: [], groupCredit: '' };

  const creditedItems = rawItems.filter(item => item.credit);
  const lastToken = tokens[tokens.length - 1] || '';
  const hasSpaceBeforeParen = /\s+\([^)]+\)$/.test(lastToken);
  const lastItem = rawItems[rawItems.length - 1];

  if (
    creditedItems.length === 1 &&
    lastItem.credit &&
    (rawItems.length === 1 || hasSpaceBeforeParen)
  ) {
    return {
      items: rawItems.map(item => ({ code: item.code, credit: '' })),
      groupCredit: lastItem.credit
    };
  }

  return { items: rawItems, groupCredit: '' };
}

export function parseSubtitles(subtitleStr, priorityLangs = ['en', 'de']) {
  if (!subtitleStr || typeof subtitleStr !== 'string') return [];

  const rawGroups = subtitleStr.split(';').map(g => g.trim()).filter(Boolean);
  const parsed = [];

  rawGroups.forEach(rawGroup => {
    let type = 'cc';
    let remainder = rawGroup;

    if (rawGroup.includes(':')) {
      const colonIdx = rawGroup.indexOf(':');
      const rawType = rawGroup.slice(0, colonIdx).trim().toLowerCase();
      type = rawType === 'sub' ? 'cc' : (rawType || 'cc');
      remainder = rawGroup.slice(colonIdx + 1).trim();
    }

    const { items: unsortedItems, groupCredit } = parseGroupItems(remainder);
    if (unsortedItems.length === 0) return;

    const sortedCodes = sortSubLangs(
      unsortedItems.map(item => item.code),
      priorityLangs
    );
    const byCode = new Map(unsortedItems.map(item => [item.code, item]));
    const items = sortedCodes.map(code => byCode.get(code));

    const langs = items.map(item => item.code);
    const normalizedLangs = sortSubLangs(
      [...new Set(langs.map(l => l.split('-')[0].toLowerCase()).filter(Boolean))],
      priorityLangs
    );

    parsed.push({
      type,
      items,
      langs,
      normalizedLangs,
      credit: groupCredit
    });
  });

  return parsed;
}

export function matchesSubtitleFilter(parsedGroups, selectedSubLangs) {
  if (selectedSubLangs.length === 0) return true;
  if (!parsedGroups || parsedGroups.length === 0) return false;

  return parsedGroups.some(group =>
    group.normalizedLangs.some(l => selectedSubLangs.includes(l))
  );
}

function buildSubtitleBadgeElement(group) {
  const fullText = group.langs.join(', ');
  const isExpandable = group.langs.length > 4;

  let badgeClass = 'badge badge-sub';
  let prefixHtml = '<i class="fa-solid fa-closed-captioning"></i>';
  let titleText = 'Standard Subtitles';

  if (group.type === 'sdh') {
    badgeClass = 'badge badge-sdh';
    prefixHtml = '<i class="fa-solid fa-ear-deaf"></i>';
    titleText = 'SDH (Deaf/Hard of Hearing)';
  } else if (group.type !== 'cc') {
    badgeClass = 'badge badge-sub-neutral';
    prefixHtml = `<strong>${escapeHtml(group.type)}:</strong>`;
    titleText = `${group.type} subtitles`;
  }

  if (isExpandable) {
    return `<button type="button" class="${badgeClass} badge-sub-expandable" data-expanded="false" title="${escapeHtml(`${titleText} — click to toggle all ${group.langs.length}`)}">${prefixHtml} <span class="badge-sub-text">${escapeHtml(fullText)}</span><span class="badge-sub-fade" aria-hidden="true"><i class="fa-solid fa-chevron-right"></i></span></button>`;
  }

  return `<span class="${badgeClass}" title="${escapeHtml(titleText)}">${prefixHtml} ${escapeHtml(fullText)}</span>`;
}

function buildExternalCreditText(group) {
  if (group.credit) {
    return `by ${group.credit}`;
  }
  if (!Array.isArray(group.items) || group.items.length === 0) {
    return '';
  }

  const byAuthor = new Map();
  group.items.forEach(item => {
    if (!item.credit) return;
    if (!byAuthor.has(item.credit)) {
      byAuthor.set(item.credit, []);
    }
    byAuthor.get(item.credit).push(item.code);
  });

  if (byAuthor.size === 0) return '';

  const allCreditedCount = group.items.filter(item => item.credit).length;
  if (byAuthor.size === 1 && allCreditedCount === group.items.length) {
    const [onlyAuthor] = byAuthor.keys();
    return `by ${onlyAuthor}`;
  }

  const parts = Array.from(byAuthor.entries())
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
    .map(([author, codes]) => `${author} (${codes.join(', ')})`);

  return `by ${parts.join(', ')}`;
}

export function getSubtitleBadgesHtml(subtitleInput, priorityLangs = ['en', 'de']) {
  const groups = Array.isArray(subtitleInput)
    ? subtitleInput
    : parseSubtitles(subtitleInput, priorityLangs);

  if (groups.length === 0) return '';

  return groups
    .map(group => {
      const badgeHtml = buildSubtitleBadgeElement(group);
      const externalCredit = buildExternalCreditText(group);
      const creditHtml = externalCredit
        ? `<span class="sub-credit">${escapeHtml(externalCredit)}</span>`
        : '';
      return `<span class="sub-entry">${badgeHtml}${creditHtml}</span>`;
    })
    .join(' ');
}