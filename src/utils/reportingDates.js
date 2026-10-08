// SAST calendar windows. End dates are inclusive date comparisons in SQL.
export function sastDateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

export function calendarDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }
  return new Date(value);
}

export function periodDates(period = 'month', now = new Date()) {
  const today = sastDateKey(now);
  const date = new Date(`${today}T12:00:00Z`);
  if (period === 'all') return { from: null, to: today };
  if (period === 'week') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  if (period === 'month') date.setUTCDate(1);
  if (typeof period === 'number') date.setUTCDate(date.getUTCDate() - period + 1);
  return { from: date.toISOString().slice(0, 10), to: today };
}

export function inPeriod(value, period, now) {
  const { from, to } = periodDates(period, now);
  const day = sastDateKey(value);
  return (!from || day >= from) && day <= to;
}
