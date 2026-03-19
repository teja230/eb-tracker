export const DAYS_PER_PD_MONTH = 30.44;
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FULL_MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function parseBulletinMonth(value: string): Date {
  const [month, year] = value.split(' ');
  const shortIndex = MONTH_LABELS.indexOf(month);
  const fullIndex = FULL_MONTH_LABELS.indexOf(month);
  const monthIndex = shortIndex !== -1 ? shortIndex : fullIndex;
  return new Date(Number(year), monthIndex, 1);
}

export function monthsBetweenDates(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + (to.getDate() - from.getDate()) / DAYS_PER_PD_MONTH;
}

export function monthsBetween(from: string, to: string): number {
  return monthsBetweenDates(parseDateStr(from), parseDateStr(to));
}

export function addApproxMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + Math.round(months * DAYS_PER_PD_MONTH));
  return d;
}

export function fmtDate(d: Date): string {
  return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function fmtDateStr(s: string): string {
  return fmtDate(parseDateStr(s));
}

export function fmtCompactMonthYear(s: string): string {
  const d = parseDateStr(s);
  return `${MONTH_LABELS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

export function fmtBulletinMonthLabel(value: string): string {
  const [month, year] = value.split(' ');
  return `${month} '${year.slice(2)}`;
}

export function fmtYear(d: Date): string {
  return d.getFullYear().toString();
}

export function fmtDuration(months: number): string {
  if (months < 12) return `${months} mo`;
  const yrs = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${yrs} yr${yrs !== 1 ? 's' : ''} ${rem} mo` : `${yrs} yr${yrs !== 1 ? 's' : ''}`;
}

export function sumRecordValues(values: Record<number, number>): number {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

export type MovementInfo = {
  label: string;
  type: 'advancement' | 'retrogression' | 'stable';
  days: number;
};

export function movementLabel(prevStr: string, currStr: string): MovementInfo {
  const prev = parseDateStr(prevStr);
  const curr = parseDateStr(currStr);
  const days = Math.round((curr.getTime() - prev.getTime()) / 86400000);
  const months = Math.round(days / DAYS_PER_PD_MONTH);
  const type = days > 5 ? 'advancement' : days < -5 ? 'retrogression' : 'stable';
  const label = type === 'stable' ? '—' : `${days > 0 ? '+' : ''}${months}mo (${days > 0 ? '+' : ''}${days}d)`;
  return { label, type, days };
}
