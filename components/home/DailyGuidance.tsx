import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    Dimensions,
    ImageBackground,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import {
    loadMyLifeHoroscope,
    useMyLifeStore,
} from "../stores/myLifeStore";
import useProfilesStore from "../stores/profilesStore";
import { useUserStore } from "../stores/userStore";
import { hasBirthDetails } from "../utils/birthDetails";

const GUIDANCE_BACKGROUND = require(
  "../../assets/backgrounds/homepage_top_background.png"
);

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  TERRACOTTA: "#A94C36",
  GOLD: "#C49A4A",
  IVORY: "#F7F1E8",
  MUTED: "#68616A",
  GREEN: "#26843B",
};

type AreaKey = "love" | "career" | "money" | "health" | "travel";
type Status = "Favourable" | "Neutral" | "Challenging";

type GuidanceItem = {
  label: string;
  key: AreaKey;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const GUIDANCE_ITEMS: GuidanceItem[] = [
  { label: "Love", key: "love", icon: "heart-outline" },
  { label: "Career", key: "career", icon: "briefcase-outline" },
  { label: "Money", key: "money", icon: "wallet-outline" },
  { label: "Health", key: "health", icon: "meditation" },
  { label: "Travel", key: "travel", icon: "airplane" },
];

const normalizeStatus = (value: unknown): Status => {
  const text = String(value ?? "").toLowerCase();

  if (/challeng|watch|avoid|unfavo|difficult|bad|negative/.test(text)) {
    return "Challenging";
  }

  if (/favo|good|excellent|positive|great/.test(text)) {
    return "Favourable";
  }

  return "Neutral";
};

const formatDate = (value: unknown): string => {
  const date =
    typeof value === "string" && value.trim()
      ? new Date(value)
      : new Date();

  const validDate = Number.isNaN(date.getTime())
    ? new Date()
    : date;

  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
  })
    .format(validDate)
    .toUpperCase();
};

const getStatusColor = (status: Status) => {
  switch (status) {
    case "Favourable":
      return C.GREEN;
    case "Challenging":
      return C.TERRACOTTA;
    default:
      return C.MUTED;
  }
};

const getOverallEnergy = (statuses: Status[]) => {
  const favourable = statuses.filter(
    (status) => status === "Favourable"
  ).length;

  const challenging = statuses.filter(
    (status) => status === "Challenging"
  ).length;

  if (favourable >= 3) return "Positive";
  if (challenging >= 2) return "Challenging";
  return "Balanced";
};

export default function DailyGuidance() {
  const width = Dimensions.get("window").width;
  const scale = Math.min(width, 430) / 430;
  const px = (value: number) => Math.round(value * scale);

  const activeProfileId = useUserStore(
    (state) => state.user?.active_profile_id
  );

  const today = useMyLifeStore((state) =>
    activeProfileId
      ? state.profiles[activeProfileId]?.daily
      : null
  );

  const activeProfile = useProfilesStore((state) =>
    state.profiles.find((profile) => profile.profile_id === activeProfileId)
  );

  // No birth place/time yet: nothing to calculate, ask to complete the profile.
  const needsBirthDetails =
    Boolean(activeProfile) && !hasBirthDetails(activeProfile);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeProfileId || needsBirthDetails) return;

    let cancelled = false;

    const loadToday = async () => {
      setLoading(true);

      try {
        // Same Daily horoscope as the My Life screen.
        await loadMyLifeHoroscope("daily", activeProfileId);
      } catch (error) {
        if (!cancelled) {
          console.error("Home Today guidance error:", error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadToday();

    return () => {
      cancelled = true;
    };
  }, [activeProfileId, needsBirthDetails]);

  const areas = GUIDANCE_ITEMS.map((item) => ({
    ...item,
    status: normalizeStatus(
      today?.areas?.[item.key]?.status
    ),
  }));

  const overallEnergy = getOverallEnergy(
    areas.map((area) => area.status)
  );

  const headline = needsBirthDetails
    ? "Complete your birth details"
    : today?.title ||
      "Your day, guided by the stars.";

  const description = needsBirthDetails
    ? `Add the birth date, time and place for ${activeProfile?.name || "this profile"} to see today's guidance.`
    : today?.text ||
      (loading
        ? "Preparing your personal guidance..."
        : "Your daily astrology guidance will appear here.");

  return (
    <ImageBackground
      source={GUIDANCE_BACKGROUND}
      resizeMode="cover"
      imageStyle={{ borderRadius: px(15) }}
      style={[styles.card, { minHeight: px(178) }]}
    >
      <View style={[styles.content, { padding: px(12) }]}>
        <View style={styles.left}>
          <Text style={[styles.date, { fontSize: px(8) }]}>
            {formatDate(undefined)}
          </Text>

          <Text style={[styles.heading, { fontSize: px(19) }]}>
            {headline}
          </Text>

          <Text
            numberOfLines={4}
            style={[styles.description, { fontSize: px(10) }]}
          >
            {description}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              needsBirthDetails ? "Complete profile" : "Explore today's guidance"
            }
            onPress={() =>
              needsBirthDetails
                ? router.push({
                    pathname: "/profile/edit_profile",
                    params: { profileId: activeProfileId as string },
                  })
                : router.push("/(root)/(tabs)/my_life")
            }
            style={({ pressed }) => [
              styles.button,
              {
                paddingVertical: px(8),
                paddingHorizontal: px(11),
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.buttonText, { fontSize: px(9) }]}>
              {needsBirthDetails ? "Complete Profile" : "Explore Today’s Guidance"}
            </Text>

            <MaterialCommunityIcons
              name="arrow-right"
              size={px(13)}
              color={C.IVORY}
            />
          </Pressable>
        </View>

        <View style={styles.right}>
          <View style={[styles.energyCard, { padding: px(6) }]}>
            <View style={styles.sunIcon}>
              <MaterialCommunityIcons
                name="white-balance-sunny"
                size={px(16)}
                color={C.GOLD}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.energyLabel, { fontSize: px(7) }]}>
                Overall Energy
              </Text>

              <Text
                numberOfLines={1}
                style={[
                  styles.energyValue,
                  {
                    fontSize: px(10),
                    color: getStatusColor(
                      overallEnergy === "Positive"
                        ? "Favourable"
                        : overallEnergy === "Challenging"
                          ? "Challenging"
                          : "Neutral"
                    ),
                  },
                ]}
              >
                {overallEnergy}
              </Text>
            </View>
          </View>

          <View style={[styles.statusCard, { padding: px(7) }]}>
            {areas.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.statusRow,
                  {
                    marginBottom:
                      index === areas.length - 1 ? 0 : px(7),
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={px(12)}
                  color={C.TERRACOTTA}
                />

                <Text style={[styles.statusLabel, { fontSize: px(7) }]}>
                  {item.label}
                </Text>

                <Text
                  numberOfLines={1}
                  style={[
                    styles.statusValue,
                    {
                      fontSize: px(7),
                      color: getStatusColor(item.status),
                    },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 15,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    minHeight: 178,
    flexDirection: "row",
    alignItems: "center",
  },
  left: {
    flex: 1.35,
    zIndex: 2,
    alignSelf: "stretch",
    justifyContent: "center",
    paddingRight: 5,
  },
  date: {
    color: "#B87883",
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  heading: {
    color: C.INK,
    fontWeight: "700",
    lineHeight: 22,
  },
  description: {
    color: C.MUTED,
    lineHeight: 13.5,
    marginTop: 5,
  },
  button: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: C.PLUM,
    borderRadius: 22,
  },
  buttonText: {
    color: C.IVORY,
    fontWeight: "600",
  },
  right: {
    flex: 0.95,
    zIndex: 2,
    gap: 5,
    justifyContent: "center",
  },
  energyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    backgroundColor: "rgba(255,253,252,0.94)",
  },
  sunIcon: {
    width: 23,
    height: 23,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF3D5",
  },
  energyLabel: {
    color: C.MUTED,
  },
  energyValue: {
    fontWeight: "700",
    marginTop: 1,
  },
  statusCard: {
    borderRadius: 10,
    backgroundColor: "rgba(255,253,252,0.94)",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusLabel: {
    color: C.INK,
    flex: 1,
  },
  statusValue: {
    fontWeight: "500",
    textAlign: "right",
  },
});