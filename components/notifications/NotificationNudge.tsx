import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, View } from "react-native";

import {
  markNotificationNudgeShown,
  notificationNudgeDelay,
  setNotificationsEnabled,
} from "../../lib/notifications";
import { track } from "../../lib/analytics";
import BottomSheet from "../ui/BottomSheet";
import { Text } from "../ui/BrandText";

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  GOLD: "#C49A4A",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  SOFT: "#EFE8F7",
};

/**
 * Reminder for users who didn't allow notifications: once a day, after
 * 2 minutes of use on a new user's first day, right after opening on
 * later days. Only time with the app open counts.
 */
export default function NotificationNudge() {
  const [visible, setVisible] = useState(false);
  // Analytics: why it opened (the daily reminder).
  const source = useRef<"daily">("daily");

  const open = (from: "daily") => {
    source.current = from;
    setVisible(true);
    track("notification_popup_shown", { source: from, platform: Platform.OS });
  };

  // "Not now" or tapping outside.
  const cancel = () => {
    setVisible(false);
    track("notification_popup_cancelled", { source: source.current, platform: Platform.OS });
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let needMs: number | null = null;
    // Time in use so far, and when the current stretch started.
    let usedMs = 0;
    let activeSince: number | null = null;

    const show = async () => {
      if (cancelled) return;
      // Still not allowed? (They may have turned it on meanwhile.)
      if ((await notificationNudgeDelay()) === null) return;
      await markNotificationNudgeShown();
      if (!cancelled) open("daily");
    };

    const start = () => {
      if (needMs === null || timer) return;
      activeSince = Date.now();
      timer = setTimeout(show, Math.max(0, needMs - usedMs));
    };

    const pause = () => {
      if (activeSince !== null) usedMs += Date.now() - activeSince;
      activeSince = null;
      if (timer) clearTimeout(timer);
      timer = null;
    };

    notificationNudgeDelay().then((delay) => {
      if (cancelled || delay === null) return;
      needMs = delay;
      if (AppState.currentState === "active") start();
    });

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else pause();
    });

    return () => {
      cancelled = true;
      pause();
      subscription.remove();
    };
  }, []);

  const allow = () => {
    setVisible(false);
    const from = source.current;
    // Phone prompt if it can still ask, else the app's notification settings.
    setTimeout(async () => {
      const enabled = await setNotificationsEnabled(true);
      // enabled: whether notifications are on right after (false while the
      // user is still in the phone's settings).
      track("notification_popup_allowed", { source: from, enabled, platform: Platform.OS });
    }, 350);
  };

  return (
    <BottomSheet visible={visible} onClose={cancel}>
      {/* Plum bell in a gold ring, like the rest of the app */}
      <View style={s.art}>
        <View style={s.ringOuter} />
        <View style={s.ring} />
        <Text style={[s.star, { top: 2, right: 22 }]}>✦</Text>
        <Text style={[s.star, { bottom: 12, left: 14, fontSize: 9 }]}>✦</Text>
        <Text style={[s.star, { top: 34, left: 4, fontSize: 8 }]}>✦</Text>
        <View style={s.bell}>
          <Icon name="bell-ring-outline" size={30} color={C.CARD} />
        </View>
      </View>

      <Text style={s.overline}>STAY IN TOUCH</Text>
      <Text style={s.title}>Your Daily Cosmic Guidance</Text>
      <Text style={s.text}>Get your daily horoscope and personalized mantras to guide your day.</Text>

      <Pressable onPress={allow} style={s.primary}>
        <Icon name="bell-outline" size={18} color={C.CARD} />
        <Text style={s.primaryText}>Allow notifications</Text>
      </Pressable>
      <Pressable onPress={cancel} style={s.secondary}>
        <Text style={s.secondaryText}>Not now</Text>
      </Pressable>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  art: { alignSelf: "center", width: 124, height: 124, alignItems: "center", justifyContent: "center" },
  ringOuter: {
    position: "absolute",
    width: 122,
    height: 122,
    borderRadius: 61,
    backgroundColor: C.SOFT,
  },
  ring: {
    position: "absolute",
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(196,154,74,0.7)",
  },
  star: { position: "absolute", color: C.GOLD, fontSize: 13 },
  bell: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.PLUM,
    borderWidth: 3,
    borderColor: "rgba(196,154,74,0.7)",
  },
  overline: { marginTop: 14, fontSize: 11, fontWeight: "700", letterSpacing: 1.3, color: C.GOLD, textAlign: "center" },
  title: { marginTop: 4, fontSize: 21, fontWeight: "700", color: C.INK, textAlign: "center", letterSpacing: -0.3 },
  text: { marginTop: 6, fontSize: 14, lineHeight: 20, color: C.MUTED, textAlign: "center", paddingHorizontal: 14 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    marginTop: 22,
    borderRadius: 999,
    backgroundColor: C.PLUM,
  },
  primaryText: { fontSize: 15, fontWeight: "700", color: C.CARD },
  secondary: { alignItems: "center", paddingVertical: 14 },
  secondaryText: { fontSize: 14, fontWeight: "600", color: C.MUTED },
});
