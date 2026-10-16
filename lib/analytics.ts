import {
  getAnalytics,
  logEvent,
  logScreenView,
  setUserId,
  setUserProperties,
} from "@react-native-firebase/analytics";
import Constants from "expo-constants";
import { useFocusEffect, usePathname } from "expo-router";
import { Mixpanel, type MixpanelProperties } from "mixpanel-react-native";
import { useCallback, useEffect } from "react";
import { AppState, NativeModules, Platform } from "react-native";

/**
 * Product analytics: every event goes to Mixpanel and to Firebase Analytics
 * (Google Analytics for Firebase, set up from GoogleService-Info.plist /
 * google-services.json by the @react-native-firebase build plugins).
 *
 * Mixpanel:
 *
 * JavaScript mode (useNative: false): no native code, so it works in the
 * current builds and ships by OTA update. Events queue on the device
 * (AsyncStorage) and are sent in batches.
 *
 * Identity: identify() with our backend user_id after login and on each
 * launch while signed in; reset() on logout so the next account on the
 * phone starts fresh.
 */

const MIXPANEL_TOKEN = "e615cccc8c14da6b87f1977c924c0972";

const mixpanel = new Mixpanel(MIXPANEL_TOKEN, true, false);

/*
 * Firebase Analytics needs its native module (new builds). Every call is
 * guarded so an older build without it just skips Firebase.
 */
function firebase(run: (analytics: ReturnType<typeof getAnalytics>) => Promise<unknown>): void {
  try {
    run(getAnalytics()).catch(() => {});
  } catch {
    // Native module not in this build.
  }
}

// Firebase params take strings and numbers only (names up to 40 characters).
function firebaseParams(properties?: MixpanelProperties): Record<string, string | number> | undefined {
  if (!properties) return undefined;
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(properties)) {
    const name = key.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 40);
    if (typeof value === "number" && Number.isFinite(value)) params[name] = value;
    else if (typeof value === "boolean") params[name] = value ? 1 : 0;
    else if (value !== null && value !== undefined) params[name] = String(value).slice(0, 100);
  }
  return params;
}

let ready: Promise<void> | null = null;

export function initAnalytics(): Promise<void> {
  ready ??= mixpanel
    .init(false, {
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version ?? "unknown",
    })
    .catch((error) => console.warn("Mixpanel init failed:", error));

  return ready;
}

/** Sends an event (after init). Never throws. */
export function track(event: string, properties?: MixpanelProperties): void {
  initAnalytics().then(() => mixpanel.track(event, properties));
  firebase((analytics) => logEvent(analytics, event, firebaseParams(properties)));
}

/** Links events to this user (backend user_id, never phone or email). */
export async function identifyUser(
  userId: string,
  profile?: { name?: string; phone?: string; email?: string }
): Promise<void> {
  if (!userId) return;

  firebase((analytics) => setUserId(analytics, userId));

  await initAnalytics();
  await mixpanel.identify(userId);

  const people: MixpanelProperties = {};
  if (profile?.name) people.$name = profile.name;
  if (profile?.phone) people.$phone = profile.phone;
  if (profile?.email) people.$email = profile.email;

  if (Object.keys(people).length) {
    mixpanel.getPeople().set(people);
  }
}

/**
 * Saves details on the user's profile. `once` keeps the first value
 * (e.g. how they signed up) and never overwrites it.
 */
export async function setUserProfile(
  properties: Record<string, string | number | boolean>,
  { once = false }: { once?: boolean } = {}
): Promise<void> {
  await initAnalytics();
  const people = mixpanel.getPeople();
  if (once) people.setOnce(properties);
  else people.set(properties);

  const fb: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) fb[key.slice(0, 24)] = String(value).slice(0, 36);
  firebase((analytics) => setUserProperties(analytics, fb));
}

/** On logout: forget the user so the next account isn't merged with it. */
export function resetAnalytics(): void {
  initAnalytics().then(() => mixpanel.reset());
  firebase((analytics) => setUserId(analytics, null));
}

/**
 * `visited_<name>` each time the screen comes into view, and
 * `<name>_time_spent` (seconds) when the user leaves it: another tab or
 * screen, or the app going to the background. Background time isn't counted.
 * `properties` (e.g. the selected tab) go on both events; when they change
 * while the screen is open, the time so far is sent and a new visit starts.
 */
export function useScreenTime(name: string, properties: Record<string, string> = {}): void {
  useVisitTimer(`visited_${name}`, `${name}_time_spent`, properties);
}

/** "Pandit Ravi Sharma" -> "pandit_ravi_sharma": safe in event names (Firebase allows 40 characters). */
export function eventSlug(text: string, max = 18): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, max).replace(/_+$/, "");
  return slug || "unknown";
}

/**
 * Chat screens: `chat_started_<astrologer>` when the chat opens and
 * `chat_<astrologer>_time_spent` (seconds) when the user leaves it.
 */
export function useChatTracking(chat: {
  astrologerName?: string;
  astrologerId?: string;
  readingType?: string;
  sessionId?: string;
  chatType: "ai" | "human";
}): void {
  const slug = eventSlug(chat.astrologerName || "astrologer");
  useVisitTimer(`chat_started_${slug}`, `chat_${slug}_time_spent`, {
    astrologer_name: chat.astrologerName || "",
    astrologer_id: chat.astrologerId || "",
    reading_type: chat.readingType || "",
    session_id: chat.sessionId || "",
    chat_type: chat.chatType,
  });
}

/** Sends `openEvent` when the screen comes into view and `timeEvent` (seconds) when the user leaves. */
function useVisitTimer(openEvent: string, timeEvent: string, properties: Record<string, string>): void {
  const key = JSON.stringify(properties);

  useFocusEffect(
    useCallback(() => {
      const extra = JSON.parse(key) as Record<string, string>;
      track(openEvent, { ...extra, platform: Platform.OS });

      let startedAt = Date.now();
      const report = () => {
        const seconds = Math.round((Date.now() - startedAt) / 1000);
        if (seconds > 0) track(timeEvent, { ...extra, seconds, platform: Platform.OS });
      };

      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") startedAt = Date.now();
        else if (state === "background") report();
      });

      return () => {
        subscription.remove();
        if (AppState.currentState === "active") report();
      };
    }, [openEvent, timeEvent, key])
  );
}

/** Tracks "screen_viewed" whenever the route changes. */
export function useScreenTracking(): void {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    track("screen_viewed", { screen: pathname });
    // Firebase's own screen report (Analytics > Pages and screens).
    firebase((analytics) => logScreenView(analytics, { screen_name: pathname, screen_class: pathname }));
  }, [pathname]);
}

/*
 * Meta (Facebook) App Events, for Meta ads. Standard events only, no
 * personal details. No tracking pop-up on iPhone (advertising ID off).
 * The SDK is native: builds made before it was added skip these calls.
 */
type MetaSdk = typeof import("react-native-fbsdk-next");
let metaSdk: MetaSdk | null | undefined;

function meta(run: (sdk: MetaSdk) => void): void {
  try {
    if (metaSdk === undefined) {
      metaSdk = NativeModules.FBAppEventsLogger
        ? // eslint-disable-next-line @typescript-eslint/no-require-imports
          (require("react-native-fbsdk-next") as MetaSdk)
        : null;
      metaSdk?.Settings.initializeSDK();
    }
    if (metaSdk) run(metaSdk);
  } catch {
    // Native module not in this build.
  }
}

function metaEvent(name: keyof MetaSdk["AppEventsLogger"]["AppEvents"], valueToSum: number | null, params: Record<string, string | number>): void {
  meta(({ AppEventsLogger }) => {
    const event = AppEventsLogger.AppEvents[name];
    if (valueToSum === null) AppEventsLogger.logEvent(event, params);
    else AppEventsLogger.logEvent(event, valueToSum, params);
  });
}

export const metaEvents = {
  /** Complete registration: a new account was created. */
  registration(method: string): void {
    meta(({ AppEventsLogger }) =>
      AppEventsLogger.logEvent(AppEventsLogger.AppEvents.CompletedRegistration, {
        [AppEventsLogger.AppEventParams.RegistrationMethod]: method,
      })
    );
  },

  /** View content: a report page or an astrologer's profile. */
  viewContent(type: "report" | "astrologer", id: string, price?: number): void {
    metaEvent("ViewedContent", price ?? null, { fb_content_type: type, fb_content_id: id, fb_currency: "INR" });
  },

  /** Add to cart: Buy Now on a report. */
  addToCart(reportId: string, price: number): void {
    metaEvent("AddedToCart", price, { fb_content_type: "report", fb_content_id: reportId, fb_currency: "INR" });
  },

  /** Initiate checkout: a wallet recharge started. */
  initiateCheckout(amount: number, packId: string): void {
    metaEvent("InitiatedCheckout", amount, { fb_content_type: "wallet_pack", fb_content_id: packId, fb_currency: "INR" });
  },

  /** Add payment info: the UPI payment went through. */
  addPaymentInfo(amount: number, packId: string): void {
    metaEvent("AddedPaymentInfo", amount, { fb_content_id: packId, fb_currency: "INR", fb_success: 1 });
  },

  /** Purchase: the recharge is confirmed and the money is in the wallet. */
  purchase(amount: number, packId: string): void {
    meta(({ AppEventsLogger }) =>
      AppEventsLogger.logPurchase(amount, "INR", { fb_content_type: "wallet_pack", fb_content_id: packId })
    );
  },

  /** Spent credits: a report bought from the wallet. */
  spentCredits(reportId: string, price: number): void {
    metaEvent("SpentCredits", price, { fb_content_type: "report", fb_content_id: reportId });
  },
};
