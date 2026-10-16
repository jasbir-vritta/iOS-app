import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Reanimated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
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

import { AUTH_FONTS, F } from "../../../components/auth/theme";
import { C, CardArt, HOME_PAD, SectionHeader, softShadow } from "../../../components/home/homeUi";
import { useRewardsStore } from "../../../components/stores/rewardsStore";
import TopBar from "../../../components/TopBar";
import { useTabBarSpace } from "../../../components/utils/tabBar";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const GREEN = "#2E7D4F";
const GREEN_SOFT = "#E6F2EA";
const GOLD_TEXT = "#8A6A2E";

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

// Sections rise in one after another (as on Home).
const enter = (index: number) => FadeInDown.delay(70 * index).duration(420);

/* ---------------- today's ring ---------------- */

const RING = 112;
const STROKE = 8;

function useCountUp(target: number, still: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (still) return;
    const start = Date.now();
    let frame = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / 1000);
      setValue(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, still]);
  return still ? target : value;
}

// Little ₹ symbols that rise from the ring and fade, like coins being earned.
const RUPEES = [
  { x: 14, delay: 0 },
  { x: 74, delay: 1300 },
  { x: 44, delay: 2600 },
];

function Rupee({ x, delay, still }: { x: number; delay: number; still: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3900, easing: Easing.out(Easing.quad) }), -1));
  }, [delay, still, t]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.sin(Math.PI * t.value) * 0.9,
    transform: [{ translateY: 70 - 90 * t.value }, { scale: 0.8 + 0.3 * t.value }],
  }));
  if (still) return null;
  return (
    <Reanimated.View style={[{ position: "absolute", left: x, top: 0 }, style]} pointerEvents="none">
      <Text style={st.rupee}>₹</Text>
    </Reanimated.View>
  );
}

// A soft band of light that sweeps across the card every few seconds.
function Shine({ still }: { still: boolean }) {
  const x = useSharedValue(-1);
  useEffect(() => {
    if (still) return;
    x.value = withRepeat(
      withSequence(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), withDelay(3200, withTiming(-1, { duration: 0 }))),
      -1
    );
  }, [still, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 420 }, { rotate: "18deg" }] }));
  if (still) return null;
  return (
    <Reanimated.View style={[st.shine, style]} pointerEvents="none">
      <LinearGradient
        colors={["rgba(255,253,252,0)", "rgba(255,253,252,0.13)", "rgba(255,253,252,0)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Reanimated.View>
  );
}

function TodayRing({ progress, earned, still }: { progress: number; earned: number; still: boolean }) {
  const r = (RING - STROKE) / 2;
  const length = 2 * Math.PI * r;
  const fill = useSharedValue(still ? progress : 0);
  useEffect(() => {
    fill.value = still ? progress : withTiming(progress, { duration: 1200, easing: Easing.out(Easing.cubic) });
  }, [fill, progress, still]);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - fill.value) }));
  const shown = useCountUp(earned, still);

  // Breathing glow and a coin orbiting the ring.
  const glow = useSharedValue(0);
  const orbit = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    glow.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
    orbit.value = withRepeat(withTiming(360, { duration: 9000, easing: Easing.linear }), -1);
  }, [glow, orbit, still]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.08 + 0.3 * glow.value,
    transform: [{ scale: 0.82 + 0.3 * glow.value }],
  }));
  const orbitStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${orbit.value}deg` }] }));
  // Room around the ring so the coin and its glow are never clipped.
  const ORBIT_BOX = RING + 40;
  const ORBIT_R = RING / 2 + 9;

  return (
    <View style={{ width: RING, height: RING, alignItems: "center", justifyContent: "center" }}>
      <Reanimated.View style={[st.ringGlow, glowStyle]} pointerEvents="none" />
      <Reanimated.View
        style={[
          { position: "absolute", width: ORBIT_BOX, height: ORBIT_BOX, left: -20, top: -20 },
          orbitStyle,
        ]}
        pointerEvents="none"
      >
        <Svg width={ORBIT_BOX} height={ORBIT_BOX}>
          <Circle
            cx={ORBIT_BOX / 2}
            cy={ORBIT_BOX / 2}
            r={ORBIT_R}
            stroke="rgba(196,154,74,0.45)"
            strokeDasharray="2 6"
            fill="none"
          />
          <Circle cx={ORBIT_BOX / 2} cy={ORBIT_BOX / 2 - ORBIT_R} r={8} fill={C.GOLD} opacity={0.25} />
          <Circle cx={ORBIT_BOX / 2} cy={ORBIT_BOX / 2 - ORBIT_R} r={4.5} fill={C.GOLD} />
        </Svg>
      </Reanimated.View>
      {RUPEES.map((r, i) => (
        <Rupee key={i} {...r} still={still} />
      ))}
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke="rgba(255,253,252,0.16)" strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          stroke={C.GOLD}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${length} ${length}`}
          animatedProps={ringProps}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <Text style={st.ringValue}>₹{shown}</Text>
      <Text style={st.ringLabel}>earned today</Text>
    </View>
  );
}

// Gold sparkles that twinkle on the hero.
const SPARKLES = [
  { left: "6%", top: 14, size: 10, delay: 0 },
  { left: "44%", top: 10, size: 8, delay: 900 },
  { left: "52%", top: 96, size: 7, delay: 1500 },
] as const;

function Sparkle({ left, top, size, delay, still }: { left: string; top: number; size: number; delay: number; still: boolean }) {
  const glow = useSharedValue(0.6);
  useEffect(() => {
    if (still) return;
    glow.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 1300 }), withTiming(0.2, { duration: 1300 })), -1)
    );
  }, [delay, glow, still]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.8 + glow.value * 0.3 }] }));
  return (
    <Reanimated.View style={[{ position: "absolute", left: left as any, top }, style]} pointerEvents="none">
      <MaterialCommunityIcons name="star-four-points" size={size} color={C.GOLD} />
    </Reanimated.View>
  );
}

/* ---------------- screen ---------------- */

export default function Rewards() {
  const tabSpace = useTabBarSpace();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts(AUTH_FONTS);
  const still = useReducedMotion();

  const rewards = useRewardsStore((state) => state.rewards);
  const loading = useRewardsStore((state) => state.loading);
  const fetchRewards = useRewardsStore((state) => state.fetchRewards);

  // Refresh each time the tab opens (e.g. after chanting).
  useFocusEffect(
    useCallback(() => {
      fetchRewards();
    }, [fetchRewards])
  );

  const earnedToday = rewards?.today?.earned ?? 0;
  const dailyMaximum = rewards?.today?.maximum ?? 10;
  const progress = dailyMaximum > 0 ? Math.min(earnedToday / dailyMaximum, 1) : 0;
  const reached = earnedToday >= dailyMaximum;

  const activities: {
    type: "mantra_daily" | "conversation_daily" | "insight_daily";
    title: string;
    description: string;
    icon: IconName;
    open: () => void;
  }[] = [
    {
      type: "mantra_daily",
      title: "Complete today’s Mantra Jaap",
      description: "Keep your daily chanting practice going",
      icon: "om",
      open: () => router.push("/(root)/(tabs)/mantra" as any),
    },
    {
      type: "conversation_daily",
      title: "Have a conversation",
      description: "Get guidance from AI or an astrologer",
      icon: "message-outline",
      open: () => router.push("/(root)/(tabs)/chat" as any),
    },
    {
      type: "insight_daily",
      title: "Read your daily insights",
      description: "Check your personalised guidance",
      icon: "file-document-outline",
      open: () => router.push("/(root)/(tabs)/my_life" as any),
    },
  ];

  const streak = rewards?.mantraStreak ?? { current: 0, target: 7, bonus: 20, days: 0, completedToday: false };
  const doneCount = activities.filter((a) => rewards?.activities?.[a.type]?.completed).length;

  return (
    <View style={st.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: HOME_PAD, paddingTop: insets.top + 4, paddingBottom: tabSpace + 24 }}
      >
        <TopBar />

        {!fontsLoaded || (loading && !rewards) ? (
          <View style={st.loading}>
            <ActivityIndicator size="large" color={C.PLUM} />
          </View>
        ) : (
          <>
            <Reanimated.View entering={enter(0)}>
              <Text style={st.title}>Rewards</Text>
              <Text style={st.subtitle}>Stay consistent, complete daily activities and earn</Text>
            </Reanimated.View>

            {/* Today's rewards */}
            <Reanimated.View entering={enter(1)} style={st.hero}>
              <View style={st.heroClip}>
                <CardArt width={200} height={140} color={C.CARD} />
                <Shine still={still} />
                {SPARKLES.map((sparkle, i) => (
                  <Sparkle key={i} {...sparkle} still={still} />
                ))}

                <View style={st.heroRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={st.heroOverline}>TODAY’S REWARDS</Text>
                    <Text style={st.heroTitle}>
                      {earnedToday > dailyMaximum ? `₹${earnedToday} earned` : `₹${earnedToday} of ₹${dailyMaximum}`}
                    </Text>
                    <Text style={st.heroText}>
                      {reached
                        ? `Today’s ₹${dailyMaximum} target reached. Every extra 108 chants earns more.`
                        : `Complete activities to earn ₹${dailyMaximum} today. Every extra 108 chants earns more.`}
                    </Text>
                  </View>
                  <TodayRing progress={progress} earned={earnedToday} still={still} />
                </View>

                <View style={st.heroFoot}>
                  <MaterialCommunityIcons name="check-circle-outline" size={15} color={C.GOLD} />
                  <Text style={st.heroFootText}>
                    {doneCount} of {activities.length} activities done today
                  </Text>
                </View>
              </View>
            </Reanimated.View>

            {/* Today's activities */}
            <Reanimated.View entering={enter(2)}>
              <SectionHeader overline="EARN EVERY DAY" title="Today’s activities" />
              <View style={{ gap: 10 }}>
                {activities.map((activity) => {
                  const data = rewards?.activities?.[activity.type];
                  const completed = data?.completed ?? false;
                  const credits = data?.credits ?? 0;

                  return (
                    <TouchableOpacity
                      key={activity.type}
                      accessibilityRole="button"
                      accessibilityLabel={`${activity.title}, ${completed ? "done" : `earn ₹${credits}`}`}
                      activeOpacity={0.9}
                      onPress={activity.open}
                      style={[st.activity, completed && st.activityDone]}
                    >
                      <View style={[st.activityIcon, completed && st.activityIconDone]}>
                        <MaterialCommunityIcons
                          name={completed ? "check" : activity.icon}
                          size={20}
                          color={completed ? C.CARD : C.PLUM}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={st.activityTitle} numberOfLines={1}>
                          {activity.title}
                        </Text>
                        <Text style={st.activityText} numberOfLines={2}>
                          {activity.description}
                        </Text>
                      </View>
                      <View style={[st.credit, completed && st.creditDone]}>
                        <Text style={[st.creditText, completed && { color: GREEN }]}>+₹{credits}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Reanimated.View>

            {/* Mantra streak */}
            <Reanimated.View entering={enter(3)}>
              <SectionHeader overline="KEEP IT GOING" title="Mantra streak" />
              <View style={st.streak}>
                <View style={st.streakTop}>
                  <View style={st.streakIcon}>
                    <MaterialCommunityIcons name="fire" size={22} color={C.GOLD} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.streakTitle}>{streak.target}-day mantra streak</Text>
                    <Text style={st.streakText}>
                      {streak.days > 0
                        ? `${streak.days} day${streak.days > 1 ? "s" : ""} in a row${streak.completedToday ? " · today is done" : ""}`
                        : "Chant 108 times today to start your streak."}
                    </Text>
                  </View>
                  <View style={st.bonus}>
                    <MaterialCommunityIcons name="gift-outline" size={12} color={GOLD_TEXT} />
                    <Text style={st.bonusText}>₹{streak.bonus} bonus</Text>
                  </View>
                </View>

                <View style={st.days}>
                  {Array.from({ length: streak.target }, (_, i) => {
                    const done = i < streak.current;
                    const today = i === streak.current && !streak.completedToday;
                    return (
                      <View key={i} style={st.dayCol}>
                        <View style={[st.day, done && st.dayDone, today && st.dayToday]}>
                          {done && <MaterialCommunityIcons name="check" size={13} color={C.CARD} />}
                        </View>
                        <Text style={[st.dayLabel, done && { color: C.PLUM }]}>D{i + 1}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Reanimated.View>

            {/* Leaderboard */}
            <Reanimated.View entering={enter(4)}>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.9}
                onPress={() => router.push("/(root)/(tabs)/leaderboard")}
                style={st.board}
              >
                <View style={st.boardClip}>
                  <CardArt width={170} height={110} color={C.CARD} />
                  <View style={st.boardIcon}>
                    <MaterialCommunityIcons name="trophy-outline" size={24} color={C.GOLD} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.boardTitle}>Mantra leaderboard</Text>
                    <Text style={st.boardText}>See today’s top chanters. Every chant you do counts.</Text>
                  </View>
                  <View style={st.boardArrow}>
                    <MaterialCommunityIcons name="arrow-right" size={16} color={C.INK} />
                  </View>
                </View>
              </TouchableOpacity>

              {/* More ways to earn */}
              <View style={st.more}>
                <View style={st.moreIcon}>
                  <MaterialCommunityIcons name="gift-outline" size={20} color={C.PLUM} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={st.moreTitle}>More ways to earn</Text>
                  <Text style={st.moreText}>Refer friends and earn rewards.</Text>
                </View>
                <View style={st.soon}>
                  <Text style={st.soonText}>Coming soon</Text>
                </View>
              </View>
            </Reanimated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.LAVENDER },
  loading: { height: 320, alignItems: "center", justifyContent: "center" },
  title: { marginTop: 14, color: C.INK, fontSize: 26, fontFamily: F.bold, letterSpacing: -0.4 },
  subtitle: { marginTop: 2, marginBottom: 14, color: C.MUTED, fontSize: 13.5, fontFamily: F.regular },

  hero: { borderRadius: 26, backgroundColor: C.PLUM, ...softShadow, shadowOpacity: 0.25 },
  heroClip: { borderRadius: 26, overflow: "hidden", padding: 18, backgroundColor: C.PLUM },
  heroRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  heroOverline: { color: "rgba(255,253,252,0.65)", fontSize: 11, fontFamily: F.bold, letterSpacing: 1.6 },
  heroTitle: { marginTop: 6, color: C.CARD, fontSize: 22, lineHeight: 27, fontFamily: F.bold, letterSpacing: -0.3 },
  heroText: { marginTop: 6, color: "rgba(255,253,252,0.78)", fontSize: 12.5, lineHeight: 18, fontFamily: F.regular },
  heroFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,253,252,0.14)",
  },
  heroFootText: { color: "rgba(255,253,252,0.85)", fontSize: 12.5, fontFamily: F.semibold },
  ringValue: { color: C.CARD, fontSize: 22, lineHeight: 26, fontFamily: F.bold },
  ringGlow: { position: "absolute", width: RING, height: RING, borderRadius: RING / 2, backgroundColor: C.GOLD },
  rupee: { color: C.GOLD, fontSize: 15, fontFamily: F.bold },
  shine: { position: "absolute", top: -60, bottom: -60, left: -40, width: 90 },
  ringLabel: { color: "rgba(255,253,252,0.65)", fontSize: 10.5, fontFamily: F.medium },

  activity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    ...softShadow,
    shadowOpacity: 0.05,
  },
  activityDone: { backgroundColor: "#F3F9F4", borderColor: "#D4E8DA" },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.SOFT,
    borderWidth: 1,
    borderColor: "rgba(43,26,61,0.14)",
  },
  activityIconDone: { backgroundColor: GREEN, borderColor: GREEN },
  activityTitle: { color: C.INK, fontSize: 14.5, fontFamily: F.bold },
  activityText: { marginTop: 2, color: C.MUTED, fontSize: 12, lineHeight: 16.5, fontFamily: F.regular },
  credit: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.IVORY,
    borderWidth: 1,
    borderColor: "#E6D9C4",
  },
  creditDone: { backgroundColor: GREEN_SOFT, borderColor: "#CFE6D6" },
  creditText: { color: GOLD_TEXT, fontSize: 13, fontFamily: F.bold },

  streak: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: C.IVORY,
    borderWidth: 1,
    borderColor: "#E6D9C4",
    ...softShadow,
    shadowOpacity: 0.05,
  },
  streakTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  streakIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: "#E6D9C4",
  },
  streakTitle: { color: C.INK, fontSize: 15.5, fontFamily: F.bold },
  streakText: { marginTop: 2, color: C.MUTED, fontSize: 12, lineHeight: 16.5, fontFamily: F.regular },
  bonus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: "#E6D9C4",
  },
  bonusText: { color: GOLD_TEXT, fontSize: 11.5, fontFamily: F.bold },
  days: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  dayCol: { alignItems: "center", gap: 5 },
  day: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: "#E6D9C4",
  },
  dayDone: { backgroundColor: C.PLUM, borderColor: C.PLUM },
  dayToday: { borderColor: C.GOLD, borderWidth: 2 },
  dayLabel: { color: C.MUTED, fontSize: 10.5, fontFamily: F.semibold },

  board: { marginTop: 30, borderRadius: 22, backgroundColor: C.INK, ...softShadow, shadowOpacity: 0.2 },
  boardClip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: C.INK,
  },
  boardIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,253,252,0.08)",
    borderWidth: 1,
    borderColor: "rgba(196,154,74,0.45)",
  },
  boardTitle: { color: C.CARD, fontSize: 16, fontFamily: F.bold },
  boardText: { marginTop: 2, color: "rgba(255,253,252,0.72)", fontSize: 12.5, lineHeight: 17.5, fontFamily: F.regular },
  boardArrow: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: C.CARD },

  more: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,253,252,0.7)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: C.BORDER,
  },
  moreIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: C.SOFT },
  moreTitle: { color: C.INK, fontSize: 14.5, fontFamily: F.bold },
  moreText: { marginTop: 2, color: C.MUTED, fontSize: 12, fontFamily: F.regular },
  soon: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: C.SOFT },
  soonText: { color: C.PLUM, fontSize: 11, fontFamily: F.semibold },
});
