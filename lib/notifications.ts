import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getMessaging,
  getToken,
  isDeviceRegisteredForRemoteMessages,
  registerDeviceForRemoteMessages,
} from "@react-native-firebase/messaging";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Linking, Platform } from "react-native";

import { API_URL, authHeaders } from "./auth";

/**
 * Push notifications through Firebase Cloud Messaging (FCM).
 *
 * The app registers this phone's FCM token with the backend
 * (POST /api/user/push-token); the backend (Cloud Run, using its own
 * Google identity, no key file) sends notifications to it via FCM.
 * A notification can carry `data.url` (an app route such as
 * "/mantra/abc"), which opens when the user taps it.
 */

// The last token sent to the backend, so it isn't re-sent every launch.
const SENT_TOKEN_KEY = "push_token_sent";

// Set when the user turns notifications off in Account Settings, so the
// app doesn't register again on the next launch.
const OPTED_OUT_KEY = "push_opted_out";

// Our "Turn on notifications" reminder (after the user didn't allow):
// the day the app was first opened, and the last day it was shown.
const FIRST_OPEN_DAY_KEY = "push_nudge_first_open_day";
const NUDGE_LAST_DAY_KEY = "push_nudge_last_day";

// "2026-10-16" on this phone's clock.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Show notifications as a banner even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getPushToken(ask: boolean): Promise<string | null> {
  // Simulators can't receive push notifications.
  if (!Device.isDevice) return null;

  let { status } = await Notifications.getPermissionsAsync();

  if (status !== "granted" && ask) {
    // iOS shows the system "Allow notifications?" prompt.
    ({ status } = await Notifications.requestPermissionsAsync());
  }

  if (status !== "granted") return null;

  // iOS: Firebase links the iPhone's APNs token to an FCM token, which
  // is what the backend sends to (expo-notifications alone would give
  // the raw APNs token).
  const messaging = getMessaging();

  if (!isDeviceRegisteredForRemoteMessages(messaging)) {
    await registerDeviceForRemoteMessages(messaging);
  }

  return getToken(messaging);
}

/**
 * Registers this phone with the backend. With `ask`, shows the phone's
 * "Allow notifications?" prompt if it hasn't been answered yet.
 * Safe to call on every launch; failures are ignored.
 */
export async function registerForPushNotifications({ ask = false }: { ask?: boolean } = {}): Promise<void> {
  try {
    if (await AsyncStorage.getItem(OPTED_OUT_KEY)) return;

    const token = await getPushToken(ask);

    if (!token) return;

    if (__DEV__) {
      // For "Send test message" in Firebase Messaging.
      console.log("FCM token:", token);
    }

    if ((await AsyncStorage.getItem(SENT_TOKEN_KEY)) === token) return;

    const response = await fetch(`${API_URL}/api/user/push-token`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ token, platform: Platform.OS }),
    });

    if (response.ok) {
      await AsyncStorage.setItem(SENT_TOKEN_KEY, token);
    }
  } catch (error) {
    console.warn("Push notification setup failed:", error);
  }
}

/**
 * On logout: stop sending this account's notifications to this phone.
 * Also clears the "turned off" choice, so the next account starts fresh.
 */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OPTED_OUT_KEY);

    const token = await AsyncStorage.getItem(SENT_TOKEN_KEY);

    if (!token) return;

    await AsyncStorage.removeItem(SENT_TOKEN_KEY);

    await fetch(`${API_URL}/api/user/push-token`, {
      method: "DELETE",
      headers: await authHeaders(),
      body: JSON.stringify({ token }),
    });
  } catch {
    // Best effort; the backend also drops tokens FCM reports as invalid.
  }
}

/** On only if the phone allows it and the user hasn't turned it off. */
export async function getNotificationsEnabled(): Promise<boolean> {
  try {
    const [{ status }, optedOut] = await Promise.all([
      Notifications.getPermissionsAsync(),
      AsyncStorage.getItem(OPTED_OUT_KEY),
    ]);

    return status === "granted" && !optedOut;
  } catch {
    return false;
  }
}

/**
 * The Account Settings switch. Returns whether notifications are now on.
 * If the phone won't show the permission prompt any more (the user said
 * "Don't allow" before), opens the app's notification settings instead.
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<boolean> {
  if (!enabled) {
    await unregisterPushNotifications();
    await AsyncStorage.setItem(OPTED_OUT_KEY, "1");
    return false;
  }

  await AsyncStorage.removeItem(OPTED_OUT_KEY);

  const permission = await Notifications.getPermissionsAsync();

  if (permission.status !== "granted" && !permission.canAskAgain) {
    await Linking.openSettings();
    return false;
  }

  await registerForPushNotifications({ ask: true });

  return getNotificationsEnabled();
}

function openFromNotification(response: Notifications.NotificationResponse | null) {
  const url = response?.notification.request.content.data?.url;

  if (typeof url === "string" && url.startsWith("/")) {
    router.push(url as never);
  }
}

/**
 * Opens `data.url` when a notification is tapped: both while the app is
 * running and when the tap launched the app.
 */
export function useNotificationTaps() {
  useEffect(() => {
    openFromNotification(Notifications.getLastNotificationResponse());

    const subscription =
      Notifications.addNotificationResponseReceivedListener(openFromNotification);

    return () => subscription.remove();
  }, []);
}

/**
 * Our reminder when notifications aren't allowed. Returns null when it
 * shouldn't show today, else how long the app must be in use first:
 * 2 minutes on a new user's first day, right away on later days.
 */
export async function notificationNudgeDelay(): Promise<number | null> {
  try {
    if (!Device.isDevice) return null;

    const day = today();
    let firstDay = await AsyncStorage.getItem(FIRST_OPEN_DAY_KEY);
    if (!firstDay) {
      firstDay = day;
      await AsyncStorage.setItem(FIRST_OPEN_DAY_KEY, day);
    }

    const [permission, optedOut, lastDay] = await Promise.all([
      Notifications.getPermissionsAsync(),
      AsyncStorage.getItem(OPTED_OUT_KEY),
      AsyncStorage.getItem(NUDGE_LAST_DAY_KEY),
    ]);

    // Only after the user said "Don't allow" (not before the phone has
    // asked), never if they turned it off in Account Settings, once a day.
    if (permission.status !== "denied" || optedOut || lastDay === day) return null;

    return firstDay === day ? 2 * 60 * 1000 : 2500;
  } catch {
    return null;
  }
}

/** The reminder was shown today. */
export async function markNotificationNudgeShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(NUDGE_LAST_DAY_KEY, today());
  } catch {
    // Ignore.
  }
}
