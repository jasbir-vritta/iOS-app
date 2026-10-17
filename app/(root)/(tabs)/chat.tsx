import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Reanimated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AUTH_FONTS, F } from "../../../components/auth/theme";
import { HOME_PAD, SectionHeader, softShadow } from "../../../components/home/homeUi";

import { useAstrologersStore } from "../../../components/stores/astrologersStore";
import { useUserStore } from "../../../components/stores/userStore";
import TopBar from "../../../components/TopBar";
import { ensureChatCredits, minChatCredits } from "../../../components/constants/chat";
import { API_URL, authHeaders } from "../../../lib/auth";
import { useT } from "../../../lib/i18n";
import { useTabBarSpace } from "../../../components/utils/tabBar";
import { metaEvents, track } from "../../../lib/analytics";
const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  TERRACOTTA: "#A94C36",
  GOLD: "#C49A4A",
  BG: "#F4F0F8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  BORDER: "#D9CEC1",
  CHIP: "#F7F1E8",
  GLASS: "rgba(255,253,252,0.88)",
};

// `title` is a translation key.
const categories = [
   {
    id: "all",
    title: "chat.cat.all",
    icon: "apps",
    w: 110,
  },
  {
    id: "vedic",
    title: "chat.cat.vedic",
    icon: "star-outline",
    w: 150,
  },
  {
    id: "tarot",
    title: "chat.cat.tarot",
    icon: "cards-playing-outline",
    w: 135,
  },
  {
    id: "numerology",
    title: "chat.cat.numerology",
    icon: "numeric-1-box-multiple-outline",
    w: 180,
  },
  {
    id: "kp",
    title: "chat.cat.kp",
    icon: "compass-outline",
    w: 100,
  },
  {
    id: "lalkitab",
    title: "chat.cat.lalkitab",
    icon: "book-open-variant",
    w: 150,
  },
  
];

type Astrologer = {
  id: string;
  astrologer_id: string;
  name: string;
  type: string;
  specialties: string[];
  archetype: string;
  archetypeIcon: string;
  experience: number;
  description: string;
  price: number;
  oldPrice: number;
  discount: string;
  consultations: number;
  topics: {
    label: string;
    icon: string;
  }[];
  avatar: string;
  photo: any;
  online: boolean;
};

const getReadingType = (specialty: string) => {
  const value = specialty.trim().toLowerCase();

  if (value === "vedic astrology" || value === "vedic") {
    return "vedic";
  }

  if (value === "tarot" || value === "tarot reading") {
    return "tarot";
  }

  if (value === "numerology") {
    return "numerology";
  }

  // KP and Lal Kitab chats use the Vedic chat screen (own school).
  if (value === "kp" || value === "kp astrology" || value === "krishnamurti paddhati") {
    return "kp";
  }

  if (value === "lal kitab" || value === "lalkitab") {
    return "lalkitab";
  }

  return null;
};

// Specialty in the app language (backend sends specialty_labels; the raw
// English values stay for picking the chat type).
const labelOf = (astrologer: any, value: string): string =>
  astrologer?.specialty_labels?.[value] ?? value;

// Astrologers shown with an "AI" tag next to their online status
// (set here in the app only): Ishita Verma, Vasudha Rao, Vikram Joshi.
const AI_TAGGED = new Set([
  "5d0804c4-1eb1-4262-9044-feb0ab6b9c13",
  "9c56ed30-a49d-4b47-b742-13984d01d1ab",
  "8bc7b7ee-a148-47cb-b0b7-d78268a3e4c6",
]);

const getAstrologerReadingTypes = (astrologer: Astrologer) => {
  const specialties =
    astrologer.specialties?.length > 0
      ? astrologer.specialties
      : [astrologer.type];

  return specialties
    .map(getReadingType)
    .filter((value): value is string => Boolean(value));
};

const getReadingTypeFromCategory = (category: string) => {
  if (category === "vedic") return "vedic";
  if (category === "tarot") return "tarot";
  if (category === "numerology") return "numerology";
  if (category === "kp") return "kp";
  if (category === "lalkitab") return "lalkitab";
  return null;
};

// Sections rise in one after another (as on Home).
const enter = (index: number) => FadeInDown.delay(70 * index).duration(420);

/* ---------------- header card motion ---------------- */

const ORBIT = 220;

// Slowly turning orbit rings with a small gold planet.
function HeroOrbits({ still }: { still: boolean }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    spin.value = withRepeat(withTiming(360, { duration: 60000, easing: Easing.linear }), -1);
  }, [spin, still]);
  const outer = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.value * 1.6}deg` }] }));
  const c = ORBIT / 2;

  return (
    <View style={n.orbits} pointerEvents="none">
      <Reanimated.View style={[StyleSheet.absoluteFill, outer]}>
        <Svg width={ORBIT} height={ORBIT}>
          <Circle cx={c} cy={c} r={c - 4} stroke="rgba(255,253,252,0.12)" fill="none" />
          <Circle cx={c} cy={4} r={4} fill={C.GOLD} />
          <Circle cx={c} cy={4} r={9} fill={C.GOLD} opacity={0.18} />
        </Svg>
      </Reanimated.View>
      <Reanimated.View style={[StyleSheet.absoluteFill, inner]}>
        <Svg width={ORBIT} height={ORBIT}>
          <Circle cx={c} cy={c} r={c * 0.68} stroke="rgba(255,253,252,0.14)" fill="none" strokeDasharray="2 6" />
          <Circle cx={c + c * 0.68} cy={c} r={2.2} fill="rgba(255,253,252,0.7)" />
        </Svg>
      </Reanimated.View>
      <Svg width={ORBIT} height={ORBIT} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={c * 0.38} stroke="rgba(255,253,252,0.08)" fill="none" />
      </Svg>
    </View>
  );
}

// Gold stars that fade in and out at their own pace.
const HERO_STARS = [
  { left: "58%", top: 18, size: 9, delay: 0 },
  { left: "72%", top: 64, size: 7, delay: 900 },
  { left: "88%", top: 120, size: 8, delay: 500 },
  { left: "46%", top: 44, size: 6, delay: 1400 },
] as const;

function HeroStar({ left, top, size, delay, still }: { left: string; top: number; size: number; delay: number; still: boolean }) {
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
      <Icon name="star-four-points" size={size} color={C.GOLD} />
    </Reanimated.View>
  );
}

// Green "live" dot that sends out a soft ripple.
function LiveDot({ still }: { still: boolean }) {
  const wave = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    wave.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1);
  }, [still, wave]);
  const ripple = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - wave.value),
    transform: [{ scale: 1 + wave.value * 1.8 }],
  }));
  return (
    <View style={n.liveWrap}>
      {!still && <Reanimated.View style={[n.liveRipple, ripple]} />}
      <View style={n.liveDot} />
    </View>
  );
}

// Counts up to a number when it appears.
function CountUp({ value, still, style }: { value: number; still: boolean; style: any }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (still) return;
    const start = Date.now();
    const duration = 900;
    let frame = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, still]);
  return <Text style={style}>{still ? value : shown}</Text>;
}

const consultLabel = (count: number, t: (key: string, vars?: Record<string, string | number>) => string) => {
  if (count >= 100000) return t("chat.chatsCount", { count: `${(count / 100000).toFixed(1)}L` });
  if (count >= 1000) return t("chat.chatsCount", { count: `${(count / 1000).toFixed(1)}K` });
  return t("chat.chatsCount", { count });
};

// Translation keys.
const LIST_TITLE: Record<string, string> = {
  all: "chat.list.all",
  vedic: "chat.list.vedic",
  tarot: "chat.list.tarot",
  numerology: "chat.list.numerology",
  kp: "chat.list.kp",
  lalkitab: "chat.list.lalkitab",
};

export default function Chat() {
  // Analytics: visited_chat each time the Chat tab comes on screen.
  useFocusEffect(
    useCallback(() => {
      track("visited_chat", { platform: Platform.OS });
    }, [])
  );

  const t = useT();
  const tabSpace = useTabBarSpace();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts(AUTH_FONTS);
  const still = useReducedMotion();

  const { user } = useUserStore() as any;

  const [selectedCategory, setSelectedCategory] =
    useState("all");

  const [query, setQuery] = useState("");

  /*
   * Selected astrologer whose profile is open.
   */
  const [selectedAstrologer, setSelectedAstrologer] =
    useState<Astrologer | null>(null);

  const [chatAstrologer, setChatAstrologer] =
    useState<Astrologer | null>(null);

  const [chatOptions, setChatOptions] =
    useState<string[]>([]);

  const [pendingOption, setPendingOption] = useState("");
  const [chatModalVisible, setChatModalVisible] =
    useState(false);

  const [startingChat, setStartingChat] =
    useState(false);


    const {
  astrologers,
  loading: loadingAstrologers,
  fetchAstrologers,
} = useAstrologersStore();
  

  
const startAstrologerChat = async (
  astrologer: Astrologer,
  readingType: string
) => {
  if (startingChat) return;

  try {
    setStartingChat(true);
    setChatModalVisible(false);

    const profileId = user?.active_profile_id;

    if (!profileId) {
      console.error("Active profile ID is missing");
      return;
    }

    if (
      !ensureChatCredits(
        Number(user?.credits ?? 0),
        Number(astrologer.price),
        Boolean(user?.free_chat_minute_available)
      )
    ) {
      return;
    }

    console.log("Starting chat:", {
      profileId,
      astrologerId: astrologer.astrologer_id,
      readingType,
    });

    const response = await fetch(
      `${API_URL}/chat/session/start`,
      {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profile_id: profileId,
          astrologer_id: astrologer.astrologer_id,
          reading_type: readingType,
        }),
      }
    );

    const data = await response.json();

    console.log("CHAT SESSION STATUS:", response.status);
    console.log("CHAT SESSION RESPONSE:", data);

    if (!response.ok || !data?.session_id) {
      throw new Error(
        data?.detail || "Failed to start chat session"
      );
    }

    // The free first minute is used by this chat; the backend is the
    // source of truth and reports it again on the next details load.
    useUserStore
      .getState()
      .updateUser({ free_chat_minute_available: false });

    // Get the current wallet balance and astrologer's rate.
    
const currentWalletBalance = Number(user?.credits ?? 0);


    const ratePerMinute = Number(astrologer.price);

    // Pass all parameters to the chat screen.
    const params = {
      sessionId: String(data.session_id),
      astrologerId: String(astrologer.astrologer_id),
      astrologerName: String(astrologer.name),
      readingType: String(readingType),
      profileId: String(profileId),
      walletBalance: String(
        Number.isFinite(currentWalletBalance) &&
          currentWalletBalance > 0
          ? currentWalletBalance
          : 0
      ),
      ratePerMinute: String(
        Number.isFinite(ratePerMinute) &&
          ratePerMinute > 0
          ? ratePerMinute
          : 0
      ),
      // Use a backend-provided remaining time if available.
      ...(Number(data.remaining_time_seconds) > 0
        ? {
            remainingTimeSeconds: String(
              Math.floor(Number(data.remaining_time_seconds))
            ),
          }
        : {}),
    };

    console.log("NAVIGATING TO CHAT:", params);

    // Real astrologers have their own live chat screen.
    if (data.participant_type === "human") {
      router.push({
        pathname: "/(root)/chat/live",
        params,
      });
      return;
    }

    if (readingType === "vedic" || readingType === "kp" || readingType === "lalkitab") {
      
      router.push({
        pathname: "/(root)/chat/vedic",
        params,
      });
      return;
    }

    if (readingType === "tarot") {
      router.push({
        pathname: "/(root)/chat/tarot",
        params,
      });
      return;
    }

    if (readingType === "numerology") {
      router.push({
        pathname: "/(root)/chat/numerology",
        params,
      });
      return;
    }

    console.error("Unsupported reading type:", readingType);
  } catch (error) {
    console.error("Failed to start astrologer chat:", error);

    // e.g. "This astrologer is busy right now."
    Alert.alert(
      t("chat.live.cantStart"),
      error instanceof Error ? error.message : t("chat.pleaseTryAgain")
    );
  } finally {
    setStartingChat(false);
  }
};


  const handleAstrologerChat = async (
    astrologer: Astrologer
  ) => {
    if (startingChat) return;

    const availableReadingTypes =
      getAstrologerReadingTypes(astrologer);

    if (selectedCategory !== "all") {
      const readingType =
        getReadingTypeFromCategory(
          selectedCategory
        );

      if (readingType) {
        await startAstrologerChat(
          astrologer,
          readingType
        );
      }

      return;
    }

    if (availableReadingTypes.length === 1) {
      await startAstrologerChat(
        astrologer,
        availableReadingTypes[0]
      );
      return;
    }

    if (availableReadingTypes.length > 1) {
      setChatAstrologer(astrologer);
      setChatOptions(availableReadingTypes);
      setChatModalVisible(true);
      return;
    }

    console.log(
      "No supported reading type:",
      astrologer
    );
  };

  const name =
    user?.name ||
    user?.firstName ||
    "Guest";

  const wallet = user?.credits ?? 0;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();

    return astrologers.filter((a) => {
      // Category filter
      // Category filter
if (selectedCategory !== "all") {
  const readingTypes =
    getAstrologerReadingTypes(a);

  if (!readingTypes.includes(selectedCategory)) {
    return false;
  }
}

      // Search filter
      if (!q) {
        return true;
      }

      return [
        a.name,
        a.type,
        a.archetype,
        a.description,
        ...a.topics.map(
          (topic) => topic.label
        ),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [
    astrologers,
    selectedCategory,
    query,
  ]);

  // Online astrologers first.
  const sortedList = useMemo(
    () => [...list].sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online))),
    [list]
  );
  const onlineCount = astrologers.filter((a) => a.online).length;

  const onCategory = (id: string) => {
    if (id === "filters") {
      return console.log(
        "Open filters"
      );
    }

    setSelectedCategory(id);
  };

  /*
   * Fetch astrologers each time the tab opens (chat counts and online
   * status change; the list stays on screen while it refreshes).
   */
  useFocusEffect(
    useCallback(() => {
      fetchAstrologers();
    }, [fetchAstrologers])
  );

  /*
   * Open astrologer profile.
   */
  // Profile pop-up tab: About, or Reviews (coming soon).
  const [profileTab, setProfileTab] = useState<"about" | "reviews">("about");

  const openAstrologerProfile = (
    astrologer: Astrologer
  ) => {
    setProfileTab("about");
    metaEvents.viewContent("astrologer", astrologer.id, Number(astrologer.price) || undefined);
    setSelectedAstrologer(
      astrologer
    );
  };

  /*
   * Close astrologer profile.
   */
  const closeAstrologerProfile = () => {
    setSelectedAstrologer(null);
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.BG,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={{
          paddingHorizontal: HOME_PAD,
          paddingTop:
            insets.top + 4,
          paddingBottom: tabSpace + 24,
        }}
      >
        {/* =========================================================
            CHAT READING TYPE MODAL
        ========================================================= */}

        <Modal
          visible={chatModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setChatModalVisible(false)}
        >
          <Pressable style={cm.backdrop} onPress={() => setChatModalVisible(false)}>
            <Pressable
              style={[cm.sheet, { paddingBottom: insets.bottom + 16 }]}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={cm.handle} />

              {/* Astrologer */}
              <View style={cm.head}>
                <View style={cm.photoRing}>
                  <View style={cm.photo}>
                    {chatAstrologer?.photo ? (
                      <Image source={{ uri: chatAstrologer.photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <Text style={cm.photoInitial}>{chatAstrologer?.avatar || chatAstrologer?.name?.[0] || "A"}</Text>
                    )}
                  </View>
                  <View style={cm.onlineDot} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={cm.overline}>{t("chat.choose.overline")}</Text>
                  <Text style={cm.name} numberOfLines={1}>{chatAstrologer?.name}</Text>
                  <Text style={cm.meta} numberOfLines={1}>
                    {t("chat.priceAndYears", {
                      price: chatAstrologer?.price ?? "",
                      years: chatAstrologer?.experience ?? "",
                    })}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setChatModalVisible(false)}
                  disabled={startingChat}
                  hitSlop={10}
                  style={cm.close}
                  accessibilityLabel={t("common.close")}
                >
                  <Icon name="close" size={18} color={C.INK} />
                </TouchableOpacity>
              </View>

              <Text style={cm.lead}>
                {t("chat.choose.lead", {
                  name: chatAstrologer?.name?.split(" ")[0] ?? "",
                  count: chatOptions.length,
                })}
              </Text>

              {/* Options */}
              <View style={{ gap: 10, marginTop: 14 }}>
                {chatOptions.map((option, index) => {
                  const look = READING_LOOK[option] || READING_LOOK.vedic;
                  const busy = startingChat && pendingOption === option;
                  return (
                    <Reanimated.View key={option} entering={FadeInDown.delay(80 + index * 70).duration(380)}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={startingChat}
                        onPress={() => {
                          if (!chatAstrologer) return;
                          setPendingOption(option);
                          startAstrologerChat(chatAstrologer, option);
                        }}
                        style={[cm.option, startingChat && !busy && { opacity: 0.5 }]}
                      >
                        <View style={[cm.medallion, { backgroundColor: look.tint }]}>
                          <Icon name={look.icon as any} size={22} color={look.color} />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={cm.optionTitle}>{t(look.title)}</Text>
                          <Text style={cm.optionLine} numberOfLines={2}>{t(look.line)}</Text>
                        </View>

                        <View style={cm.go}>
                          {busy ? (
                            <ActivityIndicator size="small" color={C.CARD} />
                          ) : (
                            <Icon name="arrow-right" size={18} color={C.CARD} />
                          )}
                        </View>
                      </TouchableOpacity>
                    </Reanimated.View>
                  );
                })}
              </View>

              <View style={cm.foot}>
                <Icon name="shield-check-outline" size={14} color={C.MUTED} />
                <Text style={cm.footText}>{t("chat.choose.foot")}</Text>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* =========================================================
            HEADER
        ========================================================= */}

        <TopBar />

        {/* Brand fonts first, so text doesn't jump from the system font. */}
        {fontsLoaded && (
          <>
            {/* Header card: who you can talk to right now */}
            <Reanimated.View entering={enter(0)} style={n.hero}>
              <View style={n.heroClip}>
                <LinearGradient
                  colors={[C.PLUM, "#3B2654"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <HeroOrbits still={still} />
                {HERO_STARS.map((star, i) => (
                  <HeroStar key={i} {...star} still={still} />
                ))}
                <Text style={n.heroOverline}>{t("chat.hero.overline")}</Text>
                <Text style={n.heroTitle}>{t("chat.hero.title")}</Text>
                <Text style={n.heroText}>
                  {t("chat.hero.text")}
                </Text>

                <View style={n.heroStats}>
                  <View style={n.stat}>
                    <View style={n.statValueRow}>
                      <LiveDot still={still} />
                      <CountUp value={onlineCount} still={still} style={n.statValue} />
                    </View>
                    <Text style={n.statLabel} numberOfLines={1}>{t("chat.onlineNow")}</Text>
                  </View>
                  <View style={n.statLine} />
                  <View style={n.stat}>
                    <CountUp value={astrologers.length} still={still} style={n.statValue} />
                    <Text style={n.statLabel} numberOfLines={1}>{t("chat.hero.experts")}</Text>
                  </View>
                  <View style={n.statLine} />
                  <View style={n.stat}>
                    <View style={n.statValueRow}>
                      <Icon name="check-decagram" size={15} color={C.GOLD} />
                      <Text style={n.statValue}>100%</Text>
                    </View>
                    <Text style={n.statLabel} numberOfLines={1}>{t("chat.verified")}</Text>
                  </View>
                </View>
              </View>
            </Reanimated.View>

            {/* Categories */}
            <Reanimated.View entering={enter(1)} style={n.segmentWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={n.segment}
              >
              {categories.map((category) => {
                const active = category.id === selectedCategory;
                return (
                  <TouchableOpacity
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    activeOpacity={0.85}
                    onPress={() => onCategory(category.id)}
                    style={[n.segmentItem, active && n.segmentItemActive]}
                  >
                    <Text
                      style={[n.segmentText, active && n.segmentTextActive]}
                      numberOfLines={1}
                    >
                      {t(category.title)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              </ScrollView>
            </Reanimated.View>

            <Reanimated.View entering={enter(2)}>
              <SectionHeader
                overline={
                  list.length === 1
                    ? t("chat.list.countOne")
                    : t("chat.list.countMany", { count: list.length })
                }
                title={t(LIST_TITLE[selectedCategory] || "chat.list.all")}
              />
            </Reanimated.View>

            {/* =========================================================
                ASTROLOGER CARDS
            ========================================================= */}

            {loadingAstrologers && astrologers.length === 0 ? (
              <View style={n.state}>
                <ActivityIndicator size="large" color={C.PLUM} />
                <Text style={n.stateText}>{t("chat.finding")}</Text>
              </View>
            ) : sortedList.length === 0 ? (
              <View style={n.state}>
                <Icon name="account-search-outline" size={30} color={C.PLUM} />
                <Text style={n.stateTitle}>{t("chat.empty.title")}</Text>
                <Text style={n.stateText}>{t("chat.empty.text")}</Text>
              </View>
            ) : (
              <Reanimated.View entering={enter(3)} style={{ gap: 12 }}>
                {sortedList.map((a) => {
                  const topics = (a.topics || []).slice(0, 2);
                  const showOld = Number(a.oldPrice) > Number(a.price);

                  return (
                    <TouchableOpacity
                      key={a.id}
                      accessibilityRole="button"
                      accessibilityLabel={t(a.online ? "chat.card.a11yOnline" : "chat.card.a11yOffline", {
                        name: a.name,
                        price: a.price,
                      })}
                      activeOpacity={0.92}
                      onPress={() => openAstrologerProfile(a)}
                      style={n.card}
                    >
                      <View style={n.cardTop}>
                        {/* Round photo with an online ring */}
                        <View style={[n.ring, { borderColor: a.online ? "#2E9E57" : "rgba(43,26,61,0.16)" }]}>
                          <View style={n.avatar}>
                            {a.photo ? (
                              <Image source={{ uri: a.photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            ) : (
                              <Text style={n.initial}>{a.avatar}</Text>
                            )}
                          </View>
                          {a.online && <View style={n.ringDot} />}
                        </View>

                        <View style={n.cardInfo}>
                          <View style={n.nameRow}>
                            <Text style={n.name} numberOfLines={1}>
                              {a.name}
                            </Text>
                            <Icon name="check-decagram" size={15} color={C.GOLD} />
                          </View>
                          <Text style={n.spec} numberOfLines={1}>
                            {a.specialties.map((s) => labelOf(a, s)).join(" · ")}
                          </Text>
                          <View style={n.metaRow}>
                            <Icon name="chat-processing-outline" size={12} color={C.TERRACOTTA} />
                            <Text style={n.meta}>{consultLabel(Number(a.consultations) || 0, t)}</Text>
                            <Text style={n.metaDot}>·</Text>
                            <Text style={n.meta}>{t("chat.years", { years: a.experience })}</Text>
                          </View>
                        </View>

                        <View style={n.priceCol}>
                          <Text style={n.price}>
                            ₹{a.price}
                            <Text style={n.perMin}>{t("common.perMin")}</Text>
                          </Text>
                          {showOld && (
                            <View style={n.offerRow}>
                              <Text style={n.oldPrice}>₹{a.oldPrice}</Text>
                              {!!a.discount && (
                                <View style={n.offer}>
                                  <Text style={n.offerText}>{a.discount}</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Archetype and topics */}
                      <View style={n.chips}>
                        {!!a.archetype && (
                          <View style={[n.chip, n.chipStrong]}>
                            <Icon name={(a.archetypeIcon || "star-four-points-outline") as any} size={12} color={C.PLUM} />
                            <Text style={[n.chipText, { color: C.PLUM }]} numberOfLines={1}>
                              {a.archetype}
                            </Text>
                          </View>
                        )}
                        {topics.map((topic) => (
                          <View key={topic.label} style={n.chip}>
                            <Icon name={topic.icon as any} size={12} color={C.MUTED} />
                            <Text style={n.chipText} numberOfLines={1}>
                              {topic.label}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <View style={n.cardFoot}>
                        <View style={n.footLeft}>
                          <View style={[n.statusDot, { backgroundColor: a.online ? "#2E9E57" : "#B8B0B8" }]} />
                          <Text style={[n.status, { color: a.online ? "#2E7D4F" : C.MUTED }]}>
                            {a.online ? t("chat.online") : t("chat.offline")}
                          </Text>
                          {AI_TAGGED.has(a.astrologer_id) && (
                            <View style={n.aiTag}>
                              <Text style={n.aiTagText}>AI</Text>
                            </View>
                          )}
                          <Text style={n.metaDot}>·</Text>
                          <Text
                            style={[n.minCredit, user?.free_chat_minute_available && n.freeMinute]}
                            numberOfLines={1}
                          >
                            {user?.free_chat_minute_available
                              ? t("chat.oneMinFree")
                              : t("chat.minAmount", { amount: minChatCredits(a.price) })}
                          </Text>
                        </View>

                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={t("chat.chatWith", { name: a.name })}
                          activeOpacity={0.85}
                          disabled={startingChat}
                          onPress={() => handleAstrologerChat(a)}
                          style={[n.chatBtn, startingChat && { opacity: 0.6 }]}
                        >
                          <Icon name="chat-outline" size={15} color={C.CARD} />
                          <Text style={n.chatText} numberOfLines={1}>{t("chat.chat")}</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </Reanimated.View>
            )}
          </>
        )}
      </ScrollView>

      {/* =========================================================
          ASTROLOGER PROFILE MODAL
      ========================================================= */}

      <Modal
        visible={selectedAstrologer !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeAstrologerProfile}
      >
        {selectedAstrologer && (
          <View style={m.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
              {/* Photo */}
              <View style={m.hero}>
                {selectedAstrologer.photo ? (
                  // Photo starts below the status bar and fills the width, so the
                  // head is never cut off (any extra is trimmed at the bottom).
                  <Image
                    source={{ uri: selectedAstrologer.photo }}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      // Starts at the top edge of the screen on every phone (status bars differ).
                      top: Math.max(-8, insets.top - 64),
                      height: Dimensions.get("window").width * 1.25,
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={m.heroFallback}>
                    <Text style={m.heroInitial}>{selectedAstrologer.avatar}</Text>
                  </View>
                )}
                <LinearGradient
                  colors={["rgba(28,24,32,0.35)", "rgba(28,24,32,0)", "rgba(28,24,32,0)", "rgba(43,26,61,0.55)"]}
                  locations={[0, 0.25, 0.6, 1]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />

                <TouchableOpacity
                  onPress={closeAstrologerProfile}
                  hitSlop={12}
                  accessibilityLabel={t("common.back")}
                  style={[m.roundBtn, { top: insets.top + 8, left: HOME_PAD }]}
                >
                  <Icon name="arrow-left" size={22} color={C.PLUM} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    Share.share({
                      message: t("chat.shareMessage", {
                        name: selectedAstrologer.name,
                        type: selectedAstrologer.type.toLowerCase(),
                      }),
                    }).catch(() => {})
                  }
                  hitSlop={12}
                  accessibilityLabel={t("chat.shareA11y", { name: selectedAstrologer.name })}
                  style={[m.roundBtn, { top: insets.top + 8, right: HOME_PAD }]}
                >
                  <Icon name="share-variant" size={20} color={C.PLUM} />
                </TouchableOpacity>

                <View style={[m.status, { backgroundColor: selectedAstrologer.online ? "rgba(46,125,79,0.92)" : "rgba(28,24,32,0.7)" }]}>
                  <View style={[m.statusDot, { backgroundColor: selectedAstrologer.online ? "#7EE2A3" : "#B8B0B8" }]} />
                  <Text style={m.statusText}>{selectedAstrologer.online ? t("chat.onlineNow") : t("chat.offline")}</Text>
                </View>

                {/* Own pill, opposite the online status */}
                {AI_TAGGED.has(selectedAstrologer.astrologer_id) && (
                  <View style={m.aiTag}>
                    <Icon name="robot-outline" size={14} color={C.CARD} />
                    <Text style={m.aiTagText}>AI</Text>
                  </View>
                )}
              </View>

              {/* Profile */}
              <View style={m.card}>
                <View style={m.nameRow}>
                  <Text style={m.name} numberOfLines={1}>
                    {selectedAstrologer.name}
                  </Text>
                  <Icon name="check-decagram" size={18} color={C.GOLD} />
                </View>
                <Text style={m.type}>{selectedAstrologer.specialties.map((s) => labelOf(selectedAstrologer, s)).join(" · ") || labelOf(selectedAstrologer, selectedAstrologer.type)}</Text>

                <View style={m.chips}>
                  {!!selectedAstrologer.archetype && (
                    <View style={[m.chip, m.chipStrong]}>
                      <Icon name={(selectedAstrologer.archetypeIcon || "star-four-points-outline") as any} size={13} color={C.PLUM} />
                      <Text style={[m.chipText, { color: C.PLUM }]}>{selectedAstrologer.archetype}</Text>
                    </View>
                  )}
                  {(selectedAstrologer.topics || []).slice(0, 3).map((topic) => (
                    <View key={topic.label} style={m.chip}>
                      <Icon name={topic.icon as any} size={13} color={C.MUTED} />
                      <Text style={m.chipText}>{topic.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={m.stats}>
                  <View style={m.stat}>
                    <Text style={m.statValue}>{consultLabel(Number(selectedAstrologer.consultations) || 0, t)}</Text>
                    <Text style={m.statLabel} numberOfLines={1}>{t("chat.profile.consultations")}</Text>
                  </View>
                  <View style={m.statLine} />
                  <View style={m.stat}>
                    <Text style={m.statValue}>{t("chat.years", { years: selectedAstrologer.experience })}</Text>
                    <Text style={m.statLabel} numberOfLines={1}>{t("chat.profile.experience")}</Text>
                  </View>
                  <View style={m.statLine} />
                  <View style={m.stat}>
                    <View style={m.statRow}>
                      <Icon name="check-decagram" size={14} color={C.GOLD} />
                      <Text style={m.statValue}>{t("chat.verified")}</Text>
                    </View>
                    <Text style={m.statLabel} numberOfLines={1}>{t("chat.profile.expert")}</Text>
                  </View>
                </View>
              </View>

              {/* About | Reviews */}
              <View style={m.tabs}>
                {(["about", "reviews"] as const).map((tab) => {
                  const active = profileTab === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      activeOpacity={0.85}
                      onPress={() => setProfileTab(tab)}
                      style={[m.tab, active && m.tabActive]}
                    >
                      <Text style={[m.tabText, active && m.tabTextActive]}>
                        {tab === "about" ? t("chat.profile.about") : t("chat.profile.reviews")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {profileTab === "about" ? (
                <View style={m.section}>
                  <Text style={m.overline}>{t("chat.profile.aboutOverline")}</Text>
                  <Text style={m.sectionTitle}>
                    {t("chat.profile.meet", { name: selectedAstrologer.name.split(" ")[0] })}
                  </Text>
                  <Text style={m.sectionText}>
                    {selectedAstrologer.description ||
                      t("chat.profile.defaultAbout", { name: selectedAstrologer.name })}
                  </Text>
                </View>
              ) : (
                <View style={[m.section, m.soonCard]}>
                  <View style={m.soonIcon}>
                    <Icon name="star-outline" size={24} color={C.GOLD} />
                  </View>
                  <View style={m.soonPill}>
                    <Text style={m.soonPillText}>{t("common.comingSoon")}</Text>
                  </View>
                  <Text style={m.soonTitle}>{t("chat.profile.reviewsSoonTitle")}</Text>
                  <Text style={m.soonText}>
                    {t("chat.profile.reviewsSoonText", { name: selectedAstrologer.name.split(" ")[0] })}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Price and chat */}
            <View style={[m.bar, { paddingBottom: insets.bottom + 12 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={m.barPrice}>
                  ₹{selectedAstrologer.price}
                  <Text style={m.barPerMin}>{t("common.perMin")}</Text>
                </Text>
                <View style={m.barOfferRow}>
                  {Number(selectedAstrologer.oldPrice) > Number(selectedAstrologer.price) && (
                    <Text style={m.barOld}>₹{selectedAstrologer.oldPrice}{t("common.perMin")}</Text>
                  )}
                  {(user?.free_chat_minute_available || !!selectedAstrologer.discount) && (
                    <View style={m.offer}>
                      <Text style={m.offerText}>
                        {user?.free_chat_minute_available ? t("chat.oneMinFree") : selectedAstrologer.discount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={m.chatNow}
                onPress={async () => {
                  if (!selectedAstrologer) return;
                  const astrologer = selectedAstrologer;
                  closeAstrologerProfile();
                  await handleAstrologerChat(astrologer);
                }}
              >
                <Icon name="chat-outline" size={18} color={C.CARD} />
                <Text style={m.chatNowText} numberOfLines={1}>{t("chat.chatNow")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

/* =============================================================
   MAIN SCREEN STYLES
============================================================= */

/* =============================================================
   MODAL STYLES
============================================================= */

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BG },
  hero: { height: 420, overflow: "hidden", backgroundColor: "#EFE8F7" },
  heroFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#EFE8F7" },
  heroInitial: { fontSize: 72, fontFamily: F.bold, color: C.PLUM },
  roundBtn: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,253,252,0.94)",
    zIndex: 10,
  },
  status: {
    position: "absolute",
    left: HOME_PAD,
    bottom: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: C.CARD, fontSize: 12.5, fontFamily: F.semibold },
  aiTag: {
    position: "absolute",
    right: HOME_PAD,
    bottom: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(92,44,110,0.88)",
  },
  aiTagText: { color: C.CARD, fontSize: 12.5, fontFamily: F.bold, letterSpacing: 0.4 },

  card: {
    marginTop: -28,
    marginHorizontal: HOME_PAD,
    padding: 18,
    borderRadius: 24,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: "rgba(217,206,193,0.6)",
    ...softShadow,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, color: C.INK, fontSize: 23, fontFamily: F.bold, letterSpacing: -0.3 },
  type: { marginTop: 3, color: C.MUTED, fontSize: 13.5, fontFamily: F.regular },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: C.CHIP,
  },
  chipStrong: { backgroundColor: "#EFE8F7" },
  chipText: { color: C.MUTED, fontSize: 12, fontFamily: F.medium },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: C.BG,
  },
  stat: { flex: 1, alignItems: "center" },
  statRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statValue: { color: C.INK, fontSize: 15, fontFamily: F.bold },
  statLabel: { marginTop: 2, color: C.MUTED, fontSize: 11, fontFamily: F.medium },
  statLine: { width: 1, height: 28, backgroundColor: "rgba(217,206,193,0.8)" },

  section: {
    marginTop: 16,
    marginHorizontal: HOME_PAD,
    padding: 18,
    borderRadius: 24,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: "rgba(217,206,193,0.6)",
    ...softShadow,
    shadowOpacity: 0.05,
  },
  overline: { color: C.PLUM, fontSize: 11, fontFamily: F.bold, letterSpacing: 1.6, opacity: 0.8 },
  tabs: {
    flexDirection: "row",
    marginTop: 16,
    marginHorizontal: HOME_PAD,
    padding: 4,
    borderRadius: 999,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.BORDER,
  },
  tab: { flex: 1, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: C.PLUM },
  tabText: { color: C.MUTED, fontSize: 13.5, fontFamily: F.semibold },
  tabTextActive: { color: C.CARD },
  soonCard: { alignItems: "center", paddingVertical: 24 },
  soonIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CHIP,
    borderWidth: 1,
    borderColor: "#E6D9C4",
  },
  soonPill: { marginTop: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: "#EFE8F7" },
  soonPillText: { color: C.PLUM, fontSize: 11, fontFamily: F.bold, letterSpacing: 0.4 },
  soonTitle: { marginTop: 8, color: C.INK, fontSize: 17, fontFamily: F.bold, textAlign: "center" },
  soonText: { marginTop: 6, color: C.MUTED, fontSize: 13.5, lineHeight: 20, fontFamily: F.regular, textAlign: "center" },
  sectionTitle: { marginTop: 3, color: C.INK, fontSize: 18, fontFamily: F.bold },
  sectionText: { marginTop: 8, color: C.MUTED, fontSize: 14, lineHeight: 21.5, fontFamily: F.regular },

  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: HOME_PAD,
    paddingTop: 12,
    backgroundColor: C.CARD,
    borderTopWidth: 1,
    borderTopColor: "rgba(217,206,193,0.6)",
  },
  barPrice: { color: C.INK, fontSize: 20, fontFamily: F.bold },
  barPerMin: { color: C.MUTED, fontSize: 12.5, fontFamily: F.regular },
  barOfferRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  barOld: { color: C.MUTED, fontSize: 12, fontFamily: F.regular, textDecorationLine: "line-through" },
  offer: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: "#E6F2EA" },
  offerText: { color: "#2E7D4F", fontSize: 10.5, fontFamily: F.semibold },
  chatNow: {
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: C.TERRACOTTA,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatNowText: { color: C.CARD, fontSize: 15, fontFamily: F.bold },
});

/* =============================================================
   PAGE STYLES (same look as Home)
============================================================= */

const n = StyleSheet.create({
  hero: { marginTop: 14, borderRadius: 26, backgroundColor: C.PLUM, ...softShadow, shadowOpacity: 0.25 },
  heroClip: { borderRadius: 26, overflow: "hidden", padding: 20, backgroundColor: C.PLUM },
  heroOverline: { color: "rgba(255,253,252,0.65)", fontSize: 11, fontFamily: F.bold, letterSpacing: 1.6 },
  heroTitle: { marginTop: 8, color: C.CARD, fontSize: 25, lineHeight: 30, fontFamily: F.bold, letterSpacing: -0.4, paddingRight: 40 },
  heroText: { marginTop: 8, color: "rgba(255,253,252,0.78)", fontSize: 14, lineHeight: 21, fontFamily: F.regular },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,253,252,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,253,252,0.14)",
  },
  stat: { flex: 1, alignItems: "center" },
  statValueRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statValue: { color: C.CARD, fontSize: 17, fontFamily: F.bold },
  statLabel: { marginTop: 2, color: "rgba(255,253,252,0.62)", fontSize: 11, fontFamily: F.medium },
  statLine: { width: 1, height: 28, backgroundColor: "rgba(255,253,252,0.14)" },
  liveWrap: { width: 8, height: 8, alignItems: "center", justifyContent: "center" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4CC27A" },
  liveRipple: { position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: "#4CC27A" },
  orbits: { position: "absolute", top: -ORBIT * 0.38, right: -ORBIT * 0.32, width: ORBIT, height: ORBIT },

  segmentWrap: {
    marginTop: 16,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.BORDER,
  },
  segment: {
    flexDirection: "row",
    padding: 4,
    gap: 2,
  },
  segmentItem: { minWidth: 56, height: 38, paddingHorizontal: 16, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segmentItemActive: { backgroundColor: C.PLUM },
  segmentText: { color: C.MUTED, fontSize: 13, fontFamily: F.semibold },
  segmentTextActive: { color: C.CARD },

  state: { height: 220, alignItems: "center", justifyContent: "center", gap: 8 },
  stateTitle: { color: C.INK, fontSize: 17, fontFamily: F.bold },
  stateText: { color: C.MUTED, fontSize: 13.5, fontFamily: F.regular },

  card: {
    padding: 14,
    borderRadius: 22,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: "rgba(217,206,193,0.6)",
    ...softShadow,
  },
  cardTop: { flexDirection: "row", alignItems: "center" },
  ring: { width: 66, height: 66, borderRadius: 33, borderWidth: 2, padding: 2 },
  avatar: {
    flex: 1,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#EFE8F7",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: C.PLUM, fontSize: 24, fontFamily: F.bold },
  ringDot: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#2E9E57",
    borderWidth: 2,
    borderColor: C.CARD,
  },
  cardInfo: { flex: 1, minWidth: 0, marginLeft: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { flexShrink: 1, color: C.INK, fontSize: 16, fontFamily: F.bold },
  spec: { marginTop: 2, color: C.MUTED, fontSize: 12.5, fontFamily: F.regular },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  meta: { color: C.MUTED, fontSize: 11.5, fontFamily: F.medium },
  metaDot: { color: C.MUTED, fontSize: 11.5, marginHorizontal: 2 },
  priceCol: { alignItems: "flex-end", marginLeft: 8 },
  price: { color: C.INK, fontSize: 17, fontFamily: F.bold },
  perMin: { color: C.MUTED, fontSize: 11.5, fontFamily: F.regular },
  offerRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  oldPrice: { color: C.MUTED, fontSize: 11.5, fontFamily: F.regular, textDecorationLine: "line-through" },
  offer: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: "#E6F2EA" },
  offerText: { color: "#2E7D4F", fontSize: 10, fontFamily: F.semibold },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12, maxHeight: 26, overflow: "hidden" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: C.CHIP,
  },
  chipStrong: { backgroundColor: "#EFE8F7" },
  chipText: { color: C.MUTED, fontSize: 11.5, fontFamily: F.medium, maxWidth: 130 },

  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(217,206,193,0.6)",
  },
  footLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  status: { fontSize: 12, fontFamily: F.semibold },
  aiTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: "rgba(92,44,110,0.1)",
  },
  aiTagText: { color: C.PLUM, fontSize: 10.5, fontFamily: F.bold, letterSpacing: 0.4 },
  minCredit: { flexShrink: 1, color: C.MUTED, fontSize: 12, fontFamily: F.medium },
  freeMinute: { color: "#2E7D4F", fontFamily: F.semibold },
  chatBtn: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: C.TERRACOTTA,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chatText: { color: C.CARD, fontSize: 13.5, fontFamily: F.bold },
});

// "Choose your reading" sheet: one look per reading type
// (`title` and `line` are translation keys).
const READING_LOOK: Record<string, { title: string; line: string; icon: string; tint: string; color: string }> = {
  vedic: {
    title: "chat.reading.vedicTitle",
    line: "chat.reading.vedicLine",
    icon: "star-four-points-outline",
    tint: "#F6EEDD",
    color: "#8A6A2C",
  },
  kp: {
    title: "chat.reading.kpTitle",
    line: "chat.reading.kpLine",
    icon: "compass-outline",
    tint: "#EFE8F7",
    color: C.PLUM,
  },
  lalkitab: {
    title: "chat.reading.lalkitabTitle",
    line: "chat.reading.lalkitabLine",
    icon: "book-open-variant",
    tint: "#F7F1E8",
    color: "#5B4A3A",
  },
  tarot: {
    title: "chat.reading.tarotTitle",
    line: "chat.reading.tarotLine",
    icon: "cards-playing-outline",
    tint: "#EFE8F7",
    color: C.PLUM,
  },
  numerology: {
    title: "chat.reading.numerologyTitle",
    line: "chat.reading.numerologyLine",
    icon: "numeric-1-box-multiple-outline",
    tint: "#F6EEDD",
    color: "#8A6A2C",
  },
};

const cm = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,24,32,0.5)" },
  sheet: {
    backgroundColor: C.CARD,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: C.BORDER, marginBottom: 16 },

  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  photoRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    borderWidth: 1.5,
    borderColor: "rgba(196,154,74,0.7)",
  },
  photo: {
    flex: 1,
    borderRadius: 30,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFE8F7",
  },
  photoInitial: { color: C.PLUM, fontSize: 22, fontFamily: F.bold },
  onlineDot: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#2E9E5B",
    borderWidth: 2,
    borderColor: C.CARD,
  },
  overline: { color: C.GOLD, fontSize: 10.5, letterSpacing: 1.3, fontFamily: F.bold },
  name: { marginTop: 2, color: C.INK, fontSize: 19, fontFamily: F.bold },
  meta: { marginTop: 1, color: C.MUTED, fontSize: 12.5, fontFamily: F.medium },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F0F8",
    alignSelf: "flex-start",
  },
  lead: { marginTop: 14, color: C.MUTED, fontSize: 13.5, lineHeight: 19, fontFamily: F.regular },

  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: "rgba(217,206,193,0.8)",
    shadowColor: "#2B1A3D",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  medallion: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  optionTitle: { color: C.INK, fontSize: 15.5, fontFamily: F.bold },
  optionLine: { marginTop: 2, color: C.MUTED, fontSize: 12.5, lineHeight: 17, fontFamily: F.regular },
  go: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.PLUM,
  },

  foot: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 },
  footText: { color: C.MUTED, fontSize: 11.5, fontFamily: F.medium },
});
