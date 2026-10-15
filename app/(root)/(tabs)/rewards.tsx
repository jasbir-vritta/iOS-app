import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useRewardsStore } from "../../../components/stores/rewardsStore";
import { useTabBarSpace } from "../../../components/utils/tabBar";

const REWARDS_TODAY_TOP =
  "https://storage.googleapis.com/vritta/astrology/rewards/rewards_today_top.png";

const MANTRA_REWARD_IMAGE =
  "https://storage.googleapis.com/vritta/astrology/rewards/mantra_reward.png";

const NAVY = "#17104A";
const NAVY_SOFT = "#24134F";
const SLATE = "#77758A";
const PURPLE = "#54228C";
const ORANGE = "#E27A45";

export default function Index() {
  const tabSpace = useTabBarSpace();
  const rewards = useRewardsStore((state) => state.rewards);
  const loading = useRewardsStore((state) => state.loading);
  const fetchRewards = useRewardsStore((state) => state.fetchRewards);

  // Refresh each time the tab opens (e.g. after chanting).
  useFocusEffect(
    useCallback(() => {
      fetchRewards();
    }, [fetchRewards])
  );

  if (loading && !rewards) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PURPLE} />
        </View>
      </SafeAreaView>
    );
  }

  // Wallet credits are whole rupees in the UI.
  const walletCredits = Math.floor(Number(rewards?.walletCredits ?? 0)) || 0;

  const earnedToday = rewards?.today?.earned ?? 0;
  const dailyMaximum = rewards?.today?.maximum ?? 10;

  const progress =
    dailyMaximum > 0 ? Math.min(earnedToday / dailyMaximum, 1) : 0;

  const activities = [
    {
      type: "mantra_daily" as const,
      title: "Complete today's Mantra Jaap",
      description: "Keep your daily chanting practice going",
      icon: "om" as const,
      data: rewards?.activities?.mantra_daily,
    },
    {
      type: "conversation_daily" as const,
      title: "Have a conversation",
      description: "Get guidance from AI or an astrologer",
      icon: "message-outline" as const,
      data: rewards?.activities?.conversation_daily,
    },
    {
      type: "insight_daily" as const,
      title: "Read your daily insights",
      description: "Check your personalised guidance",
      icon: "file-document-outline" as const,
      data: rewards?.activities?.insight_daily,
    },
  ];

  const streak = rewards?.mantraStreak ?? {
    current: 0,
    target: 7,
    bonus: 20,
    days: 0,
    completedToday: false,
  };

  const streakProgress =
    streak.target > 0 ? Math.min(streak.current / streak.target, 1) : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabSpace }]}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Rewards</Text>

            <Text style={styles.headerSubtitle}>
              Stay consistent, complete daily{"\n"}
              activities and earn rewards.
            </Text>
          </View>

          <View style={styles.walletPill}>
            <MaterialCommunityIcons
              name="wallet-outline"
              size={28}
              color="#C35A2A"
            />

            <View>
              <Text style={styles.walletLabel}>Wallet</Text>
              <Text style={styles.walletAmount}>₹{walletCredits}</Text>
            </View>

            <Pressable
              style={styles.addButton}
              onPress={() => router.push("/profile/wallet")}
            >
              <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* TODAY'S REWARDS */}

       <View style={styles.todayCard}>
    <Image
      source={{ uri: REWARDS_TODAY_TOP }}
      style={styles.todayCardImage}
    />

    <View style={styles.todayOverlay}>
      <View style={styles.todayHeader}>
        <View style={styles.todayTitleRow}>
          <Text style={styles.todayTitle}>
            Today's Rewards
          </Text>

          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={NAVY_SOFT}
          />
        </View>

        <Text style={styles.todayAmount}>
          <Text style={styles.todayEarned}>
            ₹{earnedToday}
          </Text>
          {/* Past the target (extra mantra rounds, streak bonus): show the total only. */}
          {earnedToday > dailyMaximum ? " earned" : ` / ₹${dailyMaximum}`}
        </Text>
      </View>

      <View style={styles.todayTrack}>
        <View
          style={[
            styles.todayFill,
            {
              width: `${progress * 100}%`,
            },
          ]}
        />
      </View>

      <Text style={styles.todayDescription}>
        {earnedToday >= dailyMaximum
          ? "You've reached today's ₹" + dailyMaximum + " target 🎉 Every extra 108 chants earns more."
          : "Complete activities to earn ₹" + dailyMaximum + " today. Every extra 108 chants earns more."}
      </Text>
    </View>
</View>

        {/* TODAY'S ACTIVITIES */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Activities</Text>

          <Text style={styles.sectionSubtitle}>
            Complete these activities to earn rewards.
          </Text>
        </View>

        <View style={styles.activitiesContainer}>
          {activities.map((activity) => {
            const completed = activity.data?.completed ?? false;
            const credits = activity.data?.credits ?? 0;

            return (
              <View
                key={activity.type}
                style={[
                  styles.activityRow,
                  completed && styles.activityRowCompleted,
                ]}
              >
                <View style={styles.activityIcon}>
                  <MaterialCommunityIcons
                    name={activity.icon}
                    size={27}
                    color={PURPLE}
                  />
                </View>

                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {activity.title}
                  </Text>

                  <Text style={styles.activityDescription} numberOfLines={2}>
                    {activity.description}
                  </Text>
                </View>

                <View
                  style={[
                    styles.rewardBadge,
                    completed && styles.rewardBadgeCompleted,
                  ]}
                >
                  <Text
                    style={[
                      styles.rewardBadgeText,
                      completed && styles.rewardBadgeCompletedText,
                    ]}
                  >
                    + ₹{credits}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusCircle,
                    completed && styles.statusCircleCompleted,
                  ]}
                >
                  {completed && (
                    <MaterialCommunityIcons
                      name="check"
                      size={17}
                      color="#FFFFFF"
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* MANTRA STREAK */}

        <View style={styles.streakCard}>
          <MaterialCommunityIcons
            name="fire"
            size={50}
            color="#F26332"
            style={styles.streakIcon}
          />

          <View style={styles.streakMain}>
            <Text style={styles.streakTitle}>
              {streak.target} day mantra streak
            </Text>

            <Text style={styles.streakDescription}>
              {streak.days > 0
                ? `${streak.days} day${streak.days > 1 ? "s" : ""} in a row${
                    streak.completedToday ? " · Today is done ✓" : ""
                  }`
                : "Keep your mantra practice going."}
            </Text>

            <Text style={styles.streakDescription}>
              Every {streak.target} days in a row earns a ₹{streak.bonus} bonus.
            </Text>
          </View>

          <View style={styles.streakSide}>
            <Text style={styles.streakCount}>
              {streak.current} / {streak.target} days
            </Text>

            <View style={styles.streakTrack}>
              <View
                style={[
                  styles.streakFill,
                  { width: `${streakProgress * 100}%` },
                ]}
              />
            </View>
          </View>
        </View>

        {/* MANTRA LEADERBOARD */}

        <Pressable style={styles.leaderboardCard} onPress={() => router.push("/(root)/(tabs)/leaderboard")}>
          <Image
            source={{ uri: MANTRA_REWARD_IMAGE }}
            style={styles.leaderboardImage}
          />

          <View style={styles.leaderboardOverlay}>
              <MaterialCommunityIcons
                name="trophy-award"
                size={38}
                color={PURPLE}
                style={styles.leaderboardIcon}
              />

              <View style={styles.leaderboardContent}>
                <Text style={styles.leaderboardTitle}>Mantra Leaderboard</Text>

                <Text style={styles.leaderboardDescription}>
                  See today's top chanters.{"\n"}
                  Your chant count contributes{"\n"}
                  to the leaderboard.
                </Text>
              </View>

              <MaterialCommunityIcons
                name="chevron-right"
                size={28}
                color={NAVY_SOFT}
                style={styles.leaderboardChevron}
              />
            </View>
        </Pressable>

        {/* MORE WAYS TO EARN */}

        <Pressable style={styles.moreWaysCard} onPress={() => {}}>
          <MaterialCommunityIcons
            name="gift-outline"
            size={32}
            color={PURPLE}
            style={styles.moreWaysIcon}
          />

          <View style={styles.moreWaysContent}>
            <Text style={styles.moreWaysTitle}>More ways to earn</Text>

            <Text style={styles.moreWaysDescription}>
              Refer friends and earn rewards.
            </Text>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={27}
            color="#3B3556"
          />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8F7FF",
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
  },

  /* Header */

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },

  headerText: {
    flex: 1,
    paddingRight: 8,
    paddingTop: 4,
  },

  headerTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: NAVY,
    letterSpacing: -1,
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 19,
    color: SLATE,
  },

  walletPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#EFEAF8",
  },

  walletLabel: {
    fontSize: 12,
    color: "#6F6A82",
  },

  walletAmount: {
    marginTop: -1,
    fontSize: 22,
    fontWeight: "800",
    color: NAVY,
  },

  addButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8A0057",
  },

  /* Today's rewards */

  todayCard: {
  width: "100%",
  height: 118,
  borderRadius: 18,
  overflow: "hidden",
  marginBottom: 20,
  position: "relative",

},

// The PNG (2121x741) has a transparent border around the card artwork
// (x 57-2063, y 108-607). Scale it so the artwork fills the 118px card
// height, right-align it, and let the card's overflow clip the border.
todayCardImage: {
  position: "absolute",
  top: -25.5,
  right: -13.7,
  width: 500.6,
  height: 174.9,
},

todayOverlay: {
  flex: 1,
  paddingHorizontal: 16,
  paddingVertical: 13,
},

  todayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  todayTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  todayTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: NAVY,
  },

  todayAmount: {
    fontSize: 21,
    fontWeight: "800",
    color: NAVY,
  },

  todayEarned: {
    color: "#C94C21",
  },

  todayTrack: {
    height: 16,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.6)",
    overflow: "hidden",
  },

  todayFill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor: ORANGE,
  },

  todayDescription: {
    marginTop: 10,
    fontSize: 13,
    color: SLATE,
  },

  /* Section */

  sectionHeader: {
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: NAVY,
  },

  sectionSubtitle: {
    marginTop: 1,
    fontSize: 14,
    color: SLATE,
  },

  /* Activities */

  activitiesContainer: {
    gap: 8,
    marginBottom: 12,
  },

  activityRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },

  activityRowCompleted: {
    backgroundColor: "#EDF7EA",
  },

  activityIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1E8FF",
    marginRight: 11,
  },

  activityContent: {
    flex: 1,
    paddingRight: 6,
  },

  activityTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#20134C",
  },

  activityDescription: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: SLATE,
  },

  rewardBadge: {
    minWidth: 56,
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#FFE7D6",
    marginRight: 9,
  },

  rewardBadgeCompleted: {
    backgroundColor: "#DDF2DA",
  },

  rewardBadgeText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#C5531E",
  },

  rewardBadgeCompletedText: {
    color: "#2E8B3E",
  },

  statusCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#9E9BA9",
    alignItems: "center",
    justifyContent: "center",
  },

  statusCircleCompleted: {
    borderWidth: 0,
    backgroundColor: "#2B1250",
  },

  /* Streak */

  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "#FFEEE4",
    marginBottom: 10,
  },

  streakIcon: {
    marginRight: 8,
  },

  streakMain: {
    flex: 1,
    paddingRight: 8,
  },

  streakTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: NAVY,
    marginBottom: 2,
  },

  streakDescription: {
    fontSize: 11.5,
    lineHeight: 15,
    color: SLATE,
  },

  streakSide: {
    width: 84,
    alignSelf: "flex-start",
    paddingTop: 4,
  },

  streakCount: {
    fontSize: 14,
    fontWeight: "800",
    color: NAVY_SOFT,
    textAlign: "right",
  },

  streakTrack: {
    height: 12,
    marginTop: 10,
    borderRadius: 6,
    backgroundColor: "#E9DAD4",
    overflow: "hidden",
  },

  streakFill: {
    height: "100%",
    borderRadius: 6,
    backgroundColor: ORANGE,
  },

  /* Leaderboard */

  leaderboardCard: {
  width: "100%",
  height: 108,
  borderRadius: 18,
  overflow: "hidden",
  marginBottom: 10,
  
},



  // The PNG (2122x741) has a transparent border around the card artwork
  // (x 26-2097, y 161-607). Scale it so the artwork fills the 108px card
  // height, right-align it, and let the card's overflow clip the border.
  leaderboardImage: {
    position: "absolute",
    top: -39,
    right: -6.1,
    width: 513.8,
    height: 179.4,
  },

  leaderboardOverlay: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    
  },

  leaderboardIcon: {
    marginRight: 12,
  },

  leaderboardContent: {
    flex: 1,
    paddingRight: 34,
  },

  leaderboardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: NAVY_SOFT,
    marginBottom: 3,
  },

  leaderboardDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: SLATE,
  },

  leaderboardChevron: {
    position: "absolute",
    right: 10,
    top: "50%",
    marginTop: -14,
  },

  /* More ways to earn */

  moreWaysCard: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#C9C1D6",
  },

  moreWaysIcon: {
    marginRight: 14,
  },

  moreWaysContent: {
    flex: 1,
  },

  moreWaysTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: NAVY_SOFT,
  },

  moreWaysDescription: {
    marginTop: 2,
    fontSize: 12.5,
    color: SLATE,
  },
});