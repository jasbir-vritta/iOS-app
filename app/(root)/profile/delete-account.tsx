import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import Reanimated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "../../../components/ui/BrandText";

import useAuthStore from "../../../components/stores/authStore";
import { API_URL, authHeaders } from "../../../lib/auth";

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  GOLD: "#C49A4A",
  LAVENDER: "#F4F0F8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  LINE: "rgba(217,206,193,0.7)",
  DANGER: "#B3392F",
  DANGER_TINT: "#F8E9E7",
};

// What deleting removes.
const REMOVED: { icon: React.ComponentProps<typeof Icon>["name"]; text: string }[] = [
  { icon: "account-multiple-outline", text: "All profiles and birth details" },
  { icon: "chat-outline", text: "Chat history" },
  { icon: "receipt-text-outline", text: "Transaction history" },
  { icon: "shield-account-outline", text: "Your personal data" },
];

export default function DeleteAccount() {
  const insets = useSafeAreaInsets();
  const [understood, setUnderstood] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    if (deleting || !understood) return;

    setDeleting(true);

    try {
      const response = await fetch(`${API_URL}/api/user/account`, {
        method: "DELETE",
        headers: await authHeaders(),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string" ? data.detail : "Couldn't delete your account."
        );
      }

      // Signed-out state, then back to the start so the user can't go back.
      await useAuthStore.getState().logout();
      router.replace("/(auth)" as never);
    } catch (error) {
      Alert.alert(
        "Account not deleted",
        error instanceof Error ? error.message : "Please try again."
      );
      setDeleting(false);
    }
  };

  const canDelete = understood && !deleting;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          disabled={deleting}
          style={s.backButton}
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={24} color={C.INK} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Delete account</Text>
          <Text style={s.headerSub}>This can&apos;t be undone</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 28 }]}
      >
        {/* Illustration */}
        <Reanimated.View entering={ZoomIn.duration(420)} style={s.art}>
          <View style={s.ringOuter} />
          <View style={s.ringInner} />
          <View style={s.medallion}>
            <Icon name="delete-outline" size={36} color={C.DANGER} />
          </View>
        </Reanimated.View>

        <Reanimated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={s.title}>Delete your account?</Text>
          <Text style={s.body}>Your account will be closed and everything below will be permanently removed.</Text>
        </Reanimated.View>

        {/* What gets removed */}
        <Reanimated.View entering={FadeInDown.delay(170).duration(400)} style={s.card}>
          {REMOVED.map((item, index) => (
            <View key={item.text} style={[s.item, index > 0 && s.itemDivider]}>
              <View style={s.itemIcon}>
                <Icon name={item.icon} size={18} color={C.DANGER} />
              </View>
              <Text style={s.itemText}>{item.text}</Text>
              <Icon name="close" size={16} color={C.MUTED} />
            </View>
          ))}
        </Reanimated.View>

        {/* Confirmation */}
        <Reanimated.View entering={FadeInDown.delay(240).duration(400)}>
          <Pressable
            onPress={() => setUnderstood((value) => !value)}
            disabled={deleting}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: understood }}
            style={[s.confirm, understood && s.confirmOn]}
          >
            <View style={[s.checkbox, understood && s.checkboxOn]}>
              {understood && <Icon name="check-bold" size={16} color={C.CARD} />}
            </View>
            <Text style={s.confirmText}>I understand this is permanent and can&apos;t be undone.</Text>
          </Pressable>

          {/* Delete: faded until the box is ticked */}
          <Pressable
            onPress={deleteAccount}
            disabled={!canDelete}
            accessibilityState={{ disabled: !canDelete }}
            style={[s.delete, !understood && { opacity: 0.45 }]}
          >
            {deleting ? (
              <ActivityIndicator color={C.CARD} />
            ) : (
              <>
                <Icon name="delete-outline" size={19} color={C.CARD} />
                <Text style={s.deleteText}>Delete my account</Text>
              </>
            )}
          </Pressable>

          <Pressable onPress={() => router.back()} disabled={deleting} style={s.keep}>
            <Text style={s.keepText}>Keep my account</Text>
          </Pressable>
        </Reanimated.View>
      </ScrollView>
    </View>
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
  headerTitle: { fontSize: 21, fontWeight: "700", color: C.INK, letterSpacing: -0.3 },
  headerSub: { marginTop: 1, fontSize: 12.5, color: C.MUTED },

  content: { paddingHorizontal: 16 },

  art: { alignSelf: "center", width: 170, height: 170, alignItems: "center", justifyContent: "center" },
  ringOuter: {
    position: "absolute",
    width: 166,
    height: 166,
    borderRadius: 83,
    backgroundColor: "rgba(179,57,47,0.06)",
  },
  ringInner: {
    position: "absolute",
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(179,57,47,0.35)",
  },
  medallion: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 2,
    borderColor: "rgba(179,57,47,0.35)",
    shadowColor: "#2B1A3D",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  title: { marginTop: 6, fontSize: 23, fontWeight: "700", color: C.INK, textAlign: "center", letterSpacing: -0.3 },
  body: { marginTop: 6, fontSize: 13.5, lineHeight: 20, color: C.MUTED, textAlign: "center", paddingHorizontal: 12 },

  card: {
    marginTop: 18,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  itemDivider: { borderTopWidth: 1, borderTopColor: "#EFE9F2" },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.DANGER_TINT,
  },
  itemText: { flex: 1, fontSize: 14, fontWeight: "600", color: C.INK },

  confirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.LINE,
    backgroundColor: C.CARD,
  },
  confirmOn: { borderColor: C.DANGER, backgroundColor: C.DANGER_TINT },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: C.DANGER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
  },
  checkboxOn: { backgroundColor: C.DANGER },
  confirmText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: C.INK },

  delete: {
    marginTop: 14,
    height: 52,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.DANGER,
  },
  deleteText: { fontSize: 15, fontWeight: "700", color: C.CARD },
  keep: {
    marginTop: 10,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  keepText: { fontSize: 15, fontWeight: "700", color: C.PLUM },
});
