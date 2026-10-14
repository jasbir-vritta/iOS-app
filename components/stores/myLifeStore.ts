import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export type MyLifeCacheType = "today" | "past" | "future";

export interface MyLifeCache<T = any> {
  profileId: string;
  cachedAt: number;
  data: T;
}

export interface MyLifeStoreData {
  today: any | null;
  past: any | null;
  future: any | null;
}

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

const EMPTY_PROFILE: MyLifeStoreData = {
  today: null,
  past: null,
  future: null,
};

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

const CACHE_MAX_AGE: Record<MyLifeCacheType, number> = {
  today: 60 * 60 * 1000, // refresh every hour
  past: 365 * 24 * 60 * 60 * 1000, // yearly
  future: 7 * 24 * 60 * 60 * 1000, // weekly
};

const getCacheKey = (type: MyLifeCacheType, profileId: string): string =>
  `mylife_${CACHE_VERSION}_${type}_${profileId}`;

const isCacheValid = <T,>(
  cache: MyLifeCache<T>,
  type: MyLifeCacheType,
  profileId: string
): boolean => {
  if (
    cache.profileId !== profileId ||
    typeof cache.cachedAt !== "number" ||
    !Number.isFinite(cache.cachedAt) ||
    cache.cachedAt > Date.now()
  ) {
    return false;
  }

  return Date.now() - cache.cachedAt < CACHE_MAX_AGE[type];
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

    const valid =
      cachedAt !== null &&
      Number.isFinite(cachedAt) &&
      cachedAt <= Date.now() &&
      Date.now() - cachedAt < CACHE_MAX_AGE[type];

    if (valid) return memoryData as T;

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
    const keys = (["today", "past", "future"] as MyLifeCacheType[]).map(
      (type) => getCacheKey(type, profileId)
    );
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    console.warn("Failed to clear all My Life caches:", error);
  }
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
