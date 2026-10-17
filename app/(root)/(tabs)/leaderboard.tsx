import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Reanimated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AUTH_FONTS, F } from "../../../components/auth/theme";
import { C, CardArt, HOME_PAD, softShadow } from "../../../components/home/homeUi";
import { LeaderboardPeriod, LeaderboardUser, useMantraStore } from "../../../components/stores/mantraStore";
import { useTabBarSpace } from "../../../components/utils/tabBar";
import { useT } from "../../../lib/i18n";

const SILVER = "#9A9AA6";
const BRONZE = "#B07A4F";

// Translation keys; the text is looked up when shown (follows the app language).
const PERIODS: { key: LeaderboardPeriod; label: string; reset: string }[] = [
  { key: "daily", label: "leaderboard.daily", reset: "leaderboard.resetDaily" },
  { key: "weekly", label: "leaderboard.weekly", reset: "leaderboard.resetWeekly" },
  { key: "monthly", label: "leaderboard.monthly", reset: "leaderboard.resetMonthly" },
];

const LEADERBOARD_TOP = require("../../../assets/images/leaderboard_top.png");

// Initial avatars in palette tones.
const AVATAR_COLORS = ["#2B1A3D", "#4A3366", "#6B4E8C", "#8A6A2E", "#A94C36"];

function formatChants(value: number) {
  return String(Math.round(value || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({ user, size, soft = false }: { user: LeaderboardUser; size: number; soft?: boolean }) {
  const [failed, setFailed] = useState(false);
  const radius = size / 2;

  if (user.avatar_url && !failed) {
    return (
      <Image
        source={{ uri: user.avatar_url }}
        style={{ width: size, height: size, borderRadius: radius }}
        onError={() => setFailed(true)}
      />
    );
  }

  const initial = (user.name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: soft ? "rgba(255,253,252,0.16)" : avatarColor(user.name || ""),
      }}
    >
      <Text style={{ fontSize: size * 0.42, fontFamily: F.semibold, color: C.CARD }}>{initial}</Text>
    </View>
  );
}

/* #1 gets a breathing gold glow and a gently bobbing crown. */
function Crowned({ size, children }: { size: number; children: React.ReactNode }) {
  const still = useReducedMotion();
  const glow = useSharedValue(0);
  const bob = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    glow.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }), -1, true);
    bob.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [bob, glow, still]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + 0.28 * glow.value,
    transform: [{ scale: 1 + 0.18 * glow.value }],
  }));
  const crownStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 * bob.value }, { rotate: `${-4 + 8 * bob.value}deg` }],
  }));

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Reanimated.View
        style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: C.GOLD }, glowStyle]}
        pointerEvents="none"
      />
      <Reanimated.View style={[s.crown, crownStyle]}>
        <MaterialCommunityIcons name="crown" size={22} color={C.GOLD} />
      </Reanimated.View>
      {children}
    </View>
  );
}

function PodiumSpot({ user, place }: { user?: LeaderboardUser; place: 1 | 2 | 3 }) {
  const t = useT();
  const first = place === 1;
  const size = first ? 88 : 68;
  const ring = first ? C.GOLD : place === 2 ? SILVER : BRONZE;

  if (!user) return <View style={first ? s.podiumFirst : s.podiumSide} />;

  const circle = (
    <View style={[s.podiumRing, { width: size + 10, height: size + 10, borderRadius: (size + 10) / 2, borderColor: ring }]}>
      <Avatar user={user} size={size} />
      <View style={[s.placeBadge, { backgroundColor: ring }]}>
        <Text style={s.placeBadgeText}>{place}</Text>
      </View>
    </View>
  );

  return (
    <Reanimated.View
      entering={FadeInUp.delay(first ? 0 : place === 2 ? 150 : 300).duration(500)}
      style={first ? s.podiumFirst : s.podiumSide}
    >
      {first ? <Crowned size={size + 10}>{circle}</Crowned> : circle}

      <Text style={[s.podiumName, first && s.podiumNameFirst]} numberOfLines={2}>
        {user.is_current_user ? t("leaderboard.you", { name: user.name }) : user.name}
      </Text>
      <Text style={[s.podiumChants, first && s.podiumChantsFirst]}>{formatChants(user.chants)}</Text>
      <Text style={s.podiumLabel}>{t("leaderboard.chants")}</Text>
    </Reanimated.View>
  );
}

function RankRow({ user, last }: { user: LeaderboardUser; last: boolean }) {
  const t = useT();
  return (
    <View style={[s.row, !last && s.rowDivider, user.is_current_user && s.rowCurrent]}>
      <View style={s.rankPill}>
        <Text style={s.rankText}>{user.rank}</Text>
      </View>
      <Avatar user={user} size={40} />
      <Text style={s.rowName} numberOfLines={1}>
        {user.is_current_user ? t("leaderboard.you", { name: user.name }) : user.name}
      </Text>
      <Text style={s.rowChants}>{formatChants(user.chants)}</Text>
      <View style={s.rowFire}>
        {user.rank <= 5 && <MaterialCommunityIcons name="fire" size={18} color={C.GOLD} />}
      </View>
    </View>
  );
}

export default function Leaderboard() {
  const tabSpace = useTabBarSpace();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts(AUTH_FONTS);
  const t = useT();

  const leaderboard = useMantraStore((state) => state.leaderboard);
  const myRank = useMantraStore((state) => state.myRank);
  const period = useMantraStore((state) => state.leaderboardPeriod);
  const loading = useMantraStore((state) => state.leaderboardLoading);
  const error = useMantraStore((state) => state.error);
  const fetchLeaderboard = useMantraStore((state) => state.fetchLeaderboard);

  const [selected, setSelected] = useState<LeaderboardPeriod>(period);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLeaderboard(selected);
  }, [selected, fetchLeaderboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeaderboard(selected);
    setRefreshing(false);
  }, [selected, fetchLeaderboard]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(root)/(tabs)/rewards");
  };

  const activePeriod = PERIODS.find((p) => p.key === selected) ?? PERIODS[0];
  const { width: screenWidth } = useWindowDimensions();
  const podium = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const showingStale = period !== selected;
  const firstLoad = loading && (leaderboard.length === 0 || showingStale);

  // Your own rank sits just above the tab bar.
  const meSpace = myRank ? 86 : 0;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerButton} onPress={goBack} hitSlop={8} accessibilityLabel={t("mantra.goBack")}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={C.INK} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {t("leaderboard.title")}
        </Text>
        <TouchableOpacity
          style={s.headerButton}
          hitSlop={8}
          accessibilityLabel={t("leaderboard.aboutA11y")}
          onPress={() => Alert.alert(t("leaderboard.title"), t("leaderboard.aboutText"))}
        >
          <MaterialCommunityIcons name="information-outline" size={20} color={C.INK} />
        </TouchableOpacity>
      </View>

      {/* Period switcher */}
      <View style={s.segment}>
        {PERIODS.map((p) => {
          const active = p.key === selected;
          return (
            <TouchableOpacity
              key={p.key}
              activeOpacity={0.85}
              style={[s.segmentItem, active && s.segmentItemActive]}
              onPress={() => setSelected(p.key)}
            >
              <Text style={[s.segmentText, active && s.segmentTextActive]} numberOfLines={1}>
                {t(p.label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.resetRow}>
        <MaterialCommunityIcons name="calendar-month-outline" size={15} color={C.MUTED} />
        <Text style={s.resetText}>
          {t("leaderboard.periodReset", { period: t(activePeriod.label), reset: t(activePeriod.reset) })}
        </Text>
      </View>

      {!fontsLoaded || firstLoad ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={C.PLUM} />
        </View>
      ) : error && leaderboard.length === 0 ? (
        <View style={s.centered}>
          <Text style={s.emptyTitle}>{t("leaderboard.loadError")}</Text>
          <TouchableOpacity style={s.retryButton} onPress={() => fetchLeaderboard(selected)}>
            <Text style={s.retryText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : leaderboard.length === 0 ? (
        <View style={s.centered}>
          <MaterialCommunityIcons name="meditation" size={42} color={C.PLUM} />
          <Text style={s.emptyTitle}>{t("leaderboard.emptyTitle")}</Text>
          <Text style={s.emptyText}>{t("leaderboard.emptyText")}</Text>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: HOME_PAD, paddingBottom: tabSpace + meSpace + 12 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.PLUM} colors={[C.PLUM]} />
            }
          >
            {/* Podium */}
            <View style={s.podium}>
              <Image
                source={LEADERBOARD_TOP}
                style={[s.podiumBackground, { width: screenWidth, height: (screenWidth * 822) / 1914 }]}
                resizeMode="contain"
              />
              <PodiumSpot user={podium[1]} place={2} />
              <PodiumSpot user={podium[0]} place={1} />
              <PodiumSpot user={podium[2]} place={3} />
            </View>

            {/* Ranks 4+ */}
            {rest.length > 0 && (
              <Reanimated.View entering={FadeInDown.delay(350).duration(420)} style={s.listCard}>
                {rest.map((user, index) => (
                  <RankRow key={`${user.profile_id}-${user.rank}`} user={user} last={index === rest.length - 1} />
                ))}
              </Reanimated.View>
            )}
          </ScrollView>

          {/* Your rank, always visible above the tab bar */}
          {myRank && (
            <Reanimated.View entering={FadeInUp.delay(400).duration(420)} style={[s.me, { bottom: tabSpace + 8 }]}>
              <View style={s.meClip}>
                <CardArt width={150} height={90} color={C.CARD} />
                <View style={s.meRank}>
                  <Text style={s.meRankText}>#{myRank.rank}</Text>
                </View>
                <Avatar user={myRank} size={44} soft />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.meName} numberOfLines={1}>
                    {t("leaderboard.you", { name: myRank.name })}
                  </Text>
                  <Text style={s.meChants}>{t("leaderboard.chantsCount", { count: formatChants(myRank.chants) })}</Text>
                </View>
                <MaterialCommunityIcons name="meditation" size={22} color={C.GOLD} />
              </View>
            </Reanimated.View>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.LAVENDER },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: HOME_PAD,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  headerTitle: { color: C.INK, fontSize: 19, fontFamily: F.bold },

  segment: {
    flexDirection: "row",
    marginHorizontal: HOME_PAD,
    padding: 4,
    borderRadius: 999,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.BORDER,
  },
  segmentItem: { flex: 1, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segmentItemActive: { backgroundColor: C.PLUM },
  segmentText: { color: C.MUTED, fontSize: 13.5, fontFamily: F.semibold },
  segmentTextActive: { color: C.CARD },
  resetRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12 },
  resetText: { color: C.MUTED, fontSize: 12.5, fontFamily: F.medium },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
  emptyTitle: { color: C.INK, fontSize: 17, fontFamily: F.bold, textAlign: "center" },
  emptyText: { color: C.MUTED, fontSize: 14, fontFamily: F.regular, textAlign: "center" },
  retryButton: { marginTop: 4, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999, backgroundColor: C.PLUM },
  retryText: { color: C.CARD, fontSize: 14, fontFamily: F.semibold },

  podium: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", paddingTop: 40, paddingBottom: 20 },
  // Centres the lotus sun behind the #1 avatar.
  podiumBackground: { position: "absolute", top: -8, left: -HOME_PAD },
  podiumFirst: { flex: 1.2, alignItems: "center", marginBottom: 16 },
  podiumSide: { flex: 1, alignItems: "center" },
  crown: { position: "absolute", top: -26, zIndex: 3 },
  podiumRing: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    backgroundColor: C.CARD,
    shadowColor: C.PLUM,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  placeBadge: {
    position: "absolute",
    bottom: -12,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.CARD,
  },
  placeBadgeText: { color: C.CARD, fontSize: 12.5, fontFamily: F.bold },
  podiumName: { marginTop: 18, color: C.INK, fontSize: 13.5, fontFamily: F.semibold, textAlign: "center" },
  podiumNameFirst: { fontSize: 16, fontFamily: F.bold },
  podiumChants: { marginTop: 2, color: C.PLUM, fontSize: 17, fontFamily: F.bold },
  podiumChantsFirst: { fontSize: 21 },
  podiumLabel: { color: C.MUTED, fontSize: 12, fontFamily: F.regular },

  listCard: {
    borderRadius: 22,
    backgroundColor: C.CARD,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.LINE,
    ...softShadow,
  },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: C.LINE },
  rowCurrent: { backgroundColor: C.SOFT, marginHorizontal: -14, paddingHorizontal: 14 },
  rankPill: { minWidth: 30, height: 26, paddingHorizontal: 6, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: C.SOFT },
  rankText: { color: C.PLUM, fontSize: 12.5, fontFamily: F.bold },
  rowName: { flex: 1, color: C.INK, fontSize: 14.5, fontFamily: F.semibold },
  rowChants: { color: C.MUTED, fontSize: 13, fontFamily: F.semibold },
  rowFire: { width: 20, alignItems: "center" },

  me: { position: "absolute", left: HOME_PAD, right: HOME_PAD, borderRadius: 22, backgroundColor: C.PLUM, ...softShadow, shadowOpacity: 0.3 },
  meClip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: C.PLUM,
  },
  meRank: {
    minWidth: 40,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(196,154,74,0.18)",
    borderWidth: 1,
    borderColor: "rgba(196,154,74,0.45)",
  },
  meRankText: { color: C.CARD, fontSize: 13, fontFamily: F.bold },
  meName: { color: C.CARD, fontSize: 15, fontFamily: F.bold },
  meChants: { marginTop: 2, color: "rgba(255,253,252,0.72)", fontSize: 12.5, fontFamily: F.regular },
});
