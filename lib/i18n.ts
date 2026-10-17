import AsyncStorage from "@react-native-async-storage/async-storage";
// The default i18next instance is the documented way to use it.
/* eslint-disable import/no-named-as-default-member */
import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { create } from "zustand";

import { setAppLanguageCode } from "./appLanguage";
import { API_URL, authHeaders } from "./auth";
import en from "./locales/en.json";

/**
 * App language (i18next): the language of every screen's text. Chats don't
 * follow it; astrologers reply in the language the user writes in.
 *
 *   const t = useT();
 *   <Text>{t("home.title")}</Text>            // "{name}" placeholders: t(key, { name })
 *   translate("common.error")                 // outside components
 *
 * English is built into the app (lib/locales/en.json) and is the fallback.
 * Other languages come from the backend (GET /api/i18n/bundle/<code>), are
 * saved on the phone and refreshed in the background, so after the first
 * download they load instantly and work offline. Adding a language needs no
 * app change: the backend lists it and serves its file.
 *
 * The choice is saved on the phone and on the account
 * (PUT /api/user/language -> user_details.language). Every API call sends it
 * as X-App-Language (lib/auth) so server content comes in this language.
 */

export type AppLanguage = string;

export type LanguageOption = {
  code: string;
  label: string;
  english: string;
  glyph: string;
  available: boolean;
};

// Built-in list (the backend's list replaces it when reachable).
export const DEFAULT_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", english: "English", glyph: "Aa", available: true },
  { code: "hi", label: "हिंदी", english: "Hindi", glyph: "अ", available: true },
  { code: "mr", label: "मराठी", english: "Marathi", glyph: "म", available: false },
  { code: "bn", label: "বাংলা", english: "Bengali", glyph: "অ", available: false },
  { code: "te", label: "తెలుగు", english: "Telugu", glyph: "అ", available: false },
  { code: "kn", label: "ಕನ್ನಡ", english: "Kannada", glyph: "ಅ", available: false },
  { code: "ta", label: "தமிழ்", english: "Tamil", glyph: "அ", available: false },
];

// Kept for screens that import LANGUAGES.
export const LANGUAGES = DEFAULT_LANGUAGES;

const LANGUAGE_KEY = "app_language";
const BUNDLE_KEY = (code: string) => `i18n_bundle_${code}`;
const LIST_KEY = "i18n_languages";

type Bundle = { version: string; strings: Record<string, string> };

void i18next.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  // Keys are flat ("home.title"), placeholders single-brace ("{name}").
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false, prefix: "{", suffix: "}" },
  returnNull: false,
  initAsync: false,
});

// Older builds saved the label ("हिंदी") instead of the code.
const fromStored = (value: string | null): string | null => {
  if (!value) return null;
  return DEFAULT_LANGUAGES.find((l) => l.code === value || l.label === value)?.code ?? null;
};

// The phone's language on first launch (no native module needed).
const deviceLanguage = (): string => {
  try {
    const code = (Intl.DateTimeFormat().resolvedOptions().locale || "en").slice(0, 2).toLowerCase();
    return DEFAULT_LANGUAGES.some((l) => l.code === code) ? code : "en";
  } catch {
    return "en";
  }
};

async function readBundle(code: string): Promise<Bundle | null> {
  try {
    const raw = await AsyncStorage.getItem(BUNDLE_KEY(code));
    return raw ? (JSON.parse(raw) as Bundle) : null;
  } catch {
    return null;
  }
}

function installBundle(code: string, bundle: Bundle) {
  i18next.addResourceBundle(code, "translation", bundle.strings, true, true);
}

/**
 * Makes sure a language's text is loaded: the saved copy right away, then
 * the server's newer version if there is one. Returns false when it isn't
 * available yet (the server is still preparing it).
 */
async function loadBundle(code: string, { wait }: { wait: boolean }): Promise<boolean> {
  if (code === "en") return true;

  const saved = await readBundle(code);
  if (saved) installBundle(code, saved);

  const refresh = async (): Promise<boolean> => {
    try {
      const query = saved?.version ? `?version=${encodeURIComponent(saved.version)}` : "";
      const response = await fetch(`${API_URL}/api/i18n/bundle/${code}${query}`);
      const data = await response.json();
      if (!response.ok || data?.preparing) return Boolean(saved);
      if (data?.unchanged) return true;
      if (data?.strings) {
        const bundle: Bundle = { version: data.version, strings: data.strings };
        installBundle(code, bundle);
        await AsyncStorage.setItem(BUNDLE_KEY(code), JSON.stringify(bundle)).catch(() => {});
        // Re-render screens with the newer text.
        if (i18next.language === code) void i18next.changeLanguage(code);
        return true;
      }
      return Boolean(saved);
    } catch {
      return Boolean(saved);
    }
  };

  if (saved && !wait) {
    void refresh();
    return true;
  }
  return refresh();
}

type LanguageState = {
  language: string;
  // True once the user picked a language on this phone (or it was loaded).
  chosen: boolean;
  // True once the saved language (and its text) is in place at app start.
  ready: boolean;
  languages: LanguageOption[];
  /** Switches the app. Returns false if that language isn't ready yet. */
  setLanguage: (language: string, options?: { sync?: boolean }) => Promise<boolean>;
  refreshLanguages: () => Promise<void>;
};

// Screens and stores holding server content reload it in the new language.
const listeners = new Set<(code: string) => void>();

/** Runs fn after the user switches language (not at app start). */
export function onLanguageChange(fn: (code: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function apply(code: string) {
  await i18next.changeLanguage(code);
  setAppLanguageCode(code);
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: "en",
  chosen: false,
  ready: false,
  languages: DEFAULT_LANGUAGES,

  setLanguage: async (language, { sync = true } = {}) => {
    const ok = await loadBundle(language, { wait: true });
    if (!ok) return false;

    const changed = language !== useLanguageStore.getState().language;
    await apply(language);
    set({ language, chosen: true });
    if (changed) listeners.forEach((fn) => fn(language));
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Still applied for this session.
    }
    if (sync) void saveToAccount(language);
    return true;
  },

  // The backend's list: which languages exist and are ready.
  refreshLanguages: async () => {
    try {
      const response = await fetch(`${API_URL}/api/i18n/languages`);
      const data = await response.json();
      if (response.ok && Array.isArray(data?.languages)) {
        set({ languages: data.languages });
        await AsyncStorage.setItem(LIST_KEY, JSON.stringify(data.languages)).catch(() => {});
      }
    } catch {
      // Keep the saved or built-in list.
    }
  },
}));

/** Saves the language on the account (signed in only; failures ignored). */
async function saveToAccount(language: string): Promise<void> {
  try {
    const headers = await authHeaders();
    if (!headers?.Authorization) return;
    await fetch(`${API_URL}/api/user/language`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ language }),
    });
  } catch {
    // Not signed in or offline: the phone keeps the choice.
  }
}

/** App start: the language saved on this phone (or the phone's language). */
export async function loadSavedLanguage(): Promise<void> {
  try {
    const savedList = await AsyncStorage.getItem(LIST_KEY);
    if (savedList) useLanguageStore.setState({ languages: JSON.parse(savedList) });
  } catch {
    // Built-in list.
  }

  let code = "en";
  let chosen = false;
  try {
    const saved = fromStored(await AsyncStorage.getItem(LANGUAGE_KEY));
    if (saved) {
      code = saved;
      chosen = true;
    } else {
      code = deviceLanguage();
    }
  } catch {
    code = deviceLanguage();
  }

  // Saved copy now, newer text in the background (at most 2.5 s on a first
  // launch with nothing saved; English meanwhile).
  const ok =
    code === "en" ||
    (await Promise.race([
      loadBundle(code, { wait: false }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500)),
    ]));
  if (ok) await apply(code);
  useLanguageStore.setState({ language: ok ? code : "en", chosen, ready: true });

  void useLanguageStore.getState().refreshLanguages();
}

/**
 * After the account loads: use the account's language when this phone has
 * no choice of its own (e.g. a new phone); otherwise the phone's choice wins
 * and is saved to the account.
 */
export function syncLanguageWithAccount(accountLanguage?: string | null): void {
  const { chosen, language } = useLanguageStore.getState();
  const fromAccount = DEFAULT_LANGUAGES.some((l) => l.code === accountLanguage) ? accountLanguage! : null;

  if (!chosen && fromAccount && fromAccount !== language) {
    void useLanguageStore.getState().setLanguage(fromAccount, { sync: false });
  } else if (chosen && fromAccount !== language) {
    void saveToAccount(language);
  }
}

type Vars = Record<string, string | number>;

/** Translate outside components (alerts, helpers). */
export function translate(key: string, vars?: Vars): string {
  return i18next.t(key, vars) as string;
}

/** Translate in components; re-renders when the language changes. */
export function useT() {
  const { t } = useTranslation();
  return t as unknown as (key: string, vars?: Vars) => string;
}

/** The current language code ("en", "hi", …), e.g. for dates. */
export function useLanguage(): string {
  return useLanguageStore((s) => s.language);
}
