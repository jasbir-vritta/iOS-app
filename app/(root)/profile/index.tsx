// app/(root)/profile/index.tsx

import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Reanimated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { F } from "../../../components/auth/theme";
import { APP_NAME } from "../../../components/constants/app";
import { C, HOME_PAD, Medallion, SectionHeader, softShadow } from "../../../components/home/homeUi";
import { useMyLifeStore } from "../../../components/stores/myLifeStore";
import useProfilesStore from "../../../components/stores/profilesStore";
import { useUserStore } from "../../../components/stores/userStore";
import { useAvatarUpload } from "../../../components/utils/useAvatarUpload";
import { translate, useT } from "../../../lib/i18n";

type IconName = React.ComponentProps<typeof Icon>["name"];

const SUPPORT_EMAIL = "support@vritta.app";

const fmtDate = (d?: string) => {
  // Short month names in the app language ("Jan,Feb,…").
  const MONTHS = translate("profile.months").split(",");
  const p = String(d || "").split("/");
  return p.length === 3 && MONTHS[+p[1] - 1] ? `${+p[0]} ${MONTHS[+p[1] - 1]} ${p[2]}` : d || "—";
};

const fmtTime = (t?: string) => {
  const [h, m] = String(t || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t || "—";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

// Sections rise in one after another (as on Home).
const enter = (index: number) => FadeInDown.delay(70 * index).duration(420);

const light = (alpha: number) => `rgba(255,253,252,${alpha})`;

/* Slowly turning orbit lines in the hero's corner. */
const ORBIT = 220;
function HeroOrbits({ still }: { still: boolean }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    spin.value = withRepeat(withTiming(360, { duration: 70000, easing: Easing.linear }), -1);
  }, [spin, still]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const c = ORBIT / 2;
  return (
    <Reanimated.View style={[s.orbits, style]} pointerEvents="none">
      <Svg width={ORBIT} height={ORBIT}>
        <Circle cx={c} cy={c} r={c - 4} stroke={light(0.12)} fill="none" />
        <Circle cx={c} cy={c} r={c * 0.7} stroke={light(0.14)} fill="none" strokeDasharray="2 6" />
        <Circle cx={c} cy={4} r={3.5} fill={C.GOLD} />
        <Circle cx={c + c * 0.7} cy={c} r={2} fill={light(0.7)} />
      </Svg>
    </Reanimated.View>
  );
}

/* Soft gold ring that breathes around the profile photo. */
function AvatarGlow({ size, still }: { size: number; still: boolean }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    glow.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [glow, still]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.4 * glow.value,
    transform: [{ scale: 1 + 0.06 * glow.value }],
  }));
  return (
    <Reanimated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: C.GOLD }, style]}
    />
  );
}

/* Loved ones: a beating heart with soft ripples and little hearts floating up. */
function LovedHeart() {
  const still = useReducedMotion();
  const beat = useSharedValue(1);

  useEffect(() => {
    if (still) return;
    // Two quick beats, then a rest.
    beat.value = withRepeat(
      withSequence(
        withTiming(1.14, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 160 }),
        withTiming(1.1, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 220 }),
        withTiming(1, { duration: 1100 })
      ),
      -1
    );
  }, [still, beat]);

  const beatStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));

  return (
    <View style={s.lovedArt}>
      <Ripple delay={0} />
      <Ripple delay={900} />
      <FloatHeart delay={0} x={-12} size={10} />
      <FloatHeart delay={1200} x={12} size={8} />
      <FloatHeart delay={2300} x={0} size={9} />
      <Reanimated.View style={[s.lovedIcon, beatStyle]}>
        <Icon name="heart-multiple-outline" size={22} color={C.PLUM} />
      </Reanimated.View>
    </View>
  );
}

function Ripple({ delay }: { delay: number }) {
  const still = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1));
  }, [still, t, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: still ? 0 : 0.45 * (1 - t.value),
    transform: [{ scale: 1 + t.value * 0.6 }],
  }));

  return <Reanimated.View pointerEvents="none" style={[s.lovedRipple, style]} />;
}

function FloatHeart({ delay, x, size }: { delay: number; x: number; size: number }) {
  const still = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })),
        -1
      )
    );
  }, [still, t, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.15 ? t.value / 0.15 : 1 - t.value,
    transform: [{ translateX: x + Math.sin(t.value * Math.PI * 2) * 4 }, { translateY: -t.value * 34 }, { scale: 0.7 + t.value * 0.4 }],
  }));

  if (still) return null;
  return (
    <Reanimated.View pointerEvents="none" style={[s.lovedFloat, style]}>
      <Icon name="heart" size={size} color={C.GOLD} />
    </Reanimated.View>
  );
}

/** Arrow on "Add loved ones" that nudges forward now and then. */
function NudgeArrow() {
  const still = useReducedMotion();
  const x = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    x.value = withRepeat(
      withSequence(
        withTiming(4, { duration: 260, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 260 }),
        withTiming(0, { duration: 1600 })
      ),
      -1
    );
  }, [still, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Reanimated.View style={style}>
      <Icon name="arrow-right" size={15} color={C.CARD} />
    </Reanimated.View>
  );
}

export default function Profile() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const still = useReducedMotion();
  const { user } = useUserStore() as any;
  const profiles = useProfilesStore((state) => state.profiles);

  const activeProfileId = user?.active_profile_id;
  const profile = profiles.find((p) => p.profile_id === activeProfileId) || user;

  // Same Daily horoscope as My Life and Home; it carries the birth-chart signs.
  const today = useMyLifeStore((state) => (activeProfileId ? state.profiles[activeProfileId]?.daily : null));

  // Show the selected profile (TopBar picker); fall back to the account details.
  const name = profile?.name || user?.firstName || t("profile.guest");
  const phone = user?.phoneNumber || user?.phone || "";
  const avatarUrl = profiles.find((p) => p.profile_id === activeProfileId)?.avatar_url;
  const { uploading: uploadingPhoto, pickAndUpload } = useAvatarUpload(activeProfileId);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(root)/(tabs)"));

  const openHelp = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Help with Vritta")}`).catch(() =>
      Alert.alert(t("faq.alertTitle"), t("faq.alertBody", { email: SUPPORT_EMAIL }))
    );
  };

  const signs: { label: string; value: string; icon: IconName }[] = [
    { label: t("profile.sunSign"), value: today?.sun_sign || "—", icon: "white-balance-sunny" },
    { label: t("profile.moonSign"), value: today?.moon_sign || "—", icon: "moon-waning-crescent" },
    { label: t("profile.ascendant"), value: today?.ascendant || "—", icon: "arrow-up-circle-outline" },
  ];

  const quick: { title: string; sub: string; icon: IconName; route: string }[] = [
    { title: t("profile.manageProfiles"), sub: t("profile.manageProfilesSub"), icon: "account-multiple-outline", route: "/(root)/profile/manage-profiles" },
    { title: t("profile.language"), sub: "हिंदी, English +5", icon: "translate", route: "/(root)/profile/language" },
    { title: t("profile.chatHistory"), sub: t("profile.chatHistorySub"), icon: "chat-processing-outline", route: "/(root)/profile/chat-history" },
    { title: t("profile.transactions"), sub: t("profile.transactionsSub"), icon: "wallet-outline", route: "/(root)/profile/transaction-history" },
  ];

  const support: { title: string; sub: string; icon: IconName; onPress: () => void; danger?: boolean }[] = [
    { title: t("profile.faq"), sub: t("profile.faqSub"), icon: "comment-question-outline", onPress: () => router.push("/(root)/profile/faq") },
    { title: t("profile.needHelp"), sub: t("profile.needHelpSub", { email: SUPPORT_EMAIL }), icon: "help-circle-outline", onPress: openHelp },
    {
      title: t("profile.settings"),
      sub: t("profile.settingsSub"),
      icon: "cog-outline",
      onPress: () => router.push("/(root)/profile/account-settings"),
    },
    {
      title: t("profile.logout"),
      sub: t("profile.logoutSub"),
      icon: "logout-variant",
      onPress: () => router.replace("/(root)/profile/logout"),
      danger: true,
    },
  ];

  return (
    <View style={s.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: HOME_PAD, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 40 }}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={goBack} style={s.back} hitSlop={8} accessibilityLabel={t("common.back")}>
            <Icon name="chevron-left" size={24} color={C.INK} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{t("profile.title")}</Text>
            <Text style={s.subtitle} numberOfLines={1}>{t("profile.subtitle", { app: APP_NAME })}</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/(root)/profile/edit_profile")}
            style={s.edit}
          >
            <Icon name="pencil-outline" size={15} color={C.CARD} />
            <Text style={s.editText}>{t("common.edit")}</Text>
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <Reanimated.View entering={enter(0)} style={s.hero}>
          <View style={s.heroClip}>
            <HeroOrbits still={still} />

            <View style={s.heroRow}>
              <View style={s.avatarWrap}>
                <AvatarGlow size={96} still={still} />
                <View style={s.avatar}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={s.avatarImage} />
                  ) : (
                    <Text style={s.avatarLetter}>{String(name).charAt(0).toUpperCase()}</Text>
                  )}
                  {uploadingPhoto && (
                    <View style={s.avatarOverlay}>
                      <ActivityIndicator color={C.CARD} />
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={pickAndUpload}
                  disabled={uploadingPhoto || !activeProfileId}
                  style={s.camera}
                  accessibilityLabel={t("profile.changePhoto")}
                >
                  <Icon name="camera-outline" size={15} color={C.PLUM} />
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name} numberOfLines={1}>
                  {name}
                </Text>
                {!!phone && (
                  <Text style={s.phone} numberOfLines={1}>
                    {phone}
                  </Text>
                )}
                <View style={s.placeRow}>
                  <Icon name="map-marker-outline" size={14} color={C.GOLD} />
                  <Text style={s.place} numberOfLines={1}>
                    {profile?.placeOfBirth || t("profile.birthPlace")}
                  </Text>
                </View>
              </View>
            </View>

            <View style={s.birthRow}>
              <View style={s.birthChip}>
                <Icon name="calendar-month-outline" size={16} color={C.GOLD} />
                <View>
                  <Text style={s.birthValue}>{fmtDate(profile?.dateOfBirth)}</Text>
                  <Text style={s.birthLabel}>{t("profile.dateOfBirth")}</Text>
                </View>
              </View>
              <View style={s.birthChip}>
                <Icon name="clock-outline" size={16} color={C.GOLD} />
                <View>
                  <Text style={s.birthValue}>{fmtTime(profile?.timeOfBirth)}</Text>
                  <Text style={s.birthLabel}>{t("profile.birthTime")}</Text>
                </View>
              </View>
            </View>
          </View>
        </Reanimated.View>

        {/* Your chart */}
        <Reanimated.View entering={enter(1)}>
          <SectionHeader overline={t("profile.chartOverline")} title={t("profile.chartTitle")} />
          <View style={s.signRow}>
            {signs.map((sign) => (
              <View key={sign.label} style={s.signTile}>
                <Medallion icon={sign.icon} size={38} />
                <Text style={s.signLabel} numberOfLines={1} adjustsFontSizeToFit>
                  {sign.label}
                </Text>
                <Text style={s.signValue} numberOfLines={1}>
                  {sign.value}
                </Text>
              </View>
            ))}
          </View>
        </Reanimated.View>

        {/* Loved ones */}
        <Reanimated.View entering={enter(2)} style={s.loved}>
          <LovedHeart />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.lovedTitle}>{t("profile.lovedTitle")}</Text>
            <Text style={s.lovedText}>{t("profile.lovedText")}</Text>
            <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/profile/add-profile")} style={s.lovedBtn}>
              <Text style={s.lovedBtnText}>{t("profile.lovedButton")}</Text>
              <NudgeArrow />
            </TouchableOpacity>
          </View>
        </Reanimated.View>

        {/* Quick access */}
        <Reanimated.View entering={enter(3)}>
          <SectionHeader overline={t("profile.quickOverline")} title={t("profile.quickTitle")} />
          <View style={s.quickGrid}>
            {quick.map((item) => (
              <TouchableOpacity
                key={item.title}
                activeOpacity={0.88}
                onPress={() => router.push(item.route as any)}
                style={s.quickTile}
              >
                <Medallion icon={item.icon} size={40} />
                <Text style={s.quickTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={s.quickSub} numberOfLines={1}>
                  {item.sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Reanimated.View>

        {/* Account and support */}
        <Reanimated.View entering={enter(4)}>
          <SectionHeader overline={t("profile.helpOverline")} title={t("profile.helpTitle")} />
          <View style={s.list}>
            {support.map((row, index) => (
              <TouchableOpacity
                key={row.title}
                activeOpacity={0.85}
                onPress={row.onPress}
                style={[s.listRow, index > 0 && s.listDivider]}
              >
                <View style={[s.listIcon, row.danger && s.listIconDanger]}>
                  <Icon name={row.icon} size={19} color={row.danger ? "#B3392F" : C.PLUM} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.listTitle, row.danger && { color: "#B3392F" }]} numberOfLines={1}>
                    {row.title}
                  </Text>
                  <Text style={s.listSub} numberOfLines={1}>
                    {row.sub}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={C.MUTED} />
              </TouchableOpacity>
            ))}
          </View>
        </Reanimated.View>

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.footerRow}>
            <Icon name="lock-outline" size={14} color={C.MUTED} />
            <Text style={s.footerText}>{t("profile.footer")}</Text>
          </View>
          <View style={s.footerRow}>
            <Text style={s.footerLink} onPress={() => router.push("/(root)/profile/privacy-policy")}>
              {t("profile.privacy")}
            </Text>
            <View style={s.footerSep} />
            <Text style={s.footerLink} onPress={() => router.push("/(root)/profile/terms")}>
              {t("profile.terms")}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.LAVENDER },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  title: { color: C.INK, fontSize: 22, fontFamily: F.bold, letterSpacing: -0.3 },
  subtitle: { color: C.MUTED, fontSize: 12.5, fontFamily: F.regular },
  edit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.PLUM,
  },
  editText: { color: C.CARD, fontSize: 13, fontFamily: F.semibold },

  hero: { borderRadius: 26, backgroundColor: C.PLUM, ...softShadow, shadowOpacity: 0.25 },
  heroClip: { borderRadius: 26, overflow: "hidden", padding: 18, backgroundColor: C.PLUM },
  orbits: { position: "absolute", top: -ORBIT * 0.4, right: -ORBIT * 0.35, width: ORBIT, height: ORBIT },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarWrap: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light(0.14),
    borderWidth: 2,
    borderColor: C.CARD,
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarLetter: { color: C.CARD, fontSize: 34, fontFamily: F.bold },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(43,26,61,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  camera: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 2,
    borderColor: C.PLUM,
  },
  name: { color: C.CARD, fontSize: 21, fontFamily: F.bold, letterSpacing: -0.3 },
  phone: { marginTop: 2, color: light(0.8), fontSize: 13.5, fontFamily: F.medium },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  place: { flexShrink: 1, color: light(0.72), fontSize: 12.5, fontFamily: F.regular },
  birthRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  birthChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: light(0.08),
    borderWidth: 1,
    borderColor: light(0.16),
  },
  birthValue: { color: C.CARD, fontSize: 13.5, fontFamily: F.bold },
  birthLabel: { marginTop: 1, color: light(0.65), fontSize: 11, fontFamily: F.medium },

  signRow: { flexDirection: "row", gap: 10 },
  signTile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    ...softShadow,
    shadowOpacity: 0.05,
  },
  signLabel: { marginTop: 8, color: C.MUTED, fontSize: 11.5, fontFamily: F.medium },
  signValue: { marginTop: 2, color: C.INK, fontSize: 15, fontFamily: F.bold },

  loved: {
    flexDirection: "row",
    gap: 14,
    marginTop: 16,
    padding: 16,
    borderRadius: 22,
    backgroundColor: C.IVORY,
    borderWidth: 1,
    borderColor: "#E6D9C4",
    overflow: "hidden",
  },
  lovedArt: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  lovedRipple: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.GOLD,
  },
  lovedFloat: { position: "absolute", top: 0 },
  lovedIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: "#E6D9C4",
  },
  lovedTitle: { color: C.INK, fontSize: 16, fontFamily: F.bold },
  lovedText: { marginTop: 3, color: C.MUTED, fontSize: 13, lineHeight: 19, fontFamily: F.regular },
  lovedBtn: {
    alignSelf: "flex-start",
    marginTop: 12,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: C.PLUM,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lovedBtnText: { color: C.CARD, fontSize: 13, fontFamily: F.bold },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickTile: {
    width: "48.5%",
    padding: 14,
    borderRadius: 20,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    ...softShadow,
    shadowOpacity: 0.05,
  },
  quickTitle: { marginTop: 10, color: C.INK, fontSize: 14.5, fontFamily: F.bold },
  quickSub: { marginTop: 2, color: C.MUTED, fontSize: 12, fontFamily: F.regular },

  list: {
    borderRadius: 22,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    overflow: "hidden",
    ...softShadow,
    shadowOpacity: 0.05,
  },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  listDivider: { borderTopWidth: 1, borderTopColor: C.LINE },
  listIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: C.SOFT },
  listIconDanger: { backgroundColor: "#F8E4E1" },
  listTitle: { color: C.INK, fontSize: 14.5, fontFamily: F.bold },
  listSub: { marginTop: 1, color: C.MUTED, fontSize: 12, fontFamily: F.regular },

  footer: { marginTop: 24, alignItems: "center", gap: 10 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerText: { color: C.MUTED, fontSize: 12, fontFamily: F.regular },
  footerLink: { color: C.INK, fontSize: 12.5, fontFamily: F.semibold },
  footerSep: { width: 1, height: 14, marginHorizontal: 8, backgroundColor: C.BORDER },
});
