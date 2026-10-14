import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  LeaderboardPeriod,
  LeaderboardUser,
  useMantraStore,
} from "../../../components/stores/mantraStore";

const INK = "#1C1830";
const MUTED = "#77758A";
const PURPLE = "#4B2470";
const PURPLE_SOFT = "#EFE8F8";
const BACKGROUND = "#F6F2FC";
const GOLD = "#F2A72B";
const SILVER = "#9A9AA6";
const BRONZE = "#C97A45";
const FIRE = "#F26332";

const PERIODS: {
  key: LeaderboardPeriod;
  label: string;
  reset: string;
}[] = [
  { key: "daily", label: "Daily", reset: "Resets at midnight" },
  { key: "weekly", label: "Weekly", reset: "Resets every Monday" },
  { key: "monthly", label: "Monthly", reset: "Resets on the 1st" },
];

const LEADERBOARD_TOP = require("../../../assets/images/leaderboard_top.png");

const AVATAR_COLORS =["#8E3FBF", "#D6336C", "#3B5BDB", "#0C8599", "#E8590C"];

function formatChants(value: number) {
  return String(Math.round(value || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({
  user,
  size,
  softFallback = false,
}: {
  user: LeaderboardUser;
  size: number;
  softFallback?: boolean;
}) {
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
        backgroundColor: softFallback ? PURPLE_SOFT : avatarColor(user.name || ""),
      }}
    >
      <Text
        style={{
          fontSize: size * 0.42,
          fontWeight: "600",
          color: softFallback ? PURPLE : "#FFFFFF",
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

function PodiumSpot({
  user,
  place,
}: {
  user?: LeaderboardUser;
  place: 1 | 2 | 3;
}) {
  const first = place === 1;
  const size = first ? 92 : 72;
  const ringColor = first ? GOLD : place === 2 ? SILVER : BRONZE;

  if (!user) {
    return <View style={first ? styles.podiumFirst : styles.podiumSide} />;
  }

  return (
    <View style={first ? styles.podiumFirst : styles.podiumSide}>
      {first && (
        <View style={styles.crown}>
          <MaterialCommunityIcons name="star-circle" size={26} color={GOLD} />
        </View>
      )}

      <View
        style={[
          styles.podiumRing,
          {
            width: size + 10,
            height: size + 10,
            borderRadius: (size + 10) / 2,
            borderColor: first ? GOLD : "#FFFFFF",
          },
        ]}
      >
        <Avatar user={user} size={size} />

        <View style={[styles.placeBadge, { backgroundColor: ringColor }]}>
          <Text style={styles.placeBadgeText}>{place}</Text>
        </View>
      </View>

      <Text
        style={[styles.podiumName, first && styles.podiumNameFirst]}
        numberOfLines={2}
      >
        {user.is_current_user ? `${user.name} (You)` : user.name}
      </Text>

      <Text style={[styles.podiumChants, first && styles.podiumChantsFirst]}>
        {formatChants(user.chants)}
      </Text>

      <Text style={styles.podiumLabel}>chants</Text>
    </View>
  );
}

function RankRow({ user, last }: { user: LeaderboardUser; last: boolean }) {
  return (
    <View
      style={[
        styles.row,
        !last && styles.rowDivider,
        user.is_current_user && styles.rowCurrent,
      ]}
    >
      <Text style={styles.rowRank}>{user.rank}</Text>

      <Avatar user={user} size={44} />

      <Text style={styles.rowName} numberOfLines={1}>
        {user.is_current_user ? `${user.name} (You)` : user.name}
      </Text>

      <Text style={styles.rowChants}>{formatChants(user.chants)} chants</Text>

      <View style={styles.rowFire}>
        {user.rank <= 5 && (
          <MaterialCommunityIcons name="fire" size={20} color={FIRE} />
        )}
      </View>
    </View>
  );
}

export default function Index() {
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
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(root)/(tabs)/rewards");
    }
  };

  const activePeriod = PERIODS.find((p) => p.key === selected) ?? PERIODS[0];
  const { width: screenWidth } = useWindowDimensions();
  const podium = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const showingStale = period !== selected;
  const firstLoad = loading && (leaderboard.length === 0 || showingStale);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* HEADER */}

      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={goBack} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={30} color={INK} />
        </Pressable>

        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Mantra Leaderboard</Text>
          <MaterialCommunityIcons
            name="information-outline"
            size={20}
            color={INK}
          />
        </View>

        <View style={styles.headerButton} />
      </View>

      {/* PERIOD TABS */}

      <View style={styles.segment}>
        {PERIODS.map((p) => {
          const active = p.key === selected;

          return (
            <Pressable
              key={p.key}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => setSelected(p.key)}
            >
              <Text
                style={[styles.segmentText, active && styles.segmentTextActive]}
              >
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.resetRow}>
        <MaterialCommunityIcons
          name="calendar-month-outline"
          size={16}
          color={MUTED}
        />
        <Text style={styles.resetText}>
          {activePeriod.label} • {activePeriod.reset}
        </Text>
      </View>

      {firstLoad ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PURPLE} />
        </View>
      ) : error && leaderboard.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Couldn't load the leaderboard</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => fetchLeaderboard(selected)}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : leaderboard.length === 0 ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons name="meditation" size={44} color={PURPLE} />
          <Text style={styles.emptyTitle}>No chants yet</Text>
          <Text style={styles.emptyText}>
            Be the first to chant and top the leaderboard.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={PURPLE}
                colors={[PURPLE]}
              />
            }
          >
            {/* PODIUM */}

            <View style={styles.podium}>
              <Image
                source={LEADERBOARD_TOP}
                style={[
                  styles.podiumBackground,
                  {
                    width: screenWidth,
                    height: (screenWidth * 822) / 1914,
                  },
                ]}
                resizeMode="contain"
              />

              <PodiumSpot user={podium[1]} place={2} />
              <PodiumSpot user={podium[0]} place={1} />
              <PodiumSpot user={podium[2]} place={3} />
            </View>

            {/* RANKS 4+ */}

            {rest.length > 0 && (
              <View style={styles.listCard}>
                {rest.map((user, index) => (
                  <RankRow
                    key={`${user.profile_id}-${user.rank}`}
                    user={user}
                    last={index === rest.length - 1}
                  />
                ))}
              </View>
            )}
          </ScrollView>

          {/* CURRENT USER */}

          {myRank && (
            <View style={styles.meCard}>
              <Text style={styles.meRank}>{myRank.rank}</Text>

              <Avatar user={myRank} size={48} softFallback />

              <View style={styles.meContent}>
                <Text style={styles.meName} numberOfLines={1}>
                  {myRank.name} (You)
                </Text>
                <Text style={styles.meChants}>
                  {formatChants(myRank.chants)} chants
                </Text>
              </View>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: INK,
  },
  segment: {
    flexDirection: "row",
    marginHorizontal: 16,
    padding: 4,
    borderRadius: 14,
    backgroundColor: PURPLE_SOFT,
  },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentItemActive: {
    backgroundColor: PURPLE,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: "500",
    color: INK,
  },
  segmentTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  resetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  resetText: {
    fontSize: 13,
    color: MUTED,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: INK,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: PURPLE,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingTop: 34,
    paddingBottom: 18,
  },
  // Centres the lotus sun behind the #1 avatar.
  podiumBackground: {
    position: "absolute",
    top: -8,
    left: -16,
  },
  podiumFirst: {
    flex: 1.2,
    alignItems: "center",
    marginBottom: 16,
  },
  podiumSide: {
    flex: 1,
    alignItems: "center",
  },
  crown: {
    position: "absolute",
    top: -24,
    zIndex: 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
  },
  podiumRing: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    backgroundColor: "#FFFFFF",
    shadowColor: "#4B2470",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
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
    borderColor: "#FFFFFF",
  },
  placeBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  podiumName: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: "600",
    color: INK,
    textAlign: "center",
  },
  podiumNameFirst: {
    fontSize: 17,
    fontWeight: "700",
  },
  podiumChants: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: "700",
    color: INK,
  },
  podiumChantsFirst: {
    fontSize: 22,
  },
  podiumLabel: {
    fontSize: 13,
    color: MUTED,
  },
  listCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    shadowColor: "#4B2470",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECE7F3",
  },
  rowCurrent: {
    backgroundColor: "#F8F4FD",
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  rowRank: {
    width: 26,
    fontSize: 15,
    fontWeight: "600",
    color: INK,
    textAlign: "center",
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: INK,
  },
  rowChants: {
    fontSize: 14,
    color: MUTED,
  },
  rowFire: {
    width: 20,
    alignItems: "center",
  },
  meCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "#EDE5F7",
  },
  meRank: {
    width: 30,
    fontSize: 16,
    fontWeight: "700",
    color: INK,
    textAlign: "center",
  },
  meContent: {
    flex: 1,
  },
  meName: {
    fontSize: 15,
    fontWeight: "600",
    color: INK,
  },
  meChants: {
    marginTop: 2,
    fontSize: 14,
    color: MUTED,
  },
});
