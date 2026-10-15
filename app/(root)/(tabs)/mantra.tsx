
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import mantrasData from "../../../components/constants/mantra.json";
import { useTabBarSpace } from "../../../components/utils/tabBar";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCALE = Math.min(SCREEN_WIDTH / 430, 1);
const px = (value: number) => Math.round(value * SCALE);

const C = {
  background: "#F3EFFB",
  card: "#FFFCFF",
  white: "#FFFFFF",
  ink: "#17152D",
  muted: "#777C9F",
  purple: "#49135D",
  orange: "#BD492C",
  border: "#F0E7F2",
  badge: "#FFF0E9",
  badgeText: "#A34C35",
};

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

const CATEGORIES = [
  "All",
  "Peace",
  "Prosperity",
  "Love",
  "Health",
  "Career",
];



export default function MantraScreen() {
  const tabSpace = useTabBarSpace();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [favorites, setFavorites] = useState<string[]>([]);

  const filteredMantras = useMemo(() => {
    const query = search.trim().toLowerCase();

    return MANTRAS.filter((mantra) => {
      const matchesCategory =
        selectedCategory === "All" ||
        mantra.categories.includes(selectedCategory);

      const matchesSearch =
        !query ||
        mantra.name.toLowerCase().includes(query) ||
        mantra.deity.toLowerCase().includes(query) ||
        mantra.description.toLowerCase().includes(query) ||
        mantra.categories.some((category) =>
          category.toLowerCase().includes(query)
        );

      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

  const toggleFavorite = (id: string) => {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };



  
const openMantra = (mantra: Mantra) => {
  router.push({
    pathname: "/(root)/mantra/[mantra_id]",
    params: {
      mantra_id: mantra.id,
      audio_url: mantra.audioUrl,
      image_url: mantra.imageUrl,
    },
  });
};


  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={C.background}
      />

      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.heading}>Mantras</Text>
          <Text style={styles.headerSubtitle}>
            Chant sacred mantras for peace, prosperity{"\n"}
            and positive energy.
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Icon name="magnify" size={px(23)} color={C.muted} />

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search mantras, deities or benefits..."
            placeholderTextColor={C.muted}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Search mantras"
          />

          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch("")}
              hitSlop={8}
              accessibilityLabel="Clear search"
            >
              <Icon
                name="close-circle"
                size={px(19)}
                color={C.muted}
              />
            </Pressable>
          )}
        </View>

        {/* Category filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryList}
        >
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category;

            return (
              <Pressable
                key={category}
                onPress={() => setSelectedCategory(category)}
                style={[
                  styles.categoryPill,
                  active && styles.categoryPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    active && styles.categoryTextActive,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Mantra list */}
        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabSpace }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filteredMantras.map((mantra) => {
            const isFavorite = favorites.includes(mantra.id);
            const hasImage = mantra.imageUrl.trim().length > 0;

            return (
              <View key={mantra.id} style={styles.mantraCard}>
                {/* Image or placeholder icon */}
                <Pressable
                  onPress={() => openMantra(mantra)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${mantra.name}`}
                  style={styles.illustrationColumn}
                >
                  <View
                    style={[
                      styles.illustrationOuter,
                      { backgroundColor: mantra.circleColor },
                    ]}
                  >
                    {hasImage ? (
                      <Image
                        source={{ uri: mantra.imageUrl }}
                        style={styles.mantraImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.illustrationInner}>
                        <Icon
                          name={mantra.icon}
                          size={px(43)}
                          color={mantra.iconColor}
                        />
                      </View>
                    )}
                  </View>
                </Pressable>

                {/* Mantra information */}
                <Pressable
                  style={styles.details}
                  onPress={() => openMantra(mantra)}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${mantra.name} details`}
                >
                  <Text numberOfLines={1} style={styles.mantraName}>
                    {mantra.name}
                  </Text>

                  <Text numberOfLines={1} style={styles.deity}>
                    {mantra.deity}
                  </Text>

                  <Text
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    style={styles.description}
                  >
                    {mantra.description}
                  </Text>

                  <View style={styles.rewardBadge}>
                    <Icon
                      name="gift"
                      size={px(15)}
                      color={C.orange}
                    />
                    <Text style={styles.rewardText}>
                      ₹{mantra.reward} on {mantra.chantCount} chants
                    </Text>
                  </View>
                </Pressable>

                {/* Favorite and details actions */}
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => toggleFavorite(mantra.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isFavorite
                        ? `Remove ${mantra.name} from favorites`
                        : `Add ${mantra.name} to favorites`
                    }
                    style={styles.favoriteButton}
                  >
                    <Icon
                      name={isFavorite ? "heart" : "heart-outline"}
                      size={px(23)}
                      color={isFavorite ? "#D93663" : C.orange}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => openMantra(mantra)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${mantra.name}`}
                    style={styles.arrowButton}
                  >
                    <Icon
                      name="chevron-right"
                      size={px(23)}
                      color={C.purple}
                    />
                  </Pressable>
                </View>
              </View>
            );
          })}

          {filteredMantras.length === 0 && (
            <View style={styles.emptyState}>
              <Icon
                name="text-search"
                size={px(38)}
                color={C.muted}
              />
              <Text style={styles.emptyTitle}>No mantras found</Text>
              <Text style={styles.emptySubtitle}>
                Try another search or category.
              </Text>

              <Pressable
                onPress={() => {
                  setSearch("");
                  setSelectedCategory("All");
                }}
                style={styles.resetButton}
              >
                <Text style={styles.resetButtonText}>
                  Show all mantras
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.background,
  },

  screen: {
    flex: 1,
    backgroundColor: C.background,
  },

  header: {
    paddingHorizontal: px(23),
    paddingTop: px(12),
    paddingBottom: px(11),
  },

  heading: {
    fontSize: px(34),
    lineHeight: px(41),
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -px(0.7),
  },

  headerSubtitle: {
    fontSize: px(14),
    lineHeight: px(20),
    color: C.muted,
    marginTop: px(2),
  },

  searchBox: {
    height: px(42),
    marginHorizontal: px(13),
    paddingHorizontal: px(12),
    flexDirection: "row",
    alignItems: "center",
    gap: px(9),
    backgroundColor: "rgba(255,255,255,0.78)",
    borderRadius: px(24),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontSize: px(13),
    color: C.ink,
  },

  categoryScroll: {
    flexGrow: 0,
    marginTop: px(12),
    marginBottom: px(12),
  },

  categoryList: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: px(13),
    gap: px(7),
  },

  categoryPill: {
    minHeight: px(36),
    paddingHorizontal: px(15),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: px(22),
    backgroundColor: "rgba(255,255,255,0.68)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },

  categoryPillActive: {
    backgroundColor: C.purple,
    borderColor: C.purple,
  },

  categoryText: {
    color: C.purple,
    fontSize: px(12),
    fontWeight: "500",
  },

  categoryTextActive: {
    color: C.white,
    fontWeight: "600",
  },

  list: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: px(10),
    paddingTop: px(1),
    paddingBottom: px(20),
    gap: px(9),
  },

  mantraCard: {
    minHeight: px(124),
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: px(10),
    paddingVertical: px(10),
    gap: px(9),
    backgroundColor: C.card,
    borderRadius: px(19),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
  },

  illustrationColumn: {
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  illustrationOuter: {
    width: px(88),
    height: px(88),
    borderRadius: px(44),
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(210,158,128,0.35)",
  },

  illustrationInner: {
    width: "100%",
    height: "100%",
    borderRadius: px(44),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
  },

  mantraImage: {
    width: "100%",
    height: "100%",
  },

  details: {
    flex: 1,
    minWidth: 0,
    alignSelf: "center",
    justifyContent: "center",
  },

  mantraName: {
    fontSize: px(15),
    lineHeight: px(19),
    fontWeight: "800",
    color: C.ink,
  },

  deity: {
    fontSize: px(13),
    lineHeight: px(17),
    color: C.muted,
    marginTop: px(1),
  },

  description: {
    fontSize: px(13),
    lineHeight: px(17),
    color: C.muted,
    marginTop: px(2),
  },

  rewardBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: px(5),
    paddingHorizontal: px(8),
    paddingVertical: px(4),
    marginTop: px(4),
    borderRadius: px(16),
    backgroundColor: C.badge,
  },

  rewardText: {
    fontSize: px(11),
    lineHeight: px(14),
    color: C.badgeText,
    fontWeight: "500",
  },

  actions: {
    alignSelf: "stretch",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: px(2),
    flexShrink: 0,
  },

  favoriteButton: {
    width: px(29),
    height: px(29),
    alignItems: "center",
    justifyContent: "center",
  },

  arrowButton: {
    width: px(36),
    height: px(36),
    borderRadius: px(18),
    backgroundColor: "#FFFAFD",
    borderWidth: 1,
    borderColor: "#F5E8F0",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: px(48),
    paddingHorizontal: px(20),
  },

  emptyTitle: {
    marginTop: px(12),
    fontSize: px(17),
    fontWeight: "700",
    color: C.ink,
  },

  emptySubtitle: {
    marginTop: px(5),
    fontSize: px(13),
    color: C.muted,
    textAlign: "center",
  },

  resetButton: {
    marginTop: px(15),
    paddingHorizontal: px(18),
    paddingVertical: px(10),
    borderRadius: px(22),
    backgroundColor: C.purple,
  },

  resetButtonText: {
    color: C.white,
    fontSize: px(13),
    fontWeight: "600",
  },

  bottomNav: {
    minHeight: px(64),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: px(7),
    paddingBottom: px(5),
    paddingHorizontal: px(8),
    backgroundColor: "#FFFCFF",
    borderTopWidth: 1,
    borderTopColor: "#EAE4F1",
  },

  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: px(3),
    paddingVertical: px(3),
  },

  navLabel: {
    fontSize: px(11),
    lineHeight: px(15),
    color: "#8C8EA9",
    fontWeight: "500",
  },

  navLabelActive: {
    color: C.purple,
    fontWeight: "800",
  },
});
