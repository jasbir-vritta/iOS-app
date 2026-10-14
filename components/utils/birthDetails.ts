import type { Profile } from "../stores/profilesStore";

/**
 * Astrology (My Vritta, Daily Guidance) needs the birth date, time and a
 * birth place picked from the search list (which fills lat/lon/timezone).
 * Older or partly filled profiles can be missing these.
 */
export function hasBirthDetails(profile?: Partial<Profile> | null): boolean {
  const filled = (value?: string | null) => Boolean(String(value ?? "").trim());

  return Boolean(
    profile &&
      filled(profile.dateOfBirth) &&
      filled(profile.timeOfBirth) &&
      filled(profile.lat) &&
      filled(profile.lon) &&
      filled(profile.tzone),
  );
}
