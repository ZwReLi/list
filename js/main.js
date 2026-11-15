import { normalizeStr, getVal, formatDate, formatDateFull, renderCatalogStats } from './utils.js';
import { parseSubtitles, matchesSubtitleFilter, getPrioritySubLangs, sortSubLangs } from './badges.js';
import { expandLangSearch, expandSubtitleSearch, expandTermAliases, expandVersionAliases } from './lookup.js';
import { initTheme, initRulesToggle, renderFilterButtons, renderCatalog } from './ui.js';

const BASE_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRFLXmcxhCukoZ49uM8o6XV8dILDUB51kDuH14e6ebmEpZiip3WbV4IYExQzUt00B93RH1rfIOsXT61/pub?gid=0&single=true&output=csv';
const CSV_URL = `${BASE_CSV_URL}&_=${Date.now()}`;

const state = {
  allShows: [],
  prioritySubLangs: ['en', 'de'],
  currentFilter: 'all',
  selectedLangs: [],
  langDropdownOpen: false,
  selectedSubLangs: [],
  subsDropdownOpen: false,
  showAllSubLangs: false,
  expandLevel: 1
};

function stripLeadingArticle(title) {
  return title.replace(/^(?:the|a|an)\s+/i, '').trim();
}

function sortShows(shows) {
  shows.sort((a, b) => {
    const titleA = getVal(a, 'title', 'show');
    const titleB = getVal(b, 'title', 'show');
    const titleCmp = stripLeadingArticle(titleA).localeCompare(
      stripLeadingArticle(titleB),
      undefined,
      { sensitivity: 'base', numeric: true }
    ) || titleA.localeCompare(titleB, undefined, { sensitivity: 'base', numeric: true });
    if (titleCmp !== 0) return titleCmp;

    const dateA = getVal(a, 'date');
    const dateB = getVal(b, 'date');
    const dateCmp = dateB.localeCompare(dateA, undefined, { sensitivity: 'base', numeric: true });
    if (dateCmp !== 0) return dateCmp;

    const locA = getVal(a, 'location');
    const locB = getVal(b, 'location');
    const locCmp = locA.localeCompare(locB, undefined, { sensitivity: 'base', numeric: true });
    if (locCmp !== 0) return locCmp;

    const verA = getVal(a, 'version');
    const verB = getVal(b, 'version');
    return verA.localeCompare(verB, undefined, { sensitivity: 'base', numeric: true });
  });
}

function prepareShows(shows) {
  shows.forEach(show => {
    show._parsedSubtitles = parseSubtitles(getVal(show, 'subtitles'));
  });

  state.prioritySubLangs = getPrioritySubLangs(shows);

  shows.forEach(show => {
    show._parsedSubtitles.forEach(group => {
      group.langs = sortSubLangs(group.langs, state.prioritySubLangs);
      group.normalizedLangs = sortSubLangs(group.normalizedLangs, state.prioritySubLangs);
    });
  });

  sortShows(shows);
}

function getSearchFields(show) {
  const title = normalizeStr(getVal(show, 'title', 'show'));
  const rawLocation = getVal(show, 'location');
  const location = normalizeStr(rawLocation);
  const locationExpanded = expandTermAliases(rawLocation);

  const rawVersion = getVal(show, 'version');
  const version = normalizeStr(rawVersion);
  const versionExpanded = expandVersionAliases(rawVersion);

  const rawDate = normalizeStr(getVal(show, 'date'));
  const dateFormatted = normalizeStr(formatDate(getVal(show, 'date')));
  const dateFull = normalizeStr(formatDateFull(getVal(show, 'date')));
  const type = normalizeStr(getVal(show, 'type', 'media_type', 'media'));
  const rawLang = getVal(show, 'lang', 'language');
  const langExpanded = expandLangSearch(rawLang);
  const master = normalizeStr(getVal(show, 'master'));
  const encora = normalizeStr(getVal(show, 'encora', 'encora_id'));
  const time = normalizeStr(getVal(show, 'time', 'runtime', 'duration'));
  const subtitles = normalizeStr(getVal(show, 'subtitles'));
  const subtitlesExpanded = expandSubtitleSearch(show._parsedSubtitles);

  const group1Text = [
    title,
    location,
    locationExpanded,
    version,
    versionExpanded,
    rawDate,
    dateFormatted,
    dateFull,
    type,
    langExpanded,
    subtitles,
    subtitlesExpanded,
    master,
    encora,
    time
  ].filter(Boolean).join(' ');

  const cast = normalizeStr(getVal(show, 'cast'));
  const masterNotes = normalizeStr(getVal(show, 'master-notes', 'master_notes'));
  const myNotes = normalizeStr(getVal(show, 'my-notes', 'my_notes'));
  const genericNotes = normalizeStr(getVal(show, 'notes'));

  const group2Text = `${cast} ${masterNotes} ${myNotes} ${genericNotes}`;
  const fullText = `${group1Text} ${group2Text}`;

  return { title, group1Text, fullText };
}

function matchAndRankShows(shows, qNorm, tokens) {
  const searchResults = [];

  shows.forEach(show => {
    const { title, group1Text, fullText } = getSearchFields(show);
    const matchesAllTokens = tokens.length === 0 || tokens.every(token => fullText.includes(token));

    if (matchesAllTokens) {
      let priority = 6;
      if (qNorm) {
        if (title === qNorm) {
          priority = 1;
        } else if (title.includes(qNorm)) {
          priority = 2;
        } else if (group1Text.includes(qNorm)) {
          priority = 3;
        } else if (fullText.includes(qNorm)) {
          priority = 4;
        } else if (tokens.every(token => group1Text.includes(token))) {
          priority = 5;
        }
      }
      searchResults.push({ show, priority });
    }
  });

  searchResults.sort((a, b) => a.priority - b.priority);
  return searchResults.map(item => item.show);
}

function applyActiveFilters(shows) {
  return shows.filter(show => {
    const matchesMedia = state.currentFilter === 'all' ||
      normalizeStr(getVal(show, 'type', 'media_type', 'media')).includes(state.currentFilter);
    const showLang = (getVal(show, 'lang', 'language') || 'EN').toUpperCase();
    const matchesLang = state.selectedLangs.length === 0 || state.selectedLangs.includes(showLang);
    const matchesSubs = matchesSubtitleFilter(show._parsedSubtitles, state.selectedSubLangs);
    return matchesMedia && matchesLang && matchesSubs;
  });
}

function updateCatalog() {
  const query = document.getElementById('search-input').value.trim();
  const qNorm = normalizeStr(query);
  const tokens = qNorm.split(/\s+/).filter(t => t.length > 0);

  const textMatchedShows = matchAndRankShows(state.allShows, qNorm, tokens);

  renderFilterButtons(textMatchedShows, state, {
    onFilterChange: (newFilter) => {
      state.currentFilter = newFilter;
      updateCatalog();
    },
    onLangChange: (newLangs) => {
      state.selectedLangs = newLangs;
      updateCatalog();
    },
    onSubsChange: (newSubLangs) => {
      state.selectedSubLangs = newSubLangs;
      updateCatalog();
    },
    onToggleAll: () => {
      state.expandLevel = (state.expandLevel + 1) % 3;
      updateCatalog();
    }
  });

  const finalShows = applyActiveFilters(textMatchedShows);
  renderCatalog(finalShows, state, query);
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initRulesToggle();

  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      document.getElementById('loading').style.display = 'none';
      state.allShows = results.data;
      prepareShows(state.allShows);
      updateCatalog();
      renderCatalogStats(state.allShows);
    },
    error: function(err) {
      console.error(err);
      document.getElementById('loading').innerHTML = '<span class="error-text">Error loading catalog data.</span>';
    }
  });

  document.getElementById('search-input').addEventListener('input', () => {
    updateCatalog();
  });
});