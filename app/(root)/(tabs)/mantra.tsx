import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Reanimated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { AUTH_FONTS, F } from "../../../components/auth/theme";
import mantrasData from "../../../components/constants/mantra.json";
import { C, CardArt, HOME_PAD, SectionHeader, softShadow } from "../../../components/home/homeUi";
import { useUserStore } from "../../../components/stores/userStore";
import TopBar from "../../../components/TopBar";
import { useTabBarSpace } from "../../../components/utils/tabBar";
import { track, useScreenTime } from "../../../lib/analytics";

type Mantra = {
  id: string;
  name: string;
  deity: string;
  description: string;
  categories: string[];
  icon: React.ComponentProps<typeof Icon>["name"];
  iconColor: string;
  circleColor: string;
  imageUrl: string;
  audioUrl: string;
  sanskritLyrics: string;
  reward: number;
  chantCount: number;
};

const MANTRAS = mantrasData as Mantra[];

const CATEGORIES = ["All", "Peace", "Prosperity", "Love", "Health", "Career", "Devotional"];

// Same keys as the mantra screen: chants are counted per profile, across mantras.
const ROUND = 108;
const PENDING_PREFIX = "@mantra_pending_";
const TOTAL_PREFIX = "@mantra_total_";
const LAST_PREFIX = "@mantra_last_";
const FAVORITES_PREFIX = "@mantra_favorites_";

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

// Sections rise in one after another (as on Home).
const enter = (index: number) => FadeInDown.delay(70 * index).duration(420);

const openMantra = (mantra: Mantra) => {
  router.push({
    pathname: "/(root)/mantra/[mantra_id]",
    params: { mantra_id: mantra.id, audio_url: mantra.audioUrl, image_url: mantra.imageUrl },
  });
};

/* Round progress ring that fills up to this round's chants. */
const RING = 104;
const STROKE = 7;

function RoundRing({ chants, still }: { chants: number; still: boolean }) {
  const r = (RING - STROKE) / 2;
  const length = 2 * Math.PI * r;
  const fill = useSharedValue(still ? chants / ROUND : 0);
  const glow = useSharedValue(0);

  useEffect(() => {
    fill.value = still ? chants / ROUND : withTiming(chants / ROUND, { duration: 1200, easing: Easing.out(Easing.cubic) });
  }, [chants, fill, still]);

  useEffect(() => {
    if (still) return;
    glow.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [glow, still]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - fill.value) }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + 0.14 * glow.value,
    transform: [{ scale: 1 + 0.08 * glow.value }],
  }));

  return (
    <View style={{ width: RING, height: RING, alignItems: "center", justifyContent: "center" }}>
      <Reanimated.View style={[st.ringGlow, glowStyle]} />
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
      <Text style={st.ringValue}>{chants}</Text>
      <Text style={st.ringLabel}>of {ROUND}</Text>
    </View>
  );
}

export default function MantraScreen() {
  // Analytics: visited_mantra + mantra_time_spent.
  useScreenTime("mantra");

  const tabSpace = useTabBarSpace();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts(AUTH_FONTS);
  const still = useReducedMotion();
  const profileId = useUserStore((state) => state.user?.active_profile_id);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [round, setRound] = useState<{ chants: number; lastId: string | null }>({ chants: 0, lastId: null });

  // This profile's round of 108 and favourites (refreshed whenever the tab opens).
  useFocusEffect(
    useCallback(() => {
      if (!profileId) return;
      let cancelled = false;
      (async () => {
        const [[, pending], [, total], [, lastId], [, favs]] = await AsyncStorage.multiGet([
          `${PENDING_PREFIX}${profileId}`,
          `${TOTAL_PREFIX}${profileId}`,
          `${LAST_PREFIX}${profileId}`,
          `${FAVORITES_PREFIX}${profileId}`,
        ]);
        if (cancelled) return;
        const chanted =
          Math.max(0, Math.floor(Number(total) || 0)) + Math.max(0, Math.floor(Number(pending) || 0));
        setRound({ chants: chanted % ROUND, lastId });
        try {
          const list = favs ? JSON.parse(favs) : [];
          setFavorites(Array.isArray(list) ? list.filter((id) => typeof id === "string") : []);
        } catch {
          setFavorites([]);
        }
      })().catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [profileId])
  );

  const filteredMantras = useMemo(() => {
    const query = search.trim().toLowerCase();
    return MANTRAS.filter((mantra) => {
      const matchesCategory = selectedCategory === "All" || mantra.categories.includes(selectedCategory);
      const matchesSearch =
        !query ||
        mantra.name.toLowerCase().includes(query) ||
        mantra.deity.toLowerCase().includes(query) ||
        mantra.description.toLowerCase().includes(query) ||
        mantra.categories.some((category) => category.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

  // Favourites are kept per profile on the phone.
  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      if (profileId) AsyncStorage.setItem(`${FAVORITES_PREFIX}${profileId}`, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const current = MANTRAS.find((m) => m.id === round.lastId) ?? MANTRAS[0];
  const started = round.chants > 0;

  return (
    <View style={st.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: HOME_PAD, paddingTop: insets.top + 4, paddingBottom: tabSpace + 24 }}
      >
        <TopBar />

        {/* Brand fonts first, so text doesn't jump from the system font. */}
        {fontsLoaded && (
          <>
            <Reanimated.View entering={enter(0)}>
              <Text style={st.title}>Mantras</Text>
              <Text style={st.subtitle}>Chant for peace, prosperity and positive energy</Text>
            </Reanimated.View>

            {/* Your sadhana: this round of 108 */}
            {!!current && (
              <Reanimated.View entering={enter(1)} style={st.hero}>
                <View style={st.heroClip}>
                  <CardArt width={200} height={140} color={C.CARD} />
                  <View style={st.heroRow}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={st.heroOverline}>YOUR SADHANA</Text>
                      <Text style={st.heroTitle} numberOfLines={2}>
                        {started ? current.name : "Begin today’s chanting"}
                      </Text>
                      <Text style={st.heroText} numberOfLines={2}>
                        {started
                          ? `${ROUND - round.chants} chants left in this round.`
                          : `Complete ${ROUND} chants to finish a round.`}
                      </Text>
                      <View style={st.heroReward}>
                        <Icon name="gift-outline" size={13} color={C.GOLD} />
                        <Text style={st.heroRewardText}>
                          ₹{current.reward} on {current.chantCount || ROUND} chants
                        </Text>
                      </View>
                    </View>
                    <RoundRing chants={round.chants} still={still} />
                  </View>

                  <TouchableOpacity activeOpacity={0.88} onPress={() => openMantra(current)} style={st.heroBtn}>
                    <Icon name="play" size={16} color={C.PLUM} />
                    <Text style={st.heroBtnText}>{started ? "Continue chanting" : "Start chanting"}</Text>
                  </TouchableOpacity>
                </View>
              </Reanimated.View>
            )}

            {/* Search */}
            <Reanimated.View entering={enter(2)} style={st.searchBox}>
              <Icon name="magnify" size={20} color={C.MUTED} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search mantras, deities or benefits"
                placeholderTextColor={C.MUTED}
                style={st.searchInput}
                returnKeyType="search"
                accessibilityLabel="Search mantras"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={8} accessibilityLabel="Clear search">
                  <Icon name="close-circle" size={18} color={C.MUTED} />
                </TouchableOpacity>
              )}
            </Reanimated.View>

            {/* Categories */}
            <Reanimated.View entering={enter(2)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -HOME_PAD, marginTop: 12 }}
                contentContainerStyle={{ paddingHorizontal: HOME_PAD, gap: 8 }}
              >
                {CATEGORIES.map((category) => {
                  const active = selectedCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      activeOpacity={0.85}
                      onPress={() => setSelectedCategory(category)}
                      style={[st.chip, active && st.chipActive]}
                    >
                      <Text style={[st.chipText, active && st.chipTextActive]}>{category}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Reanimated.View>

            <Reanimated.View entering={enter(3)}>
              <SectionHeader
                overline={`${filteredMantras.length} MANTRA${filteredMantras.length === 1 ? "" : "S"}`}
                title={selectedCategory === "All" ? "All mantras" : `${selectedCategory} mantras`}
              />

              <View style={{ gap: 12 }}>
                {filteredMantras.map((mantra) => {
                  const isFavorite = favorites.includes(mantra.id);
                  const hasImage = mantra.imageUrl.trim().length > 0;

                  return (
                    <TouchableOpacity
                      key={mantra.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${mantra.name}`}
                      activeOpacity={0.92}
                      onPress={() => {
                        track("mantra_clicked", {
                          mantra_id: mantra.id,
                          mantra_name: mantra.name,
                          deity: mantra.deity,
                          is_favourite: isFavorite,
                          platform: Platform.OS,
                        });
                        openMantra(mantra);
                      }}
                      style={st.card}
                    >
                      <View style={[st.imageRing, { backgroundColor: mantra.circleColor || C.SOFT }]}>
                        {hasImage ? (
                          <Image source={{ uri: mantra.imageUrl }} style={st.image} resizeMode="cover" />
                        ) : (
                          <Icon name={mantra.icon} size={34} color={mantra.iconColor || C.PLUM} />
                        )}
                      </View>

                      <View style={st.body}>
                        <Text numberOfLines={1} style={st.name}>
                          {mantra.name}
                        </Text>
                        <Text numberOfLines={1} style={st.deity}>
                          {mantra.deity}
                        </Text>
                        <Text numberOfLines={2} style={st.description}>
                          {mantra.description}
                        </Text>
                        <View style={st.reward}>
                          <Icon name="gift-outline" size={12} color="#8A6A2E" />
                          <Text style={st.rewardText}>
                            ₹{mantra.reward} on {mantra.chantCount} chants
                          </Text>
                        </View>
                      </View>

                      <View style={st.actions}>
                        <TouchableOpacity
                          onPress={() => toggleFavorite(mantra.id)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={
                            isFavorite ? `Remove ${mantra.name} from favourites` : `Add ${mantra.name} to favourites`
                          }
                          style={st.heart}
                        >
                          <Icon name={isFavorite ? "heart" : "heart-outline"} size={20} color={C.PLUM} />
                        </TouchableOpacity>
                        <View style={st.play}>
                          <Icon name="play" size={18} color={C.CARD} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {filteredMantras.length === 0 && (
                  <View style={st.empty}>
                    <Icon name="text-search" size={32} color={C.PLUM} />
                    <Text style={st.emptyTitle}>No mantras found</Text>
                    <Text style={st.emptyText}>Try another search or category.</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setSearch("");
                        setSelectedCategory("All");
                      }}
                      style={st.resetBtn}
                    >
                      <Text style={st.resetText}>Show all mantras</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
  title: { marginTop: 14, color: C.INK, fontSize: 26, fontFamily: F.bold, letterSpacing: -0.4 },
  subtitle: { marginTop: 2, marginBottom: 14, color: C.MUTED, fontSize: 13.5, fontFamily: F.regular },

  hero: { borderRadius: 26, backgroundColor: C.PLUM, ...softShadow, shadowOpacity: 0.25 },
  heroClip: { borderRadius: 26, overflow: "hidden", padding: 18, backgroundColor: C.PLUM },
  heroRow: { flexDirection: "row", alignItems: "center" },
  heroOverline: { color: "rgba(255,253,252,0.65)", fontSize: 11, fontFamily: F.bold, letterSpacing: 1.6 },
  heroTitle: { marginTop: 6, color: C.CARD, fontSize: 21, lineHeight: 26, fontFamily: F.bold, letterSpacing: -0.3 },
  heroText: { marginTop: 4, color: "rgba(255,253,252,0.78)", fontSize: 13, lineHeight: 19, fontFamily: F.regular },
  heroReward: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(196,154,74,0.16)",
    borderWidth: 1,
    borderColor: "rgba(196,154,74,0.35)",
  },
  heroRewardText: { color: C.CARD, fontSize: 11.5, fontFamily: F.semibold },
  heroBtn: {
    marginTop: 16,
    height: 46,
    borderRadius: 999,
    backgroundColor: C.CARD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  heroBtnText: { color: C.PLUM, fontSize: 14.5, fontFamily: F.bold },
  ringGlow: { position: "absolute", width: RING, height: RING, borderRadius: RING / 2, backgroundColor: C.GOLD },
  ringValue: { color: C.CARD, fontSize: 26, lineHeight: 30, fontFamily: F.bold },
  ringLabel: { color: "rgba(255,253,252,0.65)", fontSize: 11, fontFamily: F.medium },

  searchBox: {
    marginTop: 16,
    height: 46,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.BORDER,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: C.INK, fontSize: 14, fontFamily: F.regular },

  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  chipActive: { backgroundColor: C.PLUM, borderColor: C.PLUM },
  chipText: { color: C.PLUM, fontSize: 13, fontFamily: F.semibold },
  chipTextActive: { color: C.CARD },

  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    borderRadius: 22,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    ...softShadow,
    shadowOpacity: 0.06,
  },
  imageRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.CARD,
    shadowColor: C.PLUM,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  image: { width: "100%", height: "100%" },
  body: { flex: 1, minWidth: 0 },
  name: { color: C.INK, fontSize: 15.5, fontFamily: F.bold },
  deity: { marginTop: 1, color: C.PLUM, fontSize: 12, fontFamily: F.semibold, opacity: 0.8 },
  description: { marginTop: 4, color: C.MUTED, fontSize: 12.5, lineHeight: 17.5, fontFamily: F.regular },
  reward: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.IVORY,
    borderWidth: 1,
    borderColor: "#E6D9C4",
  },
  rewardText: { color: "#8A6A2E", fontSize: 11, fontFamily: F.semibold },
  actions: { alignSelf: "stretch", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 },
  heart: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: C.SOFT },
  play: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: C.PLUM },

  empty: { alignItems: "center", paddingVertical: 40, gap: 6 },
  emptyTitle: { marginTop: 4, color: C.INK, fontSize: 17, fontFamily: F.bold },
  emptyText: { color: C.MUTED, fontSize: 13.5, fontFamily: F.regular },
  resetBtn: { marginTop: 10, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: C.PLUM },
  resetText: { color: C.CARD, fontSize: 13, fontFamily: F.semibold },
});
