import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "../../../components/ui/BrandText";

import {
  getNotificationsEnabled,
  setNotificationsEnabled,
} from "../../../lib/notifications";

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  GOLD: "#C49A4A",
  LAVENDER: "#F4F0F8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  BORDER: "#D9CEC1",
  LINE: "rgba(217,206,193,0.7)",
  SOFT: "#EFE8F7",
  DANGER: "#B3392F",
  DANGER_TINT: "#F8E9E7",
};

type IconName = React.ComponentProps<typeof Icon>["name"];

export default function AccountSettings() {
  const insets = useSafeAreaInsets();
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    getNotificationsEnabled().then(setNotificationsOn);
  }, []);

  // Also re-check when coming back from the phone's settings.
  useEffect(() => {
    refresh();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });

    return () => subscription.remove();
  }, [refresh]);

  const toggleNotifications = async (value: boolean) => {
    setSaving(true);
    setNotificationsOn(value);

    try {
      setNotificationsOn(await setNotificationsEnabled(value));
    } finally {
      setSaving(false);
    }
  };

  const version = Constants.expoConfig?.version;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backButton} accessibilityLabel="Go back">
          <Icon name="chevron-left" size={24} color={C.INK} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Account settings</Text>
          <Text style={s.subtitle}>Notifications and your account</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Notifications */}
        <Reanimated.View entering={FadeInDown.duration(380)}>
          <Text style={s.overline}>NOTIFICATIONS</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={[s.icon, { backgroundColor: C.SOFT }]}>
                <Icon name="bell-outline" size={21} color={C.PLUM} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowTitle}>Push notifications</Text>
                <Text style={s.rowSub}>Daily mantra reminders and important updates</Text>
              </View>
              <Switch
                value={notificationsOn}
                onValueChange={toggleNotifications}
                disabled={saving}
                trackColor={{ false: C.BORDER, true: C.PLUM }}
                thumbColor={C.CARD}
                ios_backgroundColor={C.BORDER}
              />
            </View>
          </View>
        </Reanimated.View>

        {/* Account */}
        <Reanimated.View entering={FadeInDown.delay(70).duration(380)}>
          <Text style={s.overline}>ACCOUNT</Text>
          <View style={s.card}>
            <LinkRow
              icon="logout"
              title="Log out"
              sub="Sign out on this phone"
              onPress={() => router.push("/(root)/profile/logout")}
            />
            <View style={s.divider} />
            <LinkRow
              icon="delete-outline"
              title="Delete account"
              sub="Permanently remove your account and data"
              danger
              onPress={() => router.push("/(root)/profile/delete-account")}
            />
          </View>
        </Reanimated.View>

        {!!version && <Text style={s.version}>Vritta · version {version}</Text>}
      </ScrollView>
    </View>
  );
}

function LinkRow({
  icon,
  title,
  sub,
  danger = false,
  onPress,
}: {
  icon: IconName;
  title: string;
  sub: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={s.row}>
      <View style={[s.icon, { backgroundColor: danger ? C.DANGER_TINT : C.SOFT }]}>
        <Icon name={icon} size={21} color={danger ? C.DANGER : C.PLUM} />
      </View>
      <View style={s.rowText}>
        <Text style={[s.rowTitle, danger && { color: C.DANGER }]}>{title}</Text>
        <Text style={s.rowSub}>{sub}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={C.MUTED} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.LAVENDER },

  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
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
  title: { fontSize: 21, fontWeight: "700", color: C.INK, letterSpacing: -0.3 },
  subtitle: { marginTop: 1, fontSize: 12.5, color: C.MUTED },

  content: { paddingHorizontal: 16 },

  overline: { marginTop: 18, marginBottom: 8, fontSize: 11, fontWeight: "700", letterSpacing: 1.3, color: C.GOLD },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.LINE,
    backgroundColor: C.CARD,
    overflow: "hidden",
    shadowColor: "#2B1A3D",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  divider: { height: 1, marginLeft: 68, backgroundColor: "#EFE9F2" },

  row: { minHeight: 70, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, marginLeft: 12, marginRight: 8 },
  rowTitle: { fontSize: 15, fontWeight: "700", color: C.INK },
  rowSub: { marginTop: 2, fontSize: 12.5, color: C.MUTED },

  version: { marginTop: 22, textAlign: "center", fontSize: 11.5, color: C.MUTED },
});
