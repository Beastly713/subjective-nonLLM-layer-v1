import { DateTime } from 'luxon';

function inZone(instant: Date, timezone: string) {
  const value = DateTime.fromJSDate(instant, { zone: timezone });
  if (!value.isValid) throw new Error(`Invalid IANA timezone: ${timezone}`);
  return value;
}

export function firstCompletePeriodStart(activationAt: Date, timezone: string) {
  const local = inZone(activationAt, timezone);
  const monday = local.startOf('week').startOf('day');
  const start =
    local.toMillis() === monday.toMillis() ? monday : monday.plus({ weeks: 1 });
  return start.toUTC().toJSDate();
}

export function weeklyPeriodWindow(startAt: Date, timezone: string) {
  const start = inZone(startAt, timezone);
  const end = start.plus({ weeks: 1 });
  const openAt = end.toUTC();
  return {
    periodStartAt: start.toUTC().toJSDate(),
    periodEndAt: openAt.toJSDate(),
    openAt: openAt.toJSDate(),
    originalDueAt: openAt.plus({ hours: 24 }).toJSDate(),
  };
}
