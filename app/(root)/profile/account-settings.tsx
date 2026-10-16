import { MaterialCommunityIcons as Icon, Ionicons } from "@expo/vector-icons";
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

import { Text } from "../../../components/ui/BrandText";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getNotificationsEnabled,
  setNotificationsEnabled,
} from "../../../lib/notifications";

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  TERRACOTTA: "#A94C36",
  IVORY: "#F7F1E8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  BORDER: "#D9CEC1",
  LAV_TINT: "#EFE8F7",
  PEACH_TINT: "#FBEBE4",
  SOFT_LINE: "#EEE7F4",
};

export default function AccountSettings() {
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

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.IVORY} />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.back}>
          <Ionicons name="chevron-back" size={25} color={C.INK} />
        </Pressable>
        <Text style={s.headerTitle}>Account Settings</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* NOTIFICATIONS */}
        <Text style={s.sectionTitle}>Notifications</Text>

        <View style={s.card}>
          <View style={s.row}>
            <View style={[s.icon, { backgroundColor: C.LAV_TINT }]}>
              <Icon name="bell-outline" size={22} color={C.PLUM} />
            </View>

            <View style={s.rowText}>
              <Text style={s.rowTitle}>Push notifications</Text>
              <Text style={s.rowSub}>Daily mantra and important updates.</Text>
            </View>

            <Switch
              value={notificationsOn}
              onValueChange={toggleNotifications}
              disabled={saving}
              trackColor={{ false: C.BORDER, true: C.PLUM }}
              thumbColor={C.CARD}
            />
          </View>
        </View>

        {/* ACCOUNT */}
        <Text style={s.sectionTitle}>Account</Text>

        <View style={s.card}>
          <Pressable
            style={s.row}
            onPress={() => router.push("/(root)/profile/delete-account")}
          >
            <View style={[s.icon, { backgroundColor: C.PEACH_TINT }]}>
              <Icon name="delete-outline" size={22} color={C.TERRACOTTA} />
            </View>

            <View style={s.rowText}>
              <Text style={[s.rowTitle, { color: C.TERRACOTTA }]}>Delete account</Text>
              <Text style={s.rowSub}>Permanently remove your account and data.</Text>
            </View>

            <Icon name="chevron-right" size={22} color={C.INK} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.IVORY },

  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  headerTitle: { marginLeft: 4, fontSize: 19, fontWeight: "700", color: C.PLUM },

  content: { paddingHorizontal: 16, paddingBottom: 32 },

  sectionTitle: {
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: C.MUTED,
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.SOFT_LINE,
    backgroundColor: C.CARD,
    overflow: "hidden",
  },

  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, marginLeft: 12, marginRight: 8 },
  rowTitle: { fontSize: 15, fontWeight: "700", color: C.INK },
  rowSub: { marginTop: 2, fontSize: 12.5, color: C.MUTED },
});
