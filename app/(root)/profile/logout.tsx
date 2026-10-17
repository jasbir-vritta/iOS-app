import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, View } from "react-native";
import Reanimated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "../../../components/ui/BrandText";
import useAuthStore from "../../../components/stores/authStore";
import { useT } from "../../../lib/i18n";

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  GOLD: "#C49A4A",
  LAVENDER: "#F4F0F8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  LINE: "rgba(217,206,193,0.7)",
};

export default function Logout() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Clears the saved session and the signed-in state (user, profiles).
      await useAuthStore.getState().logout();

      // Replace the current screen so user cannot
      // go back to the authenticated screen.
      // The login screen is app/(auth)/index.jsx, i.e. the "/(auth)" route.
      router.replace("/(auth)");
    } catch (error) {
      console.error("Logout failed:", error);
      setBusy(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backButton} accessibilityLabel={t("common.back")}>
          <Icon name="chevron-left" size={24} color={C.INK} />
        </Pressable>
      </View>

      <View style={s.center}>
        {/* Illustration */}
        <Reanimated.View entering={ZoomIn.duration(450)} style={s.art}>
          <View style={s.ringOuter} />
          <View style={s.ringInner} />
          <Text style={[s.star, { top: 18, right: 30 }]}>✦</Text>
          <Text style={[s.star, { bottom: 26, left: 26, fontSize: 10 }]}>✦</Text>
          <Text style={[s.star, { top: 40, left: 18, fontSize: 8 }]}>✦</Text>
          <View style={s.medallion}>
            <Icon name="logout" size={36} color={C.CARD} />
          </View>
        </Reanimated.View>

        <Reanimated.View entering={FadeInDown.delay(120).duration(420)} style={{ alignItems: "center" }}>
          <Text style={s.title}>{t("logout.title")}</Text>
          <Text style={s.body}>{t("logout.body")}</Text>
        </Reanimated.View>
      </View>

      {/* Buttons */}
      <Reanimated.View entering={FadeInDown.delay(220).duration(420)} style={s.actions}>
        <Pressable onPress={handleLogout} disabled={busy} style={[s.primary, busy && { opacity: 0.7 }]}>
          {busy ? (
            <ActivityIndicator color={C.CARD} />
          ) : (
            <>
              <Icon name="logout" size={18} color={C.CARD} />
              <Text style={s.primaryText}>{t("logout.confirm")}</Text>
            </>
          )}
        </Pressable>
        <Pressable onPress={() => router.back()} disabled={busy} style={s.secondary}>
          <Text style={s.secondaryText}>{t("logout.stay")}</Text>
        </Pressable>
      </Reanimated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.LAVENDER },

  header: { paddingHorizontal: 16, paddingTop: 6 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },

  art: { width: 200, height: 200, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  ringOuter: {
    position: "absolute",
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 1,
    borderColor: "rgba(43,26,61,0.1)",
    backgroundColor: "rgba(255,253,252,0.5)",
  },
  ringInner: {
    position: "absolute",
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(196,154,74,0.6)",
  },
  star: { position: "absolute", color: C.GOLD, fontSize: 13 },
  medallion: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.PLUM,
    borderWidth: 3,
    borderColor: "rgba(196,154,74,0.7)",
    shadowColor: "#2B1A3D",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  title: { fontSize: 23, fontWeight: "700", color: C.INK, textAlign: "center", letterSpacing: -0.3 },
  body: { marginTop: 8, maxWidth: 320, fontSize: 13.5, lineHeight: 20, color: C.MUTED, textAlign: "center" },

  actions: { paddingHorizontal: 16 },
  primary: {
    height: 52,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.PLUM,
  },
  primaryText: { fontSize: 15, fontWeight: "700", color: C.CARD },
  secondary: {
    marginTop: 10,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  secondaryText: { fontSize: 15, fontWeight: "700", color: C.PLUM },
});
