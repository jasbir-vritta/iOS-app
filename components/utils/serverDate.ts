/**
 * The backend stores times in UTC, and many responses have no timezone
 * marker ("2026-10-14T06:33:00"), which JS would read as local time.
 * Treat those as UTC so they show in the phone's own time.
 */
export function parseServerDate(value: string): Date {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());

  return new Date(hasZone ? value : `${value}Z`);
}
