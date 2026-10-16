import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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

import { Text } from "../../../components/ui/BrandText";
import { SafeAreaView } from "react-native-safe-area-context";

import useAuthStore from "../../../components/stores/authStore";
import { API_URL, authHeaders } from "../../../lib/auth";

const C = {
  // Warm white at the top, through soft blush, to lavender at the bottom.
  bgTop: "#FDF8F5",
  bgMid: "#FBF1F0",
  bgBottom: "#F1E9F5",
  ink: "#1C1A33",
  muted: "#6E6878",
  binTop: "#E8665A",
  binBottom: "#C9392F",
  binLid: "#D9483D",
  binSlot: "rgba(120,20,15,0.35)",
  glowOuter: "#FDF0EC",
  glowInner: "#FBE3DC",
  leaf: "#E3B29A",
  stem: "#DDB09A",
  sparkle: "#EBC3B3",
  warnBg: "#FCE8E5",
  warnIcon: "#B9473B",
  warnInk: "#8A2E22",
  // Brick red, slightly lighter at the top (as in the design).
  buttonTop: "#BE5143",
  buttonBottom: "#A8402F",
};

// Bin drawn to match the design: lid with handle, body with three slots.
function Bin() {
  return (
    <View style={{ alignItems: "center" }}>
      {/* Handle */}
      <View
        style={{
          width: 30,
          height: 14,
          borderWidth: 5,
          borderBottomWidth: 0,
          borderTopLeftRadius: 9,
          borderTopRightRadius: 9,
          borderColor: C.binLid,
        }}
      />
      {/* Lid */}
      <View style={{ width: 98, height: 16, borderRadius: 8, backgroundColor: C.binLid }} />
      {/* Body */}
      <LinearGradient
        colors={[C.binTop, C.binBottom]}
        style={{
          marginTop: 6,
          width: 80,
          height: 100,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-evenly",
          paddingHorizontal: 10,
        }}
      >
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 8, height: 64, borderRadius: 4, backgroundColor: C.binSlot }} />
        ))}
      </LinearGradient>
    </View>
  );
}

// A small leafy sprig; `flip` mirrors it for the right side.
function Sprig({ flip = false }: { flip?: boolean }) {
  const leaves = [
    { top: 6, side: -1 },
    { top: 24, side: 1 },
    { top: 42, side: -1 },
    { top: 60, side: 1 },
    { top: 78, side: -1 },
  ];

  return (
    <View
      style={{
        width: 46,
        height: 110,
        transform: [{ rotate: flip ? "18deg" : "-18deg" }, { scaleX: flip ? -1 : 1 }],
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 22,
          top: 4,
          width: 2,
          height: 104,
          borderRadius: 1,
          backgroundColor: C.stem,
        }}
      />
      {leaves.map((leaf, i) => (
        <Icon
          key={i}
          name="leaf"
          size={20}
          color={C.leaf}
          style={{
            position: "absolute",
            top: leaf.top,
            left: leaf.side < 0 ? 6 : 22,
            transform: [{ rotate: leaf.side < 0 ? "-40deg" : "40deg" }, { scaleX: leaf.side < 0 ? -1 : 1 }],
          }}
        />
      ))}
    </View>
  );
}

export default function DeleteAccount() {
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

  // Plain StyleSheet styles only (no Tailwind classes or style functions), so
  // every size and gap is applied exactly on the device.
  const canDelete = understood && !deleting;

  return (
    <LinearGradient
      colors={[C.bgTop, C.bgMid, C.bgBottom]}
      locations={[0, 0.45, 1]}
      style={styles.flex}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bgTop} />

      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Back */}
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel="Back"
            disabled={deleting}
            style={styles.back}
          >
            <Icon name="chevron-left" size={32} color={C.ink} />
          </Pressable>

          {/* Illustration */}
          <View style={styles.illustration}>
            <View style={styles.glowOuter} />
            <View style={styles.glowInner} />

            <View style={{ transform: [{ scale: 0.82 }] }}>
              <Bin />
            </View>

            <View style={[styles.sprig, { left: 30 }]}>
              <Sprig />
            </View>
            <View style={[styles.sprig, { right: 30 }]}>
              <Sprig flip />
            </View>

            <Text style={[styles.sparkle, { top: 20, right: 92, fontSize: 13 }]}>✦</Text>
            <Text style={[styles.sparkle, { top: 52, right: 74 }]}>✦</Text>
            <Text style={[styles.sparkle, { top: 44, left: 92 }]}>✦</Text>
          </View>

          {/* Text */}
          <Text style={styles.title}>Delete Your Account?</Text>

          <Text style={styles.body}>
            This will permanently delete your account, all profiles, chat history, transaction
            history, and personal data. This action cannot be undone.
          </Text>

          {/* Confirmation checkbox */}
          <Pressable
            onPress={() => setUnderstood((value) => !value)}
            disabled={deleting}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: understood }}
            style={[styles.confirm, { borderColor: understood ? C.warnIcon : "transparent" }]}
          >
            <View
              style={[
                styles.checkbox,
                { backgroundColor: understood ? C.warnIcon : "#FFFFFF" },
              ]}
            >
              {understood && <Icon name="check-bold" size={25} color="#FFFFFF" />}
            </View>

            <Text style={styles.confirmText}>
              I understand that this action is permanent and cannot be undone.
            </Text>
          </Pressable>

          {/* Delete: faded and disabled until the box is ticked */}
          <Pressable
            onPress={deleteAccount}
            disabled={!canDelete}
            accessibilityState={{ disabled: !canDelete }}
            style={[styles.button, { opacity: understood ? 1 : 0.45 }]}
          >
            <LinearGradient colors={[C.buttonTop, C.buttonBottom]} style={styles.buttonInner}>
              {deleting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Delete Account</Text>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 32 },
  back: {
    marginTop: 6,
    marginLeft: -8,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  illustration: {
    marginTop: 2,
    height: 186,
    alignItems: "center",
    justifyContent: "center",
  },
  glowOuter: {
    position: "absolute",
    width: 184,
    height: 184,
    borderRadius: 92,
    backgroundColor: C.glowOuter,
  },
  glowInner: {
    position: "absolute",
    width: 134,
    height: 134,
    borderRadius: 67,
    backgroundColor: C.glowInner,
  },
  sprig: { position: "absolute", bottom: 22 },
  sparkle: { position: "absolute", fontSize: 9, color: C.sparkle },
  title: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "700",
    color: C.ink,
  },
  body: {
    marginTop: 8,
    paddingHorizontal: 4,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    color: C.muted,
  },
  confirm: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: C.warnBg,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: C.warnIcon,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    flex: 1,
    marginLeft: 14,
    fontSize: 15,
    lineHeight: 22,
    color: C.warnInk,
  },
  button: {
    marginTop: 14,
    borderRadius: 16,
    shadowColor: C.buttonBottom,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  buttonInner: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 18, fontWeight: "600", color: "#FFFFFF" },
});
