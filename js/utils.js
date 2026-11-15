export function normalizeStr(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'");
}

export function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
  }
  return fallbackCopyText(text);
}

function fallbackCopyText(text) {
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.className = 'clipboard-fallback-textarea';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    try {
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) {
        resolve();
      } else {
        reject(new Error('execCommand copy failed'));
      }
    } catch (err) {
      document.body.removeChild(textarea);
      reject(err);
    }
  });
}

export function getVal(item, ...keys) {
  if (!item) return '';
  for (let key of keys) {
    if (item[key] !== undefined && item[key] !== null) {
      let v = String(item[key]).trim();
      if (v !== '' && v.toLowerCase() !== 'nan') return v;
    }
    const targetNorm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let actualKey in item) {
      const actualNorm = actualKey.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (actualNorm === targetNorm) {
        if (item[actualKey] !== undefined && item[actualKey] !== null) {
          let v = String(item[actualKey]).trim();
          if (v !== '' && v.toLowerCase() !== 'nan') return v;
        }
      }
    }
  }
  return '';
}

export function formatDateFull(dateStr) {
  if (!dateStr) return '';
  const monthNamesFull = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return dateStr.replace(/(\d{4})-(0[0-9]|1[0-2])-(00|[0-2][0-9]|3[01])/g, (match, year, monthStr, dayStr) => {
    if (monthStr === '00') return year;

    const monthIdx = parseInt(monthStr, 10) - 1;
    const monthName = monthNamesFull[monthIdx];

    if (dayStr === '00') {
      return `${monthName} ${year}`;
    }
    const dayNum = parseInt(dayStr, 10);
    return `${monthName} ${dayNum}, ${year}`;
  });
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'June',
    'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  return dateStr.replace(/(\d{4})-(0[0-9]|1[0-2])-(00|[0-2][0-9]|3[01])/g, (match, year, monthStr, dayStr) => {
    if (monthStr === '00') return year;

    const monthIdx = parseInt(monthStr, 10) - 1;
    const monthName = monthNames[monthIdx];

    if (dayStr === '00') {
      return `${monthName} ${year}`;
    }
    const dayNum = parseInt(dayStr, 10);
    return `${monthName} ${dayNum}, ${year}`;
  });
}

export function parseSizeToBytes(sizeStr) {
  if (!sizeStr || typeof sizeStr !== 'string') return 0;
  const cleanStr = sizeStr.trim().toUpperCase();
  const match = cleanStr.match(/([\d\.,]+)\s*(TB|GB|MB|KB|BYTES|B|G|M|K)?/);
  if (!match) return 0;

  const num = parseFloat(match[1].replace(/,/g, ''));
  if (isNaN(num)) return 0;

  const unit = match[2] || 'MB';
  if (unit.startsWith('T')) return num * 1024 * 1024 * 1024 * 1024;
  if (unit.startsWith('G')) return num * 1024 * 1024 * 1024;
  if (unit.startsWith('M')) return num * 1024 * 1024;
  if (unit.startsWith('K')) return num * 1024;
  return num;
}

export function parseTimeToSeconds(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const str = timeStr.trim().toLowerCase();

  if (str.includes(':')) {
    const parts = str.split(':').map(p => parseFloat(p) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }

  const hours = str.match(/(\d+)\s*h/);
  const mins = str.match(/(\d+)\s*m(?:in)?/);
  const secs = str.match(/(\d+)\s*s(?:ec)?/);

  if (hours || mins || secs) {
    const h = hours ? parseInt(hours[1], 10) : 0;
    const m = mins ? parseInt(mins[1], 10) : 0;
    const s = secs ? parseInt(secs[1], 10) : 0;
    return h * 3600 + m * 60 + s;
  }

  const standalone = parseFloat(str);
  if (!isNaN(standalone)) return standalone * 60;

  return 0;
}

export function formatPlaytime(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0 hours';

  const YEAR = 365 * 86400;
  const MONTH = 30 * 86400;
  const DAY = 86400;
  const HOUR = 3600;

  let rem = totalSeconds;
  const years = Math.floor(rem / YEAR);
  rem %= YEAR;
  const months = Math.floor(rem / MONTH);
  rem %= MONTH;
  const days = Math.floor(rem / DAY);
  rem %= DAY;
  const hours = Math.floor(rem / HOUR);

  const parts = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0 || parts.length === 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);

  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024 * 1024) return `${(bytes / (1024 ** 4)).toFixed(2)} TB`;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 ** 2)).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

export function getRandomFunnyQuote(totalBytes, totalSeconds) {
  const totalMB = totalBytes / (1024 * 1024);
  const floppyCount = Math.round(totalMB / 1.44).toLocaleString();

  const quotes = [
    `and ${floppyCount} floppy disks to store it all!`
  ];

  const randomIndex = Math.floor(Math.random() * quotes.length);
  return quotes[randomIndex];
}

export function renderCatalogStats(shows) {
  let totalSeconds = 0;
  let totalBytes = 0;

  shows.forEach(show => {
    const timeVal = getVal(show, 'time', 'runtime', 'duration');
    const sizeVal = getVal(show, 'folder_size', 'folder size', 'size', 'filesize', 'file_size');

    totalSeconds += parseTimeToSeconds(timeVal);
    totalBytes += parseSizeToBytes(sizeVal);
  });

  const playtimeText = formatPlaytime(totalSeconds);
  const randomQuote = getRandomFunnyQuote(totalBytes, totalSeconds);

  const statsEl = document.getElementById('catalog-stats');
  if (statsEl) {
    statsEl.innerHTML = `You'll need over ${playtimeText} for a non-stop binge ${randomQuote}`;
  }
}

export function makeDiacriticRegex(token) {
  const normToken = normalizeStr(token);
  let pattern = '';
  for (let ch of normToken) {
    switch (ch) {
      case 'a': pattern += '[aAáàảãạăắằẳẵặâấầẩẫậäåÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÄÅ]'; break;
      case 'e': pattern += '[eEéèẻẽẹêếềểễệëÉÈẺẼẸÊẾỀỂỄỆË]'; break;
      case 'i': pattern += '[iIíìỉĩịîïÍÌỈĨỊÎÏ]'; break;
      case 'o': pattern += '[oOóòỏõọôốồổỗộơớờởỡợöÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÖ]'; break;
      case 'u': pattern += '[uUúùủũụưứừửữựüÚÙỦŨỤƯỨỪỬỮỰÜ]'; break;
      case 'c': pattern += '[cCçÇ]'; break;
      case 'n': pattern += '[nNñÑ]'; break;
      case 's': pattern += '[sSß]'; break;
      case 'z': pattern += '[zZžŽ]'; break;
      case 'y': pattern += '[yYýỳỷỹỵÿÝỲỶỸỴŸ]'; break;
      default:
        pattern += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        break;
    }
  }
  return pattern;
}

export function highlightText(text, query) {
  if (!text || !query) return text;

  const rawTokens = query.trim().split(/\s+/).filter(t => t.length > 0);
  if (rawTokens.length === 0) return text;

  const patterns = rawTokens.map(token => makeDiacriticRegex(token));
  patterns.sort((a, b) => b.length - a.length);

  try {
    const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  } catch (e) {
    return text;
  }
}