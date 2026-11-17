import i18n from '../i18n';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const LOCALES = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-MA' };

function currentLocale() {
  return LOCALES[i18n.resolvedLanguage] || LOCALES.en;
}

export function formatDate(value) {
  if (!value) return '—';

  // Date-only values (birth dates, YYYY-MM-DD) must be interpreted in the
  // local timezone. `new Date('1990-05-05')` is parsed as UTC and would show
  // the previous day in timezones west of UTC.
  let date;
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(currentLocale(), {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(currentLocale(), {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' });
}

export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
