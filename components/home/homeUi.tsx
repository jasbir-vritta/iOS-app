import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line } from "react-native-svg";

import { useT } from "../../lib/i18n";
import { F } from "../auth/theme";

/* Home's look: the same palette, fonts and card style as My Life. */

export { F };

export const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  LAVENDER: "#F4F0F8",
  IVORY: "#F7F1E8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  BORDER: "#D9CEC1",
  LINE: "rgba(217,206,193,0.6)",
  SOFT: "#EFE8F7", // soft plum tint for badges
  GOLD: "#C49A4A", // tiny accents only
  TERRACOTTA: "#A94C36", // human astrologers only
};

// Side margin of every Home section (cards bleed to the screen edge by this).
export const HOME_PAD = 16;

// Vertical rhythm: every section ends with LIST_BOTTOM of room (for card
// shadows) and every header starts after it, so sections are SECTION_GAP apart.
export const SECTION_GAP = 32;
export const LIST_BOTTOM = 14;
export const LIST_TOP = 2;

// Functional status colours (same as My Life). Show t(labelKey) on screen.
export const STATUS = {
  Favourable: { label: "Favourable", labelKey: "home.status.favourable", color: "#2E7D4F", bg: "#E6F2EA" },
  Neutral: { label: "Neutral", labelKey: "home.status.neutral", color: "#9A6A12", bg: "#F8EFD9" },
  Challenging: { label: "Watchful", labelKey: "home.status.watchful", color: "#B3392F", bg: "#F8E4E1" },
} as const;

export type StatusKey = keyof typeof STATUS;

export const normalizeStatus = (value: unknown): StatusKey => {
  const text = String(value ?? "").toLowerCase();
  if (/challeng|watch|avoid|unfavo|difficult|bad|negative/.test(text)) return "Challenging";
  if (/favo|good|excellent|positive|great/.test(text)) return "Favourable";
  return "Neutral";
};

export const softShadow = {
  shadowColor: C.PLUM,
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};

/* Overline + title + fine rule + optional "View all". */
export function SectionHeader({
  overline,
  title,
  onViewAll,
  viewAllLabel: viewAllProp,
}: {
  overline?: string;
  title: string;
  onViewAll?: () => void;
  viewAllLabel?: string;
}) {
  const t = useT();
  const viewAllLabel = viewAllProp ?? t("home.viewAll");
  return (
    <View style={ui.sectionWrap}>
      {!!overline && <Text style={ui.overline}>{overline}</Text>}
      <View style={ui.sectionHead}>
        <Text style={ui.sectionTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={ui.sectionRule} />
        {!!onViewAll && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("home.viewAllA11y", { label: viewAllLabel, title })}
            onPress={onViewAll}
            hitSlop={10}
            style={ui.viewAll}
          >
            <Text style={ui.viewAllText} numberOfLines={1}>
              {viewAllLabel}
            </Text>
            <Icon name="arrow-right" size={14} color={C.PLUM} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/* Faint orbit art for a card corner. */
export function CardArt({ width = 120, height = 86, color = C.PLUM }: { width?: number; height?: number; color?: string }) {
  return (
    <Svg width={width} height={height} style={ui.cardArt} pointerEvents="none">
      <Circle cx={width} cy={0} r={width * 0.62} stroke={color} strokeOpacity={0.1} fill="none" />
      <Circle cx={width} cy={0} r={width * 0.43} stroke={color} strokeOpacity={0.12} fill="none" strokeDasharray="2 5" />
      <Circle cx={width * 0.68} cy={height * 0.22} r={1.5} fill={color} opacity={0.35} />
      <Circle cx={width * 0.88} cy={height * 0.62} r={1} fill={color} opacity={0.25} />
    </Svg>
  );
}

/* Round icon badge: soft plum tint with a fine ring (or solid). */
export function Medallion({
  icon,
  size = 40,
  color = C.PLUM,
  solid = false,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  size?: number;
  color?: string;
  solid?: boolean;
}) {
  return (
    <View
      style={[
        ui.medal,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: solid ? color : C.SOFT,
          borderColor: solid ? color : "rgba(43,26,61,0.18)",
        },
      ]}
    >
      <Icon name={icon} size={size * 0.46} color={solid ? C.CARD : color} />
    </View>
  );
}

/* Progress ring with the value in the middle. */
export function Ring({
  score,
  size,
  color,
  track,
  stroke = 4,
}: {
  score: number;
  size: number;
  color: string;
  track: string;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * length;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${length}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[ui.ringText, { color, fontSize: size * 0.3 }]}>{score}</Text>
    </View>
  );
}

/* Zodiac wheel in fine light lines (as on My Life's hero). */
export const WHEEL = 280;
const WC = WHEEL / 2;
const wheelPoint = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: WC + r * Math.sin(a), y: WC - r * Math.cos(a) };
};

export function ZodiacWheel() {
  const line = (alpha: number) => `rgba(255,253,252,${alpha})`;
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const long = i % 6 === 0;
    const a = wheelPoint(i * 5, 138);
    const b = wheelPoint(i * 5, long ? 126 : 133);
    return <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
  });
  const dots = Array.from({ length: 12 }, (_, k) => {
    const p = wheelPoint(15 + k * 30, 115);
    return <Circle key={k} cx={p.x} cy={p.y} r={k % 4 === 0 ? 2.2 : 1.2} fill={k % 4 === 0 ? C.GOLD : line(0.5)} />;
  });

  return (
    <Svg width={WHEEL} height={WHEEL}>
      <G stroke={line(0.2)} strokeWidth={1} fill="none">
        <Circle cx={WC} cy={WC} r={138} />
        <Circle cx={WC} cy={WC} r={123} stroke={line(0.12)} />
        <Circle cx={WC} cy={WC} r={100} stroke={line(0.1)} strokeDasharray="2 6" />
        {ticks}
      </G>
      {dots}
    </Svg>
  );
}

const ui = StyleSheet.create({
  sectionWrap: { marginTop: SECTION_GAP - LIST_BOTTOM, marginBottom: 12, paddingHorizontal: 2 },
  overline: { color: C.PLUM, fontSize: 11, fontFamily: F.bold, letterSpacing: 1.6, marginBottom: 3, opacity: 0.8 },
  sectionHead: { flexDirection: "row", alignItems: "center" },
  sectionTitle: { flexShrink: 1, color: C.INK, fontSize: 21, fontFamily: F.bold, letterSpacing: -0.3 },
  sectionRule: { flex: 1, height: 1, marginHorizontal: 12, backgroundColor: "rgba(43,26,61,0.14)" },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewAllText: { color: C.PLUM, fontSize: 13, fontFamily: F.semibold },
  cardArt: { position: "absolute", top: 0, right: 0 },
  medal: { alignItems: "center", justifyContent: "center", borderWidth: 1, overflow: "hidden" },
  ringText: { fontFamily: F.bold },
});
