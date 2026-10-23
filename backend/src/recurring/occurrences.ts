import { Frequency, RecurringTemplate } from '@prisma/client';

function lastDayOf(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function occurrencesInMonth(
  t: RecurringTemplate,
  year: number,
  month: number,
): Date[] {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  if (t.endDate && monthStart > t.endDate) return [];
  if (monthEnd < t.startDate) return [];

  const out: Date[] = [];

  if (t.frequency === Frequency.WEEKLY) {
    const d = new Date(t.startDate);
    while (d <= monthEnd && (!t.endDate || d <= t.endDate)) {
      if (d >= monthStart) out.push(new Date(d));
      d.setUTCDate(d.getUTCDate() + 7);
      if (out.length > 6) break;
    }
    return out;
  }

  const idx = year * 12 + (month - 1);
  const startIdx =
    t.startDate.getUTCFullYear() * 12 + t.startDate.getUTCMonth();
  if (
    t.frequency === Frequency.QUARTERLY &&
    (idx - startIdx) % 3 !== 0
  )
    return [];
  if (
    t.frequency === Frequency.YEARLY &&
    month - 1 !== t.startDate.getUTCMonth()
  )
    return [];

  const day = Math.min(
    t.dayOfMonth ?? t.startDate.getUTCDate(),
    lastDayOf(year, month),
  );
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date >= t.startDate && (!t.endDate || date <= t.endDate)) out.push(date);
  return out;
}
