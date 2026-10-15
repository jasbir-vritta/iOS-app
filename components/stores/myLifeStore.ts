import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { API_URL, authHeaders } from "../../lib/auth";
import { APP_NAME } from "../constants/app";

// today/past/future: old endpoints. daily..yearly: My Life horoscope
// ("daily" also feeds Home and Profile).
export type MyLifeCacheType =
  | "today"
  | "past"
  | "future"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export interface MyLifeCache<T = any> {
  profileId: string;
  cachedAt: number;
  data: T;
}

export type MyLifeStoreData = Partial<Record<MyLifeCacheType, any | null>>;

type CacheTimestamps = Partial<Record<MyLifeCacheType, number>>;

interface MyLifeStoreState {
  // Keep these fields as raw API data so existing selectors keep working.
  profiles: Record<string, MyLifeStoreData>;
  cacheTimestamps: Record<string, CacheTimestamps>;

  setMyLifeData: (
    profileId: string,
    type: MyLifeCacheType,
    data: any,
    cachedAt?: number
  ) => void;

  getMyLifeData: (
    profileId: string,
    type: MyLifeCacheType
  ) => any | null;

  getMyLifeCacheTimestamp: (
    profileId: string,
    type: MyLifeCacheType
  ) => number | null;

  clearMyLifeStore: (profileId: string) => void;
}

const EMPTY_PROFILE: MyLifeStoreData = {};

export const useMyLifeStore = create<MyLifeStoreState>((set, get) => ({
  profiles: {},
  cacheTimestamps: {},

  setMyLifeData: (profileId, type, data, cachedAt = Date.now()) => {
    if (!profileId) return;

    set((state) => {
      const profile = state.profiles[profileId] || EMPTY_PROFILE;
      const timestamps = state.cacheTimestamps[profileId] || {};

      return {
        profiles: {
          ...state.profiles,
          [profileId]: {
            ...profile,
            [type]: data,
          },
        },
        cacheTimestamps: {
          ...state.cacheTimestamps,
          [profileId]: {
            ...timestamps,
            [type]: data === null ? undefined : cachedAt,
          },
        },
      };
    });
  },

  getMyLifeData: (profileId, type) => {
    if (!profileId) return null;
    return get().profiles[profileId]?.[type] ?? null;
  },

  getMyLifeCacheTimestamp: (profileId, type) => {
    if (!profileId) return null;
    return get().cacheTimestamps[profileId]?.[type] ?? null;
  },

  clearMyLifeStore: (profileId) => {
    if (!profileId) return;

    set((state) => {
      const profiles = { ...state.profiles };
      const cacheTimestamps = { ...state.cacheTimestamps };
      delete profiles[profileId];
      delete cacheTimestamps[profileId];

      return { profiles, cacheTimestamps };
    });
  },
}));

// v2: requests now send profile_id. v1 could hold another profile's data
// (the backend used the server-side active profile), so it is discarded.
const CACHE_VERSION = "v2";

// Old endpoints: kept for a fixed time.
const CACHE_MAX_AGE: Partial<Record<MyLifeCacheType, number>> = {
  today: 60 * 60 * 1000, // refresh every hour
  past: 365 * 24 * 60 * 60 * 1000, // yearly
  future: 7 * 24 * 60 * 60 * 1000, // weekly
};

const ALL_TYPES: MyLifeCacheType[] = [
  "today", "past", "future", "daily", "weekly", "monthly", "yearly",
];

// Horoscopes are kept until their period ends in IST (the backend's day,
// week, month and year): midnight, Sunday 00:00, the 1st, 1 January.
const IST_OFFSET = 330 * 60 * 1000;

function periodEnd(type: MyLifeCacheType, cachedAt: number): number | null {
  // UTC fields of this date read as the IST wall clock.
  const ist = new Date(cachedAt + IST_OFFSET);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();

  switch (type) {
    case "daily":
      return Date.UTC(y, m, d + 1) - IST_OFFSET;
    case "weekly": // weeks run Sunday to Saturday
      return Date.UTC(y, m, d + 7 - ist.getUTCDay()) - IST_OFFSET;
    case "monthly":
      return Date.UTC(y, m + 1, 1) - IST_OFFSET;
    case "yearly":
      return Date.UTC(y + 1, 0, 1) - IST_OFFSET;
    default:
      return null;
  }
}

function isFresh(type: MyLifeCacheType, cachedAt: number | null): boolean {
  if (cachedAt === null || !Number.isFinite(cachedAt) || cachedAt > Date.now()) {
    return false;
  }

  const end = periodEnd(type, cachedAt);
  if (end !== null) return Date.now() < end;

  return Date.now() - cachedAt < (CACHE_MAX_AGE[type] ?? 0);
}

const getCacheKey = (type: MyLifeCacheType, profileId: string): string =>
  `mylife_${CACHE_VERSION}_${type}_${profileId}`;

const isCacheValid = <T,>(
  cache: MyLifeCache<T>,
  type: MyLifeCacheType,
  profileId: string
): boolean => {
  if (cache.profileId !== profileId || typeof cache.cachedAt !== "number") {
    return false;
  }

  return isFresh(type, cache.cachedAt);
};

async function removeExpiredCache(
  type: MyLifeCacheType,
  profileId: string
): Promise<void> {
  useMyLifeStore.getState().setMyLifeData(profileId, type, null);

  try {
    await AsyncStorage.removeItem(getCacheKey(type, profileId));
  } catch (error) {
    console.warn(`Failed to remove expired My Life ${type} cache:`, error);
  }
}

export async function saveMyLifeCache<T>(
  type: MyLifeCacheType,
  profileId: string,
  data: T
): Promise<void> {
  if (!profileId) return;

  const cache: MyLifeCache<T> = {
    profileId,
    cachedAt: Date.now(),
    data,
  };

  useMyLifeStore
    .getState()
    .setMyLifeData(profileId, type, data, cache.cachedAt);

  try {
    await AsyncStorage.setItem(
      getCacheKey(type, profileId),
      JSON.stringify(cache)
    );
  } catch (error) {
    console.warn(`Failed to save My Life ${type} cache:`, error);
  }
}

export async function getMyLifeCache<T>(
  type: MyLifeCacheType,
  profileId: string
): Promise<T | null> {
  if (!profileId) return null;

  // 1. Check in-memory data and its timestamp.
  const memoryData = useMyLifeStore
    .getState()
    .getMyLifeData(profileId, type);

  if (memoryData !== null) {
    const cachedAt = useMyLifeStore
      .getState()
      .getMyLifeCacheTimestamp(profileId, type);

    if (isFresh(type, cachedAt)) return memoryData as T;

    await removeExpiredCache(type, profileId);
    return null;
  }

  // 2. If there is no memory entry, check AsyncStorage.
  try {
    const key = getCacheKey(type, profileId);
    const raw = await AsyncStorage.getItem(key);

    if (!raw) return null;

    const cache: MyLifeCache<T> = JSON.parse(raw);

    if (!isCacheValid(cache, type, profileId)) {
      await removeExpiredCache(type, profileId);
      return null;
    }

    useMyLifeStore
      .getState()
      .setMyLifeData(profileId, type, cache.data, cache.cachedAt);

    return cache.data;
  } catch (error) {
    console.warn(`Failed to read My Life ${type} cache:`, error);
    return null;
  }
}

export async function clearMyLifeCache(
  type: MyLifeCacheType,
  profileId: string
): Promise<void> {
  if (!profileId) return;

  useMyLifeStore.getState().setMyLifeData(profileId, type, null);

  try {
    await AsyncStorage.removeItem(getCacheKey(type, profileId));
  } catch (error) {
    console.warn(`Failed to clear My Life ${type} cache:`, error);
  }
}

export async function clearAllMyLifeCache(
  profileId: string
): Promise<void> {
  if (!profileId) return;

  useMyLifeStore.getState().clearMyLifeStore(profileId);

  try {
    const keys = ALL_TYPES.map(
      (type) => getCacheKey(type, profileId)
    );
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    console.warn("Failed to clear all My Life caches:", error);
  }
}

export type MyLifePeriod = "daily" | "weekly" | "monthly" | "yearly";

// Requests in progress, so screens asking at the same time share one call.
const pendingHoroscopes = new Map<string, Promise<any>>();

/**
 * The My Life horoscope for a period (cache first, then the API).
 * My Life, Home and Profile all read the same "daily" result, so they
 * always show the same reading.
 */
export function loadMyLifeHoroscope(
  period: MyLifePeriod,
  profileId: string
): Promise<any> {
  const key = `${profileId}:${period}`;
  const pending = pendingHoroscopes.get(key);
  if (pending) return pending;

  const request = (async () => {
    const cached = await getMyLifeCache(period, profileId);
    if (cached) return cached;

    const headers = await authHeaders();
    const res = await fetch(
      `${API_URL}/astrology/mylife/horoscope?period=${period}&profile_id=${encodeURIComponent(profileId)}`,
      { method: "POST", headers }
    );

    const raw = await res.text();
    let json: any = null;

    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }

    if (!res.ok || !json?.horoscope) {
      throw new Error(
        json?.detail || `My ${APP_NAME} failed to load (status ${res.status})`
      );
    }

    await saveMyLifeCache(period, profileId, json.horoscope);
    return json.horoscope;
  })();

  pendingHoroscopes.set(key, request);
  request.finally(() => pendingHoroscopes.delete(key)).catch(() => {});
  return request;
}

export async function hasValidMyLifeCache(
  type: MyLifeCacheType,
  profileId: string
): Promise<boolean> {
  return (await getMyLifeCache(type, profileId)) !== null;
}

export async function getMyLifeCacheAge(
  type: MyLifeCacheType,
  profileId: string
): Promise<number | null> {
  if (!profileId) return null;

  const memoryData = useMyLifeStore
    .getState()
    .getMyLifeData(profileId, type);

  if (memoryData !== null) {
    const cachedAt = useMyLifeStore
      .getState()
      .getMyLifeCacheTimestamp(profileId, type);

    if (cachedAt === null || !Number.isFinite(cachedAt) || cachedAt > Date.now()) {
      return null;
    }

    return Date.now() - cachedAt;
  }

  try {
    const raw = await AsyncStorage.getItem(getCacheKey(type, profileId));
    if (!raw) return null;

    const cache: MyLifeCache = JSON.parse(raw);

    if (
      cache.profileId !== profileId ||
      typeof cache.cachedAt !== "number" ||
      !Number.isFinite(cache.cachedAt) ||
      cache.cachedAt > Date.now()
    ) {
      return null;
    }

    return Date.now() - cache.cachedAt;
  } catch (error) {
    console.warn("Failed to get My Life cache age:", error);
    return null;
  }
}
