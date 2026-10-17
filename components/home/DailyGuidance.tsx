import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Reanimated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { useLanguage, useT } from "../../lib/i18n";
import { loadMyLifeHoroscope, useMyLifeStore } from "../stores/myLifeStore";
import useProfilesStore from "../stores/profilesStore";
import { useUserStore } from "../stores/userStore";
import { hasBirthDetails } from "../utils/birthDetails";
import { C, F, LIST_BOTTOM, softShadow } from "./homeUi";

const AnimatedPath = Reanimated.createAnimatedComponent(Path);

type AreaKey = "love" | "career" | "money" | "health" | "travel";

// labelKey: shown with t() at render time, so it follows the app language.
const AREAS: { key: AreaKey; labelKey: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: "love", labelKey: "home.area.love", icon: "heart-outline" },
  { key: "career", labelKey: "home.area.career", icon: "briefcase-outline" },
  { key: "money", labelKey: "home.area.money", icon: "wallet-outline" },
  { key: "health", labelKey: "home.area.health", icon: "meditation" },
  { key: "travel", labelKey: "home.area.travel", icon: "airplane" },
];

// Zodiac signs the backend sends in English, shown in the app language.
const SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(" ");
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    return toText(v.description ?? v.text ?? v.name ?? v.title);
  }
  return "";
};

const todayLabel = (language: string) =>
  new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

// Same wording as My Life's "Overall energy" (translation key).
const energyKey = (score: number) =>
  score >= 80 ? "home.energy.high" : score >= 70 ? "home.energy.balanced" : "home.energy.gentle";

/* ---------------- sky: background by time of day (palette only) ---------------- */

// Hour of the day in IST (with minutes).
const istHour = () => ((Date.now() / 3600000 + 5.5) % 24 + 24) % 24;

type Sky = { colors: [string, string, string]; stars: boolean };

function skyFor(hour: number): Sky {
  if (hour >= 5 && hour < 11) return { colors: ["#DDD0EC", "#E6DDF0", "#EFE6EA"], stars: false }; // morning
  if (hour >= 11 && hour < 16) return { colors: ["#EADBC6", "#F0E4D4", "#F5ECE0"], stars: false }; // midday
  if (hour >= 16 && hour < 19) return { colors: ["#E8D6C6", "#DDCDE4", "#D3C3E3"], stars: true }; // evening
  return { colors: ["#CDBEE0", "#D8CCE7", "#E3DAEE"], stars: true }; // night
}

/* ---------------- day arc: the sun (or moon) travels across the card ---------------- */

const ARC_H = 112;
const BASE_Y = 98; // horizon
const EDGE = 26;
const TOP_Y = -40; // curve control point (apex sits halfway, clear of the score)

// Day 6 AM–6 PM is the sun's arc; the rest is the moon's.
function skyPosition(hour: number) {
  const day = hour >= 6 && hour < 18;
  const t = day ? (hour - 6) / 12 : (((hour - 18) + 24) % 24) / 12;
  return { day, t: Math.max(0, Math.min(1, t)) };
}

// Point on the arc (quadratic curve from the left edge, over the top, to the right).
function arcX(w: number, t: number) {
  "worklet";
  const u = 1 - t;
  return u * u * EDGE + 2 * u * t * (w / 2) + t * t * (w - EDGE);
}
function arcY(t: number) {
  "worklet";
  const u = 1 - t;
  return u * u * BASE_Y + 2 * u * t * TOP_Y + t * t * BASE_Y;
}

// A few fixed stars above the horizon (fractions of the width, px from top).
const STARS = [
  { x: 0.12, y: 30, r: 1.6, delay: 0 },
  { x: 0.24, y: 58, r: 1.1, delay: 900 },
  { x: 0.36, y: 18, r: 1.3, delay: 400 },
  { x: 0.63, y: 22, r: 1.2, delay: 1300 },
  { x: 0.76, y: 50, r: 1.6, delay: 700 },
  { x: 0.88, y: 26, r: 1.1, delay: 1700 },
];

function Star({ x, y, r, delay, still }: { x: number; y: number; r: number; delay: number; still: boolean }) {
  const glow = useSharedValue(0.5);
  useEffect(() => {
    if (still) return;
    glow.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0.25, { duration: 1400 })), -1)
    );
  }, [delay, glow, still]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  const size = r * 2 + 2;
  return (
    <Reanimated.View
      style={[
        { position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size },
        style,
      ]}
    >
      <MaterialCommunityIcons name="star-four-points" size={size + 4} color={C.GOLD} style={{ margin: -2 }} />
    </Reanimated.View>
  );
}

// Sun rays: a ring of short lines that slowly turns.
function Rays({ size }: { size: number }) {
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        const r1 = c * 0.62;
        const r2 = c * (i % 2 ? 0.8 : 0.92);
        return (
          <Line
            key={i}
            x1={c + r1 * Math.cos(a)}
            y1={c + r1 * Math.sin(a)}
            x2={c + r2 * Math.cos(a)}
            y2={c + r2 * Math.sin(a)}
            stroke={C.GOLD}
            strokeWidth={1.4}
            strokeLinecap="round"
            opacity={0.7}
          />
        );
      })}
    </Svg>
  );
}

const SUN = 44; // sun area (halo + rays)

function DayArc({ width, hour, stars }: { width: number; hour: number; stars: boolean }) {
  const tr = useT();
  const { day, t } = skyPosition(hour);
  const tone = day ? C.GOLD : C.PLUM;
  const still = useReducedMotion();

  // Glide from the start of the arc to now when Home opens.
  const progress = useSharedValue(still ? t : 0);
  const pulse = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    progress.value = still ? t : withTiming(t, { duration: 1600, easing: Easing.out(Easing.cubic) });
  }, [progress, still, t]);

  useEffect(() => {
    if (still) return;
    pulse.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
    spin.value = withRepeat(withTiming(360, { duration: 40000, easing: Easing.linear }), -1);
  }, [pulse, spin, still]);

  // Path already travelled: the same curve cut at the current point.
  const travelledProps = useAnimatedProps(() => {
    const p = progress.value;
    const cx = EDGE + p * (width / 2 - EDGE);
    const cy = BASE_Y + p * (TOP_Y - BASE_Y);
    return { d: `M${EDGE} ${BASE_Y} Q${cx} ${cy} ${arcX(width, p)} ${arcY(p)}` };
  });

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: arcX(width, progress.value) - SUN / 2 },
      { translateY: arcY(progress.value) - SUN / 2 },
    ],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.32 - 0.16 * pulse.value,
    transform: [{ scale: 1 + 0.28 * pulse.value }],
  }));
  const raysStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  const full = `M${EDGE} ${BASE_Y} Q${width / 2} ${TOP_Y} ${width - EDGE} ${BASE_Y}`;

  return (
    <View style={{ height: ARC_H }} pointerEvents="none">
      {stars && STARS.map((s, i) => <Star key={i} x={s.x * width} y={s.y} r={s.r} delay={s.delay} still={still} />)}

      <Svg width={width} height={ARC_H} style={StyleSheet.absoluteFill}>
        <Line x1={EDGE - 10} y1={BASE_Y} x2={width - EDGE + 10} y2={BASE_Y} stroke={C.BORDER} strokeWidth={1} />
        <Path d={full} stroke={tone} strokeOpacity={0.35} strokeWidth={1.2} strokeDasharray="2 5" fill="none" />
        <AnimatedPath
          animatedProps={travelledProps}
          stroke={tone}
          strokeOpacity={0.9}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx={EDGE} cy={BASE_Y} r={3} fill={tone} opacity={0.7} />
        <Circle cx={width - EDGE} cy={BASE_Y} r={3} fill={tone} opacity={0.35} />
      </Svg>

      {/* Sun (day) or moon (night), gliding along the arc */}
      <Reanimated.View style={[styles.body, bodyStyle]}>
        <Reanimated.View
          style={[styles.halo, { backgroundColor: day ? C.GOLD : C.PLUM }, haloStyle]}
        />
        {day ? (
          <>
            <Reanimated.View style={[StyleSheet.absoluteFill, raysStyle]}>
              <Rays size={SUN} />
            </Reanimated.View>
            <View style={styles.sun} />
          </>
        ) : (
          <MaterialCommunityIcons name="moon-waning-crescent" size={20} color={C.PLUM} />
        )}
      </Reanimated.View>

      <Text style={[styles.arcLabel, { left: EDGE - 10 }]}>{day ? tr("home.arc.sixAm") : tr("home.arc.sixPm")}</Text>
      <Text style={[styles.arcLabel, { right: EDGE - 10 }]}>{day ? tr("home.arc.sixPm") : tr("home.arc.sixAm")}</Text>
    </View>
  );
}

// Counts up to the score when it appears.
function useCountUp(target: number | null, still: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null || still) return;
    const start = Date.now();
    const duration = 1100;
    let frame = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, still]);
  return still && target !== null ? target : value;
}

/* ---------------- Home hero ---------------- */

export default function DailyGuidance() {
  const t = useT();
  const language = useLanguage();
  const activeProfileId = useUserStore((state) => state.user?.active_profile_id);
  const today = useMyLifeStore((state) =>
    activeProfileId ? state.profiles[activeProfileId]?.daily : null
  );
  const activeProfile = useProfilesStore((state) =>
    state.profiles.find((profile) => profile.profile_id === activeProfileId)
  );

  // No birth place/time yet: nothing to calculate, ask to complete the profile.
  const needsBirthDetails = Boolean(activeProfile) && !hasBirthDetails(activeProfile);
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState(0);
  const [hour, setHour] = useState(istHour);
  const still = useReducedMotion();

  useEffect(() => {
    if (!activeProfileId || needsBirthDetails) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Same Daily horoscope as the My Life screen.
        await loadMyLifeHoroscope("daily", activeProfileId);
      } catch (error) {
        if (!cancelled) console.error("Home Today guidance error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // language: reload the reading in a newly chosen language.
  }, [activeProfileId, needsBirthDetails, language]);

  // Move the sun along every few minutes.
  useEffect(() => {
    const timer = setInterval(() => setHour(istHour()), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const areas = AREAS.map((area) => {
    const score = Number(today?.areas?.[area.key]?.score);
    return { ...area, score: Number.isFinite(score) ? Math.round(score) : null };
  });
  const scored = areas.filter((a) => a.score !== null) as { score: number }[];
  const overall =
    scored.length && !needsBirthDetails
      ? Math.round(scored.reduce((sum, a) => sum + a.score, 0) / scored.length)
      : null;
  const shownScore = useCountUp(overall, still);

  const sky = skyFor(hour);
  const sign = toText(today?.sign);
  const signKey = sign.toLowerCase();
  const signLabel = SIGNS.includes(signKey) ? t(`home.sign.${signKey}`) : sign;
  const title = needsBirthDetails
    ? t("home.guidance.completeTitle")
    : toText(today?.title) || t("home.guidance.defaultTitle");
  const text = needsBirthDetails
    ? activeProfile?.name
      ? t("home.guidance.completeText", { name: activeProfile.name })
      : t("home.guidance.completeTextNoName")
    : toText(today?.text) ||
      (loading ? t("home.guidance.loading") : t("home.guidance.empty"));
  const ctaLabel = needsBirthDetails ? t("home.guidance.completeCta") : t("home.guidance.readCta");

  const openGuidance = () =>
    needsBirthDetails
      ? router.push({ pathname: "/profile/edit_profile", params: { profileId: activeProfileId as string } })
      : router.push("/(root)/(tabs)/my_life");

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.card}>
      <View style={styles.clip} onLayout={onLayout}>
        <LinearGradient colors={sky.colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />

        {width > 0 && <DayArc width={width} hour={hour} stars={sky.stars} />}

        {/* Overall energy, framed by the arc */}
        <View style={styles.score} pointerEvents="none">
          {overall !== null ? (
            <>
              <Text style={styles.scoreValue}>{shownScore}</Text>
              <Text style={styles.scoreLabel} numberOfLines={1}>
                {t(energyKey(overall))}
              </Text>
            </>
          ) : loading ? (
            <ActivityIndicator color={C.PLUM} style={{ marginTop: 6 }} />
          ) : (
            <MaterialCommunityIcons name="star-four-points-outline" size={26} color={C.PLUM} style={{ marginTop: 6 }} />
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.meta}>
            <Text style={styles.date} numberOfLines={1}>
              {todayLabel(language)}
            </Text>
            {!!sign && !needsBirthDetails && (
              <View style={styles.chip}>
                <MaterialCommunityIcons name="moon-waning-crescent" size={12} color={C.PLUM} />
                <Text style={styles.chipText} numberOfLines={1}>
                  {t("home.guidance.moonIn", { sign: signLabel })}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.text} numberOfLines={3}>
            {text}
          </Text>

          {scored.length > 0 && !needsBirthDetails && (
            <View style={styles.areas}>
              {areas.map((area, index) => (
                <View key={area.key} style={[styles.area, index > 0 && styles.areaLine]}>
                  <MaterialCommunityIcons name={area.icon} size={16} color={C.PLUM} />
                  <Text style={styles.areaScore}>{area.score ?? "–"}</Text>
                  <Text style={styles.areaLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                    {t(area.labelKey)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            onPress={openGuidance}
            activeOpacity={0.85}
            style={styles.cta}
          >
            <Text style={styles.ctaText} numberOfLines={1}>
              {ctaLabel}
            </Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color={C.CARD} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: LIST_BOTTOM, borderRadius: 26, backgroundColor: C.IVORY, ...softShadow },
  clip: { borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: C.LINE },
  arcLabel: { position: "absolute", top: BASE_Y + 4, color: C.MUTED, fontSize: 10, fontFamily: F.medium },
  body: { position: "absolute", left: 0, top: 0, width: SUN, height: SUN, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 30, height: 30, borderRadius: 15 },
  sun: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: C.GOLD,
    shadowColor: C.GOLD,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  score: { position: "absolute", top: 48, left: 0, right: 0, alignItems: "center" },
  scoreValue: { color: C.PLUM, fontSize: 30, lineHeight: 33, fontFamily: F.bold, letterSpacing: -0.5 },
  scoreLabel: { color: C.MUTED, fontSize: 11.5, fontFamily: F.semibold, marginTop: 1 },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  date: { flexShrink: 1, color: C.PLUM, fontSize: 11, fontFamily: F.bold, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(43,26,61,0.07)",
  },
  chipText: { color: C.PLUM, fontSize: 11.5, fontFamily: F.semibold },
  title: { color: C.INK, fontSize: 23, lineHeight: 29, fontFamily: F.bold, letterSpacing: -0.4 },
  text: { color: C.MUTED, fontSize: 14, lineHeight: 21, fontFamily: F.regular, marginTop: 6 },
  areas: {
    flexDirection: "row",
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(255,253,252,0.85)",
    borderWidth: 1,
    borderColor: C.LINE,
  },
  area: { flex: 1, alignItems: "center", gap: 2 },
  areaLine: { borderLeftWidth: 1, borderLeftColor: C.LINE },
  areaScore: { color: C.INK, fontSize: 15, fontFamily: F.bold, marginTop: 2 },
  areaLabel: { color: C.MUTED, fontSize: 10.5, fontFamily: F.medium },
  cta: {
    marginTop: 20,
    height: 48,
    borderRadius: 999,
    backgroundColor: C.PLUM,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { color: C.CARD, fontSize: 14.5, fontFamily: F.bold },
});
