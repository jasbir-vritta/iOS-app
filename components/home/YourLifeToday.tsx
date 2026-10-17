import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Dimensions,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { useT } from "../../lib/i18n";
import { useMyLifeStore } from "../stores/myLifeStore";
import { useUserStore } from "../stores/userStore";
import {
  C,
  F,
  HOME_PAD,
  LIST_BOTTOM,
  LIST_TOP,
  normalizeStatus,
  SectionHeader,
  softShadow,
  STATUS,
} from "./homeUi";

const GAP = 10;
const CARD_WIDTH_FRACTION = 0.46; // about two cards and a peek
const CARD_H = 210;

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type AreaKey = "love" | "career" | "money" | "health" | "travel";

// Same text clean-up as My Life: the API may send strings, arrays or objects.
const toText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    return toText(v.description ?? v.text ?? v.name ?? v.title ?? v.details);
  }
  return "";
};

/*
 * Each area has its own look, from the locked palette only:
 * two dark cards (Ink, Plum) between three light ones (Lavender, Ivory, Card).
 * `fg` is the text colour (rgb), `accent` drives the badge, bar and art.
 */
type Look = {
  bg: string;
  border: string;
  fg: string;
  accent: string;
  art: "heart" | "steps" | "coin" | "lotus" | "flight";
};

const LIGHT = "255,253,252";
const DARK = "28,24,32";

// titleKey / shortKey: shown with t() at render time.
const AREAS: { key: AreaKey; titleKey: string; shortKey: string; icon: IconName; look: Look }[] = [
  {
    key: "love",
    titleKey: "home.life.love",
    shortKey: "home.area.love",
    icon: "heart-outline",
    look: { bg: "#EFE8F7", border: "#DCCFEA", fg: DARK, accent: C.PLUM, art: "heart" },
  },
  {
    key: "career",
    titleKey: "home.life.career",
    shortKey: "home.area.career",
    icon: "briefcase-outline",
    look: { bg: C.INK, border: C.INK, fg: LIGHT, accent: C.IVORY, art: "steps" },
  },
  {
    key: "money",
    titleKey: "home.life.money",
    shortKey: "home.area.money",
    icon: "wallet-outline",
    look: { bg: C.IVORY, border: "#E6D9C4", fg: DARK, accent: "#8A6A2E", art: "coin" },
  },
  {
    key: "health",
    titleKey: "home.life.health",
    shortKey: "home.area.health",
    icon: "meditation",
    look: { bg: C.CARD, border: C.LINE, fg: DARK, accent: C.PLUM, art: "lotus" },
  },
  {
    key: "travel",
    titleKey: "home.life.travel",
    shortKey: "home.area.travel",
    icon: "airplane",
    look: { bg: C.PLUM, border: C.PLUM, fg: LIGHT, accent: C.GOLD, art: "flight" },
  },
];

/* Faint artwork in the card corner, one per area. */
function Art({ kind, color, w }: { kind: Look["art"]; color: string; w: number }) {
  const o = 0.14;
  if (kind === "heart") {
    return (
      <MaterialCommunityIcons name="heart" size={120} color={color} style={[styles.art, { right: -26, bottom: -30, opacity: 0.08 }]} />
    );
  }
  if (kind === "lotus") {
    return (
      <MaterialCommunityIcons name="flower-tulip-outline" size={118} color={color} style={[styles.art, { right: -24, bottom: -22, opacity: 0.09 }]} />
    );
  }
  if (kind === "coin") {
    return (
      <Svg width={130} height={130} style={[styles.art, { right: -40, bottom: -40 }]}>
        <Circle cx={65} cy={65} r={58} stroke={color} strokeOpacity={o + 0.06} strokeWidth={2} fill="none" />
        <Circle cx={65} cy={65} r={44} stroke={color} strokeOpacity={o} strokeWidth={1} fill="none" strokeDasharray="3 4" />
        <Circle cx={65} cy={65} r={30} fill={color} fillOpacity={0.08} />
      </Svg>
    );
  }
  if (kind === "steps") {
    // Rising bars: growth.
    return (
      <Svg width={110} height={90} style={[styles.art, { right: 10, bottom: 52 }]}>
        {[0, 1, 2, 3].map((i) => (
          <Path
            key={i}
            d={`M${8 + i * 26} 90 V${70 - i * 18} h16 V90`}
            fill={color}
            fillOpacity={0.06 + i * 0.025}
          />
        ))}
      </Svg>
    );
  }
  // Travel: a dotted flight path with a plane.
  return (
    <View style={[styles.art, { right: 0, top: 0 }]}>
      <Svg width={w} height={90}>
        <Path
          d={`M${w * 0.18} 82 Q${w * 0.6} -6 ${w - 14} 34`}
          stroke={color}
          strokeOpacity={0.45}
          strokeWidth={1.4}
          strokeDasharray="2 6"
          fill="none"
        />
        <Circle cx={w * 0.18} cy={82} r={2.5} fill={color} opacity={0.6} />
      </Svg>
      <MaterialCommunityIcons
        name="airplane"
        size={16}
        color={color}
        style={{ position: "absolute", right: 6, top: 25, transform: [{ rotate: "35deg" }], opacity: 0.8 }}
      />
    </View>
  );
}

const openMyLife = () => router.push("/(root)/(tabs)/my_life" as any);

type AreaData = { score?: unknown; status?: unknown; title?: unknown; description?: unknown; text?: unknown } | undefined;

/* One life area: tap to flip over and read today's full description. */
function AreaCard({ area, data, width }: { area: (typeof AREAS)[number]; data: AreaData; width: number }) {
  const t = useT();
  const look = area.look;
  const title = t(area.titleKey);
  const fg = (alpha: number) => `rgba(${look.fg},${alpha})`;
  const dark = look.fg === LIGHT;

  const score = Number(data?.score);
  const hasScore = Number.isFinite(score);
  const status = STATUS[normalizeStatus(data?.status)];
  const statusLabel = t(status.labelKey);
  const summary =
    toText(data?.title) || toText(data?.description || data?.text) || t("home.life.tapToSee");
  const full =
    toText(data?.description || data?.text) || toText(data?.title) || t("home.life.empty");

  // 0 = front, 1 = back.
  const still = useReducedMotion();
  const turn = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);

  const flip = () => {
    const next = !flipped;
    setFlipped(next);
    turn.value = withTiming(next ? 1 : 0, { duration: still ? 0 : 520, easing: Easing.out(Easing.cubic) });
  };

  const frontStyle = useAnimatedStyle(() => ({
    opacity: turn.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(turn.value, [0, 1], [0, 180])}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: turn.value >= 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(turn.value, [0, 1], [180, 360])}deg` }],
  }));

  const face = [styles.face, { backgroundColor: look.bg, borderColor: look.border }];

  return (
    <View style={[styles.card, { width, backgroundColor: look.bg }]}>
      {/* Front */}
      <Reanimated.View style={[StyleSheet.absoluteFill, frontStyle]} pointerEvents={flipped ? "none" : "auto"}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={
            data
              ? t("home.life.a11yFront", { title, status: statusLabel })
              : t("home.life.a11yFrontEmpty", { title })
          }
          activeOpacity={0.92}
          onPress={flip}
          style={face}
        >
          <Art kind={look.art} color={look.accent} w={width} />

          <View style={styles.top}>
            <View
              style={[
                styles.badge,
                dark
                  ? { backgroundColor: fg(0.1), borderColor: fg(0.22) }
                  : { backgroundColor: C.CARD, borderColor: "rgba(43,26,61,0.14)" },
              ]}
            >
              <MaterialCommunityIcons name={area.icon} size={18} color={dark ? fg(1) : look.accent} />
            </View>
            {!!data && (
              <View style={[styles.pill, { backgroundColor: status.bg }]}>
                <View style={[styles.dot, { backgroundColor: status.color }]} />
                <Text style={[styles.pillText, { color: status.color }]} numberOfLines={1}>
                  {statusLabel}
                </Text>
              </View>
            )}
          </View>

          <View style={{ flex: 1 }} />

          <Text style={[styles.title, { color: fg(1) }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.description, { color: fg(dark ? 0.72 : 0.62) }]} numberOfLines={2}>
            {summary}
          </Text>

          <View style={styles.barRow}>
            <View style={[styles.barTrack, { backgroundColor: dark ? fg(0.16) : "rgba(43,26,61,0.1)" }]}>
              <View
                style={[
                  styles.barFill,
                  { backgroundColor: look.accent, width: `${hasScore ? Math.max(4, Math.min(100, score)) : 0}%` },
                ]}
              />
            </View>
            <Text style={[styles.barValue, { color: dark ? fg(1) : look.accent }]}>
              {hasScore ? Math.round(score) : "–"}
            </Text>
          </View>
        </TouchableOpacity>
      </Reanimated.View>

      {/* Back: today's full description (tap anywhere to turn it back) */}
      <Reanimated.View style={[StyleSheet.absoluteFill, backStyle]} pointerEvents={flipped ? "auto" : "none"}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("home.life.a11yBack", { title, text: full })}
          activeOpacity={0.92}
          onPress={flip}
          style={face}
        >
          <View style={styles.backHead}>
            <MaterialCommunityIcons name={area.icon} size={16} color={dark ? fg(1) : look.accent} />
            <Text style={[styles.backTitle, { color: fg(1) }]} numberOfLines={1}>
              {t(area.shortKey)}
            </Text>
            {hasScore && (
              <Text style={[styles.backScore, { color: dark ? fg(1) : look.accent }]}>{Math.round(score)}</Text>
            )}
          </View>

          {!!data && (
            <View style={[styles.pill, styles.backPill, { backgroundColor: status.bg }]}>
              <View style={[styles.dot, { backgroundColor: status.color }]} />
              <Text style={[styles.pillText, { color: status.color }]} numberOfLines={1}>
                  {statusLabel}
                </Text>
            </View>
          )}

          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.backScroll}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            <Text style={[styles.backText, { color: fg(dark ? 0.86 : 0.78) }]}>{full}</Text>
          </ScrollView>
        </TouchableOpacity>
      </Reanimated.View>
    </View>
  );
}

export default function YourLifeToday() {
  const t = useT();
  const [rowWidth, setRowWidth] = useState(Dimensions.get("window").width - HOME_PAD * 2);

  const activeProfileId = useUserStore((state) => state.user?.active_profile_id);
  const today = useMyLifeStore((state) =>
    // Same Daily horoscope as the My Life screen (loaded by DailyGuidance).
    activeProfileId ? state.profiles[activeProfileId]?.daily : null
  );

  const onLayout = (e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width);
  const cardW = Math.round(rowWidth * CARD_WIDTH_FRACTION);

  return (
    <View onLayout={onLayout}>
      <SectionHeader overline={t("home.life.overline")} title={t("home.life.title")} onViewAll={openMyLife} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardW + GAP}
        snapToAlignment="start"
        style={{ marginHorizontal: -HOME_PAD }}
        contentContainerStyle={{ paddingHorizontal: HOME_PAD, paddingTop: LIST_TOP, paddingBottom: LIST_BOTTOM, gap: GAP }}
      >
        {AREAS.map((area) => (
          <AreaCard key={area.key} area={area} data={today?.areas?.[area.key]} width={cardW} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { height: CARD_H, borderRadius: 22, ...softShadow },
  face: { flex: 1, borderRadius: 22, overflow: "hidden", borderWidth: 1, padding: 14, backfaceVisibility: "hidden" },
  art: { position: "absolute" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  pillText: { fontSize: 9.5, fontFamily: F.semibold },
  title: { fontSize: 15, lineHeight: 20, fontFamily: F.bold },
  description: { fontSize: 12, lineHeight: 17, fontFamily: F.regular, marginTop: 4, minHeight: 34 },
  barRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  barTrack: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 5, borderRadius: 3 },
  barValue: { width: 30, textAlign: "right", fontSize: 12.5, fontFamily: F.bold },
  backHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  backTitle: { flex: 1, fontSize: 14, fontFamily: F.bold },
  backScore: { fontSize: 14, fontFamily: F.bold },
  backPill: { alignSelf: "flex-start", marginTop: 8 },
  backScroll: { flex: 1, marginTop: 8 },
  backText: { fontSize: 12.5, lineHeight: 18.5, fontFamily: F.regular },
});
