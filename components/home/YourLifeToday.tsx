import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
    Dimensions,
    LayoutChangeEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { useMyLifeStore } from "../stores/myLifeStore";
import { useUserStore } from "../stores/userStore";

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  MUTED: "#6B6470",
  WHITE: "#FFFFFF",
};

const scale = Math.min(Dimensions.get("window").width, 430) / 430;
const px = (value: number) => Math.round(value * scale);

const GAP = 10;
const H_PAD = 16; // must match your screen's horizontal padding
const CARD_WIDTH_FRACTION = 0.31; // card width as a fraction of the row (bigger = wider cards)
const CARD_RATIO = 1.35; // height = width * ratio

// Falls back to a safe icon if a glyph name doesn't exist in the installed version
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
const safeIcon = (name: string, fallback: string = "star-four-points"): IconName => {
  const glyphs = (MaterialCommunityIcons as any).glyphMap || {};
  return (name in glyphs ? name : fallback) as IconName;
};

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

// Shown until the selected profile's guidance has loaded (or if it has none).
const PENDING_DESCRIPTION = "Tap to see today's guidance.";

const areas = [
  {
    key: "love",
    title: "Love &\nRelationships",
    icon: "heart-outline",
    deco: "leaf",
    gradient: ["#FFD9E0", "#FFEFF2"],
    accent: "#E5405E",
  },
  {
    key: "career",
    title: "Career &\nGrowth",
    icon: "briefcase",
    deco: "image-filter-hdr",
    gradient: ["#FFE0B5", "#FFF4E2"],
    accent: "#C8691E",
  },
  {
    key: "money",
    title: "Money &\nFinance",
    icon: "cash-multiple",
    deco: "leaf",
    gradient: ["#D3F0D8", "#F0FAF1"],
    accent: "#E2A21B",
  },
  {
    key: "health",
    title: "Health &\nWellness",
    icon: "meditation",
    deco: "flower",
    gradient: ["#E6D6FA", "#F7F1FE"],
    accent: "#D6336C",
  },
] as const;

const MY_LIFE_ROUTE = "/(root)/(tabs)/my_life";

export default function YourLifeToday() {
  const [rowWidth, setRowWidth] = useState(
    Dimensions.get("window").width - H_PAD * 2
  );

  const activeProfileId = useUserStore(
    (state) => state.user?.active_profile_id
  );

  const today = useMyLifeStore((state) =>
    activeProfileId ? state.profiles[activeProfileId]?.today : null
  );

  const lifeAreas = today?.life_areas;

  const navigateToMyLife = () => {
    router.push(MY_LIFE_ROUTE as any);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    setRowWidth(e.nativeEvent.layout.width);
  };

  // every size below is derived from the card width, so it scales perfectly
  const cardW = Math.round(rowWidth * CARD_WIDTH_FRACTION);
  const cardH = Math.round(cardW * CARD_RATIO);
  const pad = Math.round(cardW * 0.09);

  const titleLH = Math.round(cardW * 0.148);
  const descLH = Math.round(cardW * 0.113);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.header}>
        <View style={styles.headingContainer}>
          <Text style={styles.heading}>Your life today</Text>
          <Text style={styles.subtitle}>
            Personalised insights for what matters most
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all life insights"
          onPress={navigateToMyLife}
          style={styles.viewAll}
          hitSlop={8}
        >
          <Text style={styles.viewAllText}>View all</Text>
          <MaterialCommunityIcons
            name="arrow-right"
            size={px(18)}
            color={C.PLUM}
          />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardW + GAP}
        snapToAlignment="start"
        style={{ marginHorizontal: -H_PAD }}
        contentContainerStyle={[
          styles.cards,
          { paddingHorizontal: H_PAD, paddingVertical: 4 },
        ]}
      >
        {areas.map((area) => {
          const apiArea = lifeAreas?.[area.key];
          const description =
            toText(apiArea?.description || apiArea?.text) ||
            PENDING_DESCRIPTION;

          return (
            <Pressable
              key={area.key}
              accessibilityRole="button"
              accessibilityLabel={`View ${area.key} guidance`}
              onPress={navigateToMyLife}
              style={({ pressed }) => [pressed && styles.cardPressed]}
            >
              <LinearGradient
                colors={area.gradient as unknown as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.card,
                  {
                    width: cardW,
                    height: cardH,
                    borderRadius: Math.round(cardW * 0.14),
                    padding: pad,
                  },
                ]}
              >
                {/* faint botanical decoration */}
                <MaterialCommunityIcons
                  name={safeIcon(area.deco, "leaf")}
                  size={Math.round(cardW * 0.85)}
                  color={area.accent}
                  style={{
                    position: "absolute",
                    right: -Math.round(cardW * 0.14),
                    bottom: -Math.round(cardW * 0.04),
                    opacity: 0.12,
                  }}
                  pointerEvents="none"
                />

                <MaterialCommunityIcons
                  name={safeIcon(area.icon)}
                  size={Math.round(cardW * 0.29)}
                  color={area.accent}
                  style={{ marginBottom: Math.round(cardW * 0.07) }}
                />

                <Text
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  allowFontScaling={false}
                  style={[
                    styles.cardTitle,
                    {
                      fontSize: Math.round(cardW * 0.118),
                      lineHeight: titleLH,
                      height: titleLH * 2, // always reserve 2 lines
                    },
                  ]}
                >
                  {area.title}
                </Text>

                <Text
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  allowFontScaling={false}
                  style={[
                    styles.cardDescription,
                    {
                      fontSize: Math.round(cardW * 0.088),
                      lineHeight: descLH,
                      height: descLH * 2, // always reserve 2 lines
                      marginTop: Math.round(cardW * 0.04),
                      paddingRight: Math.round(cardW * 0.06),
                    },
                  ]}
                >
                  {description}
                </Text>

                <View
                  style={[
                    styles.arrow,
                    {
                      right: Math.round(cardW * 0.07),
                      bottom: Math.round(cardW * 0.07),
                      width: Math.round(cardW * 0.24),
                      height: Math.round(cardW * 0.24),
                      borderRadius: Math.round(cardW * 0.12),
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={Math.round(cardW * 0.13)}
                    color={C.PLUM}
                  />
                </View>
              </LinearGradient>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: px(14),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: px(12),
  },
  headingContainer: {
    flex: 1,
  },
  heading: {
    color: C.INK,
    fontSize: px(21),
    lineHeight: px(26),
    fontWeight: "700",
  },
  subtitle: {
    color: C.MUTED,
    fontSize: px(12.5),
    lineHeight: px(17),
    marginTop: px(2),
  },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: px(6),
    marginLeft: px(8),
  },
  viewAllText: {
    color: C.PLUM,
    fontSize: px(14),
    fontWeight: "600",
  },
  cards: {
    gap: GAP,
  },
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  cardPressed: {
    opacity: 0.86,
  },
  cardTitle: {
    color: C.INK,
    fontWeight: "700",
  },
  cardDescription: {
    color: C.MUTED,
  },
  arrow: {
    position: "absolute",
    backgroundColor: C.WHITE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2B1A3D",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});