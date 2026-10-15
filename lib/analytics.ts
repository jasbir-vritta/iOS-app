import Constants from "expo-constants";
import { usePathname } from "expo-router";
import { Mixpanel, type MixpanelProperties } from "mixpanel-react-native";
import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Mixpanel product analytics.
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
}

/** Links events to this user (backend user_id, never phone or email). */
export async function identifyUser(
  userId: string,
  profile?: { name?: string; phone?: string; email?: string }
): Promise<void> {
  if (!userId) return;

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

/** On logout: forget the user so the next account isn't merged with it. */
export function resetAnalytics(): void {
  initAnalytics().then(() => mixpanel.reset());
}

/** Tracks "screen_viewed" whenever the route changes. */
export function useScreenTracking(): void {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) track("screen_viewed", { screen: pathname });
  }, [pathname]);
}
