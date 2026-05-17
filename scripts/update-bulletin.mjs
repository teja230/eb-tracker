import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DATA_FILE = fileURLToPath(new URL('../client/src/data/trackerData.ts', import.meta.url));
const DOS_DATE = '(?:C|U|\\d{2}[A-Z]{3}\\d{2})';
const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const MONTHS = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function addMonths(date, offset) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

function bulletinUrlFor(monthDate) {
  const year = monthDate.getUTCFullYear();
  const month = MONTH_NAMES[monthDate.getUTCMonth()];
  return `https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/${year}/visa-bulletin-for-${month}-${year}.html`;
}

function candidateBulletinUrls(referenceDate = new Date()) {
  const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
  const seen = new Set();

  return Array.from({ length: 8 }, (_, index) => addMonths(start, 2 - index))
    .map(bulletinUrlFor)
    .filter(url => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/\u00a0/g, ' ');
}

function htmlToText(html) {
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBulletinMonth(text) {
  const match = text.match(/Visa Bulletin For ([A-Za-z]+) (\d{4})/i);
  if (!match) throw new Error('Could not find bulletin month in page title.');
  const month = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  return `${month} ${match[2]}`;
}

function parsePublishedDate(text) {
  const match = text.match(/CA\/VO:\s*([A-Za-z]+ \d{1,2}, \d{4})/i);
  return match?.[1] ?? new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function tokenToIso(token, bulletinMonth) {
  if (token === 'U') throw new Error('Unavailable category cannot be encoded as a cutoff date.');
  if (token === 'C') {
    const [month, year] = bulletinMonth.split(' ');
    const monthIndex = MONTHS[month.slice(0, 3).toUpperCase()];
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  }

  const match = token.match(/^(\d{2})([A-Z]{3})(\d{2})$/);
  if (!match) throw new Error(`Unsupported DOS date token: ${token}`);
  const [, day, mon, yy] = match;
  const year = Number(yy) >= 70 ? `19${yy}` : `20${yy}`;
  const month = MONTHS[mon];
  if (month === undefined) throw new Error(`Unsupported month token: ${mon}`);
  return `${year}-${String(month + 1).padStart(2, '0')}-${day}`;
}

function extractEmploymentSection(text, startLabel, endLabel) {
  const start = text.indexOf(startLabel);
  if (start < 0) throw new Error(`Could not find section: ${startLabel}`);
  const end = endLabel ? text.indexOf(endLabel, start + startLabel.length) : -1;
  return text.slice(start, end > start ? end : undefined);
}

function extractIndiaDate(section, rowLabel, bulletinMonth) {
  const rowRegex = new RegExp(`${rowLabel}\\s+(${DOS_DATE})\\s+(${DOS_DATE})\\s+(${DOS_DATE})\\s+`, 'i');
  const match = section.match(rowRegex);
  if (!match) throw new Error(`Could not parse row "${rowLabel}" in employment table.`);
  return tokenToIso(match[3].toUpperCase(), bulletinMonth);
}

function parseBulletin(html) {
  const text = htmlToText(html);
  const month = parseBulletinMonth(text);
  const published = parsePublishedDate(text);
  const finalAction = extractEmploymentSection(
    text,
    'A. FINAL ACTION DATES FOR EMPLOYMENT-BASED PREFERENCE CASES',
    'B. DATES FOR FILING OF EMPLOYMENT-BASED'
  );
  const filing = extractEmploymentSection(
    text,
    'B. DATES FOR FILING OF EMPLOYMENT-BASED VISA APPLICATIONS',
    '6. Section 203'
  );

  return {
    month,
    published,
    eb1: {
      fad: extractIndiaDate(finalAction, '1st', month),
      dof: extractIndiaDate(filing, '1st', month),
    },
    eb2: {
      fad: extractIndiaDate(finalAction, '2nd', month),
      dof: extractIndiaDate(filing, '2nd', month),
    },
    eb3: {
      fad: extractIndiaDate(finalAction, '3rd', month),
      dof: extractIndiaDate(filing, '3rd', month),
    },
  };
}

function replacementCurrentBulletin(parsed) {
  return `export const CURRENT_BULLETIN = {
  month: '${parsed.month}',
  eb1: { fad: '${parsed.eb1.fad}', dof: '${parsed.eb1.dof}' },
  eb2: { fad: '${parsed.eb2.fad}', dof: '${parsed.eb2.dof}' },
  eb3: { fad: '${parsed.eb3.fad}', dof: '${parsed.eb3.dof}' },
};`;
}

function historyRow(parsed) {
  return `  { month: '${parsed.month}', eb1_fad: '${parsed.eb1.fad}', eb1_dof: '${parsed.eb1.dof}', eb2_fad: '${parsed.eb2.fad}', eb2_dof: '${parsed.eb2.dof}', eb3_fad: '${parsed.eb3.fad}', eb3_dof: '${parsed.eb3.dof}' },`;
}

async function updateDataFile(parsed) {
  let source = await readFile(DATA_FILE, 'utf-8');
  const original = source;
  const hasHistoryRow = source.includes(`{ month: '${parsed.month}', eb1_fad`);
  source = source.replace(/export const CURRENT_BULLETIN = \{[\s\S]*?\n\};/, replacementCurrentBulletin(parsed));
  source = source.replace(/currentBulletinPublished: '.*?'/, `currentBulletinPublished: '${parsed.published}'`);

  if (!hasHistoryRow) {
    source = source.replace(
      /export const HISTORICAL_BULLETINS: HistoricalBulletinRow\[] = \[\n/,
      `export const HISTORICAL_BULLETINS: HistoricalBulletinRow[] = [\n${historyRow(parsed)}\n`
    );
  }

  if (source !== original) {
    source = source.replace(
      /lastVerified: '.*?'/,
      `lastVerified: '${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}'`
    );
  }

  if (source === original) {
    console.log('Data file already reflects the latest discovered bulletin; no changes written.');
    return false;
  }

  await writeFile(DATA_FILE, source, 'utf-8');
  return true;
}

async function fetchAndParse(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch bulletin: ${response.status} ${response.statusText}`);
  const html = await response.text();
  return parseBulletin(html);
}

async function fetchLatestBulletin() {
  const errors = [];

  for (const url of candidateBulletinUrls()) {
    try {
      const parsed = await fetchAndParse(url);
      return { url, parsed };
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  throw new Error(`Could not discover the latest bulletin. Tried:\n${errors.join('\n')}`);
}

async function main() {
  const url = argValue('--url');
  const result = url
    ? { url, parsed: await fetchAndParse(url) }
    : await fetchLatestBulletin();

  console.log(`Source: ${result.url}`);
  console.log(JSON.stringify(result.parsed, null, 2));

  if (hasFlag('--write')) {
    const changed = await updateDataFile(result.parsed);
    if (changed) console.log(`Updated ${DATA_FILE}`);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
