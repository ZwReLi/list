import { getVal, formatDate, normalizeStr, highlightText, escapeHtml, copyTextToClipboard } from './utils.js';
import { getNftBadgeHtml, getSubtitleBadgesHtml, parseSubtitles, matchesSubtitleFilter, getPrioritySubLangs } from './badges.js';

export function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;

  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.body.classList.add('dark-mode');
    updateToggleBtn(true);
  } else {
    document.body.classList.remove('dark-mode');
    updateToggleBtn(false);
  }

  toggleBtn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateToggleBtn(isDark);
  });
}

export function updateToggleBtn(isDark) {
  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;
  toggleBtn.innerHTML = isDark
    ? ' <i class="fa-solid fa-sun"> </i> '
    : '<i class="fa-solid fa-moon"></i>';
}

export function initRulesToggle() {
  const rulesHeader = document.getElementById('rules-header');
  const rulesBox = document.getElementById('rules-box');
  if (rulesHeader && rulesBox) {
    rulesHeader.addEventListener('click', () => {
      rulesBox.classList.toggle('collapsed');
    });
  }

  const legendHeader = document.getElementById('legend-header');
  const legendBox = document.getElementById('legend-box');
  if (legendHeader && legendBox) {
    legendHeader.addEventListener('click', () => {
      legendBox.classList.toggle('collapsed');
    });
  }
}

function getTypeIcon(typeStr) {
  const lower = (typeStr || '').toLowerCase();
  if (lower.includes('audio')) return 'fa-headphones';
  if (lower.includes('play')) return 'fa-masks-theater';
  if (lower.includes('concert')) return 'fa-drum';
  return 'fa-video';
}

function getShowAudioLang(show) {
  return (getVal(show, 'lang', 'language') || 'EN').toUpperCase();
}

function getShowParsedSubtitles(show, priorityLangs = ['en', 'de']) {
  if (Array.isArray(show._parsedSubtitles)) return show._parsedSubtitles;
  return parseSubtitles(getVal(show, 'subtitles'), priorityLangs);
}

function computeFilterCounts(textMatchedShows, state) {
  const showsForMediaCounts = textMatchedShows.filter(show => {
    const matchesAudio = state.selectedLangs.length === 0 || state.selectedLangs.includes(getShowAudioLang(show));
    const matchesSubs = matchesSubtitleFilter(getShowParsedSubtitles(show, state.prioritySubLangs), state.selectedSubLangs);
    return matchesAudio && matchesSubs;
  });

  const mediaCounts = {
    all: showsForMediaCounts.length,
    video: 0,
    audio: 0,
    play: 0,
    concert: 0
  };

  showsForMediaCounts.forEach(show => {
    const type = normalizeStr(getVal(show, 'type', 'media_type', 'media'));
    if (type.includes('video')) mediaCounts.video++;
    if (type.includes('audio')) mediaCounts.audio++;
    if (type.includes('play')) mediaCounts.play++;
    if (type.includes('concert')) mediaCounts.concert++;
  });

  if (['play', 'concert'].includes(state.currentFilter) && mediaCounts[state.currentFilter] === 0) {
    state.currentFilter = 'all';
  }

  const matchesActiveMedia = (show) => state.currentFilter === 'all' ||
    normalizeStr(getVal(show, 'type', 'media_type', 'media')).includes(state.currentFilter);

  const showsForLangCounts = textMatchedShows.filter(show => {
    return matchesActiveMedia(show) &&
      matchesSubtitleFilter(getShowParsedSubtitles(show, state.prioritySubLangs), state.selectedSubLangs);
  });

  const langCounts = {};
  showsForLangCounts.forEach(show => {
    const lang = getShowAudioLang(show);
    langCounts[lang] = (langCounts[lang] || 0) + 1;
  });

  state.selectedLangs.forEach(lang => {
    if (!(lang in langCounts)) langCounts[lang] = 0;
  });

  const showsForSubCounts = textMatchedShows.filter(show => {
    const matchesAudio = state.selectedLangs.length === 0 || state.selectedLangs.includes(getShowAudioLang(show));
    return matchesActiveMedia(show) && matchesAudio;
  });

  const subLangCounts = {};
  showsForSubCounts.forEach(show => {
    const langsInShow = new Set();
    getShowParsedSubtitles(show, state.prioritySubLangs).forEach(group => {
      group.normalizedLangs.forEach(l => langsInShow.add(l));
    });
    langsInShow.forEach(l => {
      subLangCounts[l] = (subLangCounts[l] || 0) + 1;
    });
  });

  state.selectedSubLangs.forEach(lang => {
    if (!(lang in subLangCounts)) subLangCounts[lang] = 0;
  });

  return { mediaCounts, langCounts, subLangCounts };
}

function renderLangDropdownHtml(langCounts, state) {
  const sortedLangs = Object.keys(langCounts).sort((a, b) => a.localeCompare(b));
  const hasSelectedLangs = state.selectedLangs.length > 0;

  const langOptionsHtml = sortedLangs.map(lang => `
    <label class="filter-option">
      <input type="checkbox" value="${escapeHtml(lang)}" ${state.selectedLangs.includes(lang) ? 'checked' : ''}>
      <span>${escapeHtml(lang)}</span>
      <span class="filter-count">(${langCounts[lang]})</span>
    </label>
  `).join('');

  return `
    <div class="filter-dropdown ${state.langDropdownOpen ? 'open' : ''} ${hasSelectedLangs ? 'has-selection' : ''}" id="lang-dropdown">
      <button type="button" class="filter-btn filter-dropdown-btn ${hasSelectedLangs ? 'active' : ''}" id="lang-dropdown-btn">
        <i class="fa-solid fa-language"></i> Lang <i class="fa-solid fa-chevron-down filter-chevron"></i>
      </button>
      <div class="filter-dropdown-menu" id="lang-dropdown-menu">
        <div class="filter-dropdown-scroll">
          ${langOptionsHtml || '<div class="dropdown-empty">No languages</div>'}
        </div>
        ${hasSelectedLangs ? '<button type="button" class="filter-reset-btn" id="lang-reset-btn">Reset</button>' : ''}
      </div>
    </div>
  `;
}

function renderSubsDropdownHtml(subLangCounts, state) {
  const hasSubsSelection = state.selectedSubLangs.length > 0;
  const priorityCandidates = state.prioritySubLangs && state.prioritySubLangs.length > 0
    ? state.prioritySubLangs
    : getPrioritySubLangs(state.allShows);

  const pinnedLangs = priorityCandidates.filter(lang => lang in subLangCounts);

  const renderSubOption = (lang) => `
    <label class="filter-option">
      <input type="checkbox" value="${escapeHtml(lang)}" ${state.selectedSubLangs.includes(lang) ? 'checked' : ''}>
      <span>${escapeHtml(lang)}</span>
      <span class="filter-count">(${subLangCounts[lang] || 0})</span>
    </label>
  `;

  const pinnedOptionsHtml = pinnedLangs.map(renderSubOption).join('');

  const remainingSortedLangs = Object.keys(subLangCounts)
    .filter(lang => !pinnedLangs.includes(lang))
    .sort((a, b) => a.localeCompare(b));

  const totalUniqueSubLangs = pinnedLangs.length + remainingSortedLangs.length;
  const exceedsLimit = totalUniqueSubLangs > 6;

  let visibleRemainingLangs = remainingSortedLangs;
  let hasHiddenLangs = false;

  if (exceedsLimit && remainingSortedLangs.length > 0) {
    const frequentRemaining = remainingSortedLangs.filter(
      lang => (subLangCounts[lang] || 0) >= 2 || state.selectedSubLangs.includes(lang)
    );
    if (frequentRemaining.length < remainingSortedLangs.length) {
      hasHiddenLangs = true;
      visibleRemainingLangs = state.showAllSubLangs ? remainingSortedLangs : frequentRemaining;
    }
  }

  const remainingOptionsHtml = visibleRemainingLangs.map(renderSubOption).join('');

  const showAllBtnHtml = hasHiddenLangs && !state.showAllSubLangs
    ? `<button type="button" class="filter-show-more-btn" id="subs-show-all-btn">show all (${totalUniqueSubLangs})</button>`
    : '';

  const resetBtnHtml = hasSubsSelection
    ? '<button type="button" class="filter-reset-btn" id="subs-reset-btn">Reset</button>'
    : '';

  const hasAnyOptions = pinnedOptionsHtml || remainingOptionsHtml;

  return `
    <div class="filter-dropdown subs-dropdown ${state.subsDropdownOpen ? 'open' : ''} ${hasSubsSelection ? 'has-selection' : ''}" id="subs-dropdown">
      <button type="button" class="filter-btn filter-dropdown-btn ${hasSubsSelection ? 'active' : ''}" id="subs-dropdown-btn">
        <i class="fa-solid fa-closed-captioning"></i> Subs <i class="fa-solid fa-chevron-down filter-chevron"></i>
      </button>
      <div class="filter-dropdown-menu" id="subs-dropdown-menu">
        <div class="filter-dropdown-scroll">
          ${pinnedOptionsHtml}
          ${pinnedOptionsHtml && remainingOptionsHtml ? '<div class="dropdown-divider"></div>' : ''}
          ${remainingOptionsHtml}
          ${!hasAnyOptions ? '<div class="dropdown-empty">No subtitles</div>' : ''}
        </div>
        ${showAllBtnHtml}
        ${resetBtnHtml}
      </div>
    </div>
  `;
}

function bindFilterBarEvents(container, state, callbacks) {
  const { onFilterChange, onLangChange, onSubsChange, onToggleAll } = callbacks;

  container.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      onFilterChange(btn.getAttribute('data-filter'));
    });
  });

  const langDropdown = document.getElementById('lang-dropdown');
  const langBtn = document.getElementById('lang-dropdown-btn');
  const langMenu = document.getElementById('lang-dropdown-menu');

  if (langDropdown && langBtn && langMenu) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !state.langDropdownOpen;
      state.langDropdownOpen = willOpen;
      if (willOpen) {
        state.subsDropdownOpen = false;
        state.showAllSubLangs = false;
      }
      syncDropdownClasses();
    });

    langMenu.addEventListener('click', (e) => e.stopPropagation());

    langMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        state.langDropdownOpen = true;
        const checked = Array.from(langMenu.querySelectorAll('input[type="checkbox"]:checked'))
          .map(input => input.value);
        onLangChange(checked);
      });
    });
  }

  const langResetBtn = document.getElementById('lang-reset-btn');
  if (langResetBtn) {
    langResetBtn.addEventListener('click', () => {
      state.langDropdownOpen = false;
      onLangChange([]);
    });
  }

  const subsDropdown = document.getElementById('subs-dropdown');
  const subsBtn = document.getElementById('subs-dropdown-btn');
  const subsMenu = document.getElementById('subs-dropdown-menu');

  if (subsDropdown && subsBtn && subsMenu) {
    subsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !state.subsDropdownOpen;
      state.subsDropdownOpen = willOpen;
      if (willOpen) {
        state.langDropdownOpen = false;
        state.showAllSubLangs = false;
        onSubsChange(state.selectedSubLangs);
        return;
      }
      state.showAllSubLangs = false;
      syncDropdownClasses();
    });

    subsMenu.addEventListener('click', (e) => e.stopPropagation());

    subsMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        state.subsDropdownOpen = true;
        const checkedLangs = Array.from(subsMenu.querySelectorAll('input[type="checkbox"]:checked'))
          .map(input => input.value);
        onSubsChange(checkedLangs);
      });
    });
  }

  const subsShowAllBtn = document.getElementById('subs-show-all-btn');
  if (subsShowAllBtn) {
    subsShowAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.showAllSubLangs = true;
      state.subsDropdownOpen = true;
      onSubsChange(state.selectedSubLangs);
    });
  }

  const subsResetBtn = document.getElementById('subs-reset-btn');
  if (subsResetBtn) {
    subsResetBtn.addEventListener('click', () => {
      state.subsDropdownOpen = false;
      state.showAllSubLangs = false;
      onSubsChange([]);
    });
  }

  if (!window._filterOutsideClickBound) {
    window._filterOutsideClickBound = true;
    document.addEventListener('click', () => {
      state.langDropdownOpen = false;
      state.subsDropdownOpen = false;
      state.showAllSubLangs = false;
      syncDropdownClasses();
    });
  }

  const toggleAllBtn = document.getElementById('toggle-all-btn');
  if (toggleAllBtn) {
    toggleAllBtn.addEventListener('click', () => {
      onToggleAll();
    });
  }

  function syncDropdownClasses() {
    const lDrop = document.getElementById('lang-dropdown');
    const sDrop = document.getElementById('subs-dropdown');
    if (lDrop) lDrop.classList.toggle('open', state.langDropdownOpen);
    if (sDrop) sDrop.classList.toggle('open', state.subsDropdownOpen);
  }
}

export function renderFilterButtons(textMatchedShows, state, callbacks) {
  const container = document.getElementById('filter-container');
  if (!container) return;

  const { mediaCounts, langCounts, subLangCounts } = computeFilterCounts(textMatchedShows, state);

  const filterConfigs = [
    { id: 'all', label: `All ${mediaCounts.all}`, icon: '', show: true },
    { id: 'video', label: `${mediaCounts.video}`, icon: 'fa-video', show: true },
    { id: 'audio', label: `${mediaCounts.audio}`, icon: 'fa-headphones', show: true },
    { id: 'play', label: `(${mediaCounts.play})`, icon: 'fa-masks-theater', show: mediaCounts.play > 0 },
    { id: 'concert', label: `(${mediaCounts.concert})`, icon: 'fa-drum', show: mediaCounts.concert > 0 }
  ];

  const buttonsHtml = filterConfigs
    .filter(f => f.show)
    .map(f => `
      <button class="filter-btn ${state.currentFilter === f.id ? 'active' : ''}" data-filter="${f.id}">
        ${f.icon ? `<i class="fa-solid ${f.icon}"></i> ` : ''}${f.label}
      </button>
    `)
    .join('');

  const langDropdownHtml = renderLangDropdownHtml(langCounts, state);
  const subsDropdownHtml = renderSubsDropdownHtml(subLangCounts, state);

  let toggleLabel = 'Expand';
  let toggleIcon = 'fa-angle-down';
  if (state.expandLevel === 1) {
    toggleLabel = 'Expand All';
    toggleIcon = 'fa-angles-down';
  } else if (state.expandLevel === 2) {
    toggleLabel = 'Collapse All';
    toggleIcon = 'fa-angles-up';
  }

  container.innerHTML = `
    <div class="media-filter-group">
      ${buttonsHtml}
    </div>
    ${langDropdownHtml}
    ${subsDropdownHtml}
    <button class="filter-btn toggle-all-btn" id="toggle-all-btn">
      <i class="fa-solid ${toggleIcon}"></i> ${toggleLabel}
    </button>
  `;

  bindFilterBarEvents(container, state, callbacks);
}

function buildChildCardHtml(show, title, state, searchQuery) {
  const isPending = getVal(show, 'pending') == '1';
  const location = getVal(show, 'location');
  const rawDate = getVal(show, 'date');
  const date = formatDate(rawDate);
  const version = getVal(show, 'version');
  const lang = getShowAudioLang(show);

  let dateLocation = date && location
    ? `${date} — ${location}`
    : (date || location || formatDate(getVal(show, 'location_date')));
  if (version) {
    dateLocation += version.startsWith('(') ? ` ${version}` : ` (${version})`;
  }

  const type = getVal(show, 'type', 'media_type', 'media');
  const format = getVal(show, 'format');
  const size = getVal(show, 'filesize', 'size');
  const time = getVal(show, 'time', 'runtime', 'duration');
  const master = getVal(show, 'master');
  const rawEncora = getVal(show, 'encora', 'encora_id').replace(/\.0$/, '');
  const encora = /^\d+$/.test(rawEncora) ? rawEncora : '';
  const nft = getVal(show, 'nft', 'nft_date');

  const mediaLabel = format || (type ? type.charAt(0).toUpperCase() + type.slice(1) : '');
  const typeIcon = getTypeIcon(type);
  const subtitleBadgesHtml = getSubtitleBadgesHtml(
    getShowParsedSubtitles(show, state.prioritySubLangs),
    state.prioritySubLangs
  );
  const nftBadgeHtml = getNftBadgeHtml(nft);
  const langDisplay = getVal(show, 'lang', 'language') ? `<span class="badge">${escapeHtml(lang)}</span>` : '';

  const displayCast = highlightText(getVal(show, 'cast'), searchQuery);
  const displayMasterNotes = highlightText(getVal(show, 'master-notes', 'master_notes'), searchQuery);
  const displayMyNotes = highlightText(getVal(show, 'my-notes', 'my_notes'), searchQuery);
  const displayGenericNotes = highlightText(getVal(show, 'notes'), searchQuery);
  const flickr = getVal(show, 'screenshots', 'flickr');
  const file = getVal(show, 'filename', 'file');
  let price = getVal(show, 'list_price (USD)', 'list_price', 'price').replace(/\.0$/, '');
  if (price && !price.startsWith('$')) price = '$' + price;
  const source = getVal(show, 'aquisition', 'acquisition', 'source', 'gift');
  const link = getVal(show, 'link', 'url');

  const masterNotesHtml = displayMasterNotes
    ? `<div class="section-content master-notes"><i class="fa-solid fa-circle-info"></i> ${displayMasterNotes}</div>`
    : '';

  const hasSubOrPreview = Boolean(subtitleBadgesHtml || flickr);
  const subtitlesAndPreviewHtml = hasSubOrPreview
    ? `
      <div class="subtitles-preview-row">
        ${subtitleBadgesHtml ? `<div class="subtitle-badges-list">${subtitleBadgesHtml}</div>` : ''}
        ${flickr ? `<div class="flickr-link"><i class="fa-solid fa-images"></i> <a href="${escapeHtml(flickr)}" target="_blank">${escapeHtml(flickr)}</a></div>` : ''}
      </div>
    `
    : '';

  let secondaryNotesHtml = '';
  if (displayMyNotes) {
    secondaryNotesHtml += `<div class="section-title"><i class="fa-solid fa-note-sticky"></i> My Notes</div><div class="section-content">${displayMyNotes}</div>`;
  }
  if (!displayMasterNotes && !displayMyNotes && displayGenericNotes) {
    secondaryNotesHtml += `<div class="section-title"><i class="fa-solid fa-circle-info"></i> Notes</div><div class="section-content">${displayGenericNotes}</div>`;
  }

  const hasFooterDetails = file || price || source || link;
  const childCollapsed = state.expandLevel <= 1 ? ' collapsed' : '';

  const copyText = [
    title,
    location,
    date,
    master,
    `${mediaLabel}${size ? ` (${size})` : ''}`
  ].filter(Boolean).join(' | ');

  const safeCopyText = escapeHtml(copyText);
  const copyBtn = `<button type="button" class="copy-btn badge" data-copy="${safeCopyText}" title="Copy to clipboard"><i class="fa-regular fa-copy"></i></button>`;

  return `
    <div class="showcard child-card${childCollapsed}">
      <div class="card-header child-header">
        <div class="child-header-main">
          <strong class="child-header-date">${escapeHtml(dateLocation || 'Unknown Date/Location')}</strong>
          <div class="child-header-badges">
            <div class="badge-group nowrap">
              ${isPending ? '<span class="badge badge-pending"><i class="fa-solid fa-clock"></i> Pending</span>' : ''}
              ${langDisplay}
              ${mediaLabel ? `<span class="badge" title="${escapeHtml(mediaLabel)}"><i class="fa-solid ${typeIcon}"></i></span>` : ''}
              ${master ? `<span class="badge"><i class="fa-solid fa-user-secret"></i> ${escapeHtml(master)}</span>` : ''}
            </div>
            <div class="badge-group nowrap right-aligned">
              ${nftBadgeHtml}
              ${copyBtn}
            </div>
          </div>
        </div>
        <button type="button" class="card-toggle-btn"><i class="fa-solid fa-chevron-up"></i></button>
      </div>

      <div class="card-details">
        <div class="card-body">
          <div class="badges-row">
            <div class="badge-group">
              ${mediaLabel ? `<span class="badge"><i class="fa-solid ${typeIcon}"></i> ${escapeHtml(mediaLabel)}</span>` : ''}
              ${size ? `<span class="badge"><i class="fa-solid fa-hard-drive"></i> ${escapeHtml(size)}</span>` : ''}
              ${time ? `<span class="badge"><i class="fa-solid fa-clock"></i> ${escapeHtml(time)}</span>` : ''}
              ${encora ? `<span class="badge"><i class="fa-solid fa-database"></i> <a href="https://encora.it/recordings/${encora}" target="_blank"><u>${encora}</u></a></span>` : ''}
            </div>
          </div>

          ${displayCast ? `<div class="section-content"><i class="fa-solid fa-users"></i> ${displayCast}</div>` : ''}
          ${masterNotesHtml}
          ${subtitlesAndPreviewHtml}
          ${secondaryNotesHtml}

          ${hasFooterDetails ? '<hr>' : ''}
          ${hasFooterDetails ? `
            <div class="card-footer-details">
              <div>
                ${file ? `<div><i class="fa-solid fa-hard-drive"></i> <code>${escapeHtml(file)}</code></div>` : ''}
                ${price ? `<div><i class="fa-solid fa-tag"></i> Price: ${escapeHtml(price)}</div>` : ''}
              </div>
              <div>
                ${source ? `<span><i class="fa-solid fa-gift"></i> ${escapeHtml(source)}</span><br>` : ''}
                ${link ? `<i class="fa-solid fa-link"></i> <a href="${escapeHtml(link)}" target="_blank">Download Link</a>` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function bindParentCardEvents(parentCard) {
  const parentHeader = parentCard.querySelector('.parent-header');
  if (parentHeader) {
    parentHeader.addEventListener('click', () => {
      parentCard.classList.toggle('collapsed');
    });
  }

  parentCard.querySelectorAll('.child-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('.copy-btn')) return;
      e.stopPropagation();
      const childCard = header.closest('.child-card');
      if (childCard) childCard.classList.toggle('collapsed');
    });
  });

  parentCard.querySelectorAll('.badge-sub-expandable').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = btn.getAttribute('data-expanded') === 'true';
      btn.setAttribute('data-expanded', String(!isExpanded));
    });
  });

  parentCard.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = btn.getAttribute('data-copy');
      copyTextToClipboard(text)
        .then(() => {
          const originalHtml = btn.innerHTML;
          btn.innerHTML = '<i class="fa-solid fa-check"></i>';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('copied');
          }, 1500);
        })
        .catch(err => console.error('Copy failed:', err));
    });
  });
}

export function renderCatalog(shows, state, searchQuery = '') {
  const container = document.getElementById('catalog-container');
  container.innerHTML = '';

  if (shows.length === 0) {
    container.innerHTML = '<div class="catalog-empty">No matching entries found.</div>';
    return;
  }

  const groupedShows = {};
  shows.forEach(show => {
    const title = getVal(show, 'title', 'show') || 'Unknown Production';
    if (!groupedShows[title]) groupedShows[title] = [];
    groupedShows[title].push(show);
  });

  Object.keys(groupedShows).forEach(title => {
    const group = groupedShows[title];
    const parentCard = document.createElement('div');
    const parentCollapsed = state.expandLevel === 0 ? ' collapsed' : '';
    parentCard.className = `showcard parent-card${parentCollapsed}`;

    const childrenHtml = group
      .map(show => buildChildCardHtml(show, title, state, searchQuery))
      .join('');

    parentCard.innerHTML = `
      <div class="card-header parent-header">
        <h2 class="card-title">${escapeHtml(title)}</h2>
        <button type="button" class="card-toggle-btn"><i class="fa-solid fa-chevron-up"></i></button>
      </div>
      <div class="card-details parent-details">
        ${childrenHtml}
      </div>
    `;

    bindParentCardEvents(parentCard);
    container.appendChild(parentCard);
  });
}