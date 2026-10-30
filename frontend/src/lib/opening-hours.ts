// Sunday is 0, matching Date.getDay() in the visitor's local timezone.
export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const codes = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const english = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const normalize = (text: string) => text.replace(/[أإآ]/g, 'ا').trim().toLowerCase();
const dayIndex = (key: string) => WEEKDAYS.findIndex((day, i) => [day, codes[i], english[i]].some(alias => normalize(alias) === normalize(key)));

function formatTime(text: string): string {
  if (/^(24\/7|24 hours)$/i.test(text.trim())) return 'مفتوح 24 ساعة';
  if (/^(closed|off|مغلق)$/i.test(text.trim())) return 'مغلق';
  return text.replace(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/g, (_, h1, m1, h2, m2) => {
    const time = (h: string, m: string) => `${Number(h) % 12 || 12}${m === '00' ? '' : `:${m}`} ${Number(h) >= 12 ? 'مساءً' : 'صباحًا'}`;
    return `من ${time(h1, m1)} إلى ${time(h2, m2)}${Number(h2) * 60 + Number(m2) < Number(h1) * 60 + Number(m1) ? ' (اليوم التالي)' : ''}`;
  });
}

export function openingHoursForDay(hours: unknown, day: number): string {
  const missing = 'دوام اليوم غير محدد';
  if (!hours || day < 0 || day > 6) return missing;
  let raw: unknown = hours;
  if (typeof hours === 'object' && !Array.isArray(hours)) {
    const entries = Object.entries(hours);
    if (entries.some(([key]) => dayIndex(key) !== -1)) {
      const value = entries.find(([key]) => dayIndex(key) === day)?.[1];
      return typeof value === 'string' && value.trim() ? formatTime(value.trim()) : missing;
    }
    const data = hours as Record<string, unknown>;
    raw = data.hours || data.regular;
  }
  if (typeof raw !== 'string' || !raw.trim()) return missing;
  // Support existing seeded schedules such as "Sa-Th 09:00-19:00".
  const rule = raw.trim().match(/^(Su|Mo|Tu|We|Th|Fr|Sa)(?:-(Su|Mo|Tu|We|Th|Fr|Sa))?\s+(.+)$/);
  if (rule) {
    const start = codes.indexOf(rule[1]), end = codes.indexOf(rule[2] || rule[1]);
    const applies = (day - start + 7) % 7 <= (end - start + 7) % 7;
    return applies && !rule[3].includes(';') ? formatTime(rule[3]) : missing;
  }
  return /^(24\/7|24 hours|closed|off|مغلق|\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2})$/i.test(raw.trim()) ? formatTime(raw.trim()) : missing;
}

export function subscribeToLocalDay(changed: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const refresh = () => {
    clearTimeout(timer);
    changed();
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 100);
  };
  refresh();
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  return () => { clearTimeout(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
}
