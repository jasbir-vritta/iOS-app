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

const categories = [
   {
    id: "all",
    title: "All",
    icon: "apps",
    w: 110,
  },
  {
    id: "vedic",
    title: "Vedic",
    icon: "star-outline",
    w: 150,
  },
  {
    id: "tarot",
    title: "Tarot",
    icon: "cards-playing-outline",
    w: 135,
  },
  {
    id: "numerology",
    title: "Numerology",
    icon: "numeric-1-box-multiple-outline",
    w: 180,
  },
  {
    id: "kp",
    title: "KP",
    icon: "compass-outline",
    w: 100,
  },
  {
    id: "lalkitab",
    title: "Lal Kitab",
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

const consultLabel = (count: number) => {
  if (count >= 100000) return `${(count / 100000).toFixed(1)}L chats`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K chats`;
  return `${count} chats`;
};

const LIST_TITLE: Record<string, string> = {
  all: "All astrologers",
  vedic: "Vedic astrologers",
  tarot: "Tarot readers",
  numerology: "Numerologists",
  kp: "KP astrologers",
  lalkitab: "Lal Kitab experts",
};

export default function Chat() {
  // Analytics: visited_chat each time the Chat tab comes on screen.
  useFocusEffect(
    useCallback(() => {
      track("visited_chat", { platform: Platform.OS });
    }, [])
  );

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
      "Can't start chat",
      error instanceof Error ? error.message : "Please try again."
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
          (t) => t.label
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
   * Fetch astrologers.
   */
  useEffect(() => {
  fetchAstrologers();
}, [fetchAstrologers]);

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
                  <Text style={cm.overline}>CHOOSE YOUR READING</Text>
                  <Text style={cm.name} numberOfLines={1}>{chatAstrologer?.name}</Text>
                  <Text style={cm.meta} numberOfLines={1}>
                    ₹{chatAstrologer?.price}/min · {chatAstrologer?.experience}+ yrs
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setChatModalVisible(false)}
                  disabled={startingChat}
                  hitSlop={10}
                  style={cm.close}
                  accessibilityLabel="Close"
                >
                  <Icon name="close" size={18} color={C.INK} />
                </TouchableOpacity>
              </View>

              <Text style={cm.lead}>
                {chatAstrologer?.name?.split(" ")[0]} reads in {chatOptions.length} ways. Pick how you’d like to be guided.
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
                          <Text style={cm.optionTitle}>{look.title}</Text>
                          <Text style={cm.optionLine} numberOfLines={2}>{look.line}</Text>
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
                <Text style={cm.footText}>Same price for every reading · charged per minute</Text>
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
                <Text style={n.heroOverline}>EXPERT GUIDANCE</Text>
                <Text style={n.heroTitle}>Talk to a verified astrologer</Text>
                <Text style={n.heroText}>
                  Clarity for love, career, family and more, in a private chat.
                </Text>

                <View style={n.heroStats}>
                  <View style={n.stat}>
                    <View style={n.statValueRow}>
                      <LiveDot still={still} />
                      <CountUp value={onlineCount} still={still} style={n.statValue} />
                    </View>
                    <Text style={n.statLabel}>Online now</Text>
                  </View>
                  <View style={n.statLine} />
                  <View style={n.stat}>
                    <CountUp value={astrologers.length} still={still} style={n.statValue} />
                    <Text style={n.statLabel}>Experts</Text>
                  </View>
                  <View style={n.statLine} />
                  <View style={n.stat}>
                    <View style={n.statValueRow}>
                      <Icon name="check-decagram" size={15} color={C.GOLD} />
                      <Text style={n.statValue}>100%</Text>
                    </View>
                    <Text style={n.statLabel}>Verified</Text>
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
                      {category.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              </ScrollView>
            </Reanimated.View>

            <Reanimated.View entering={enter(2)}>
              <SectionHeader
                overline={`${list.length} VERIFIED EXPERT${list.length === 1 ? "" : "S"}`}
                title={LIST_TITLE[selectedCategory] || "All astrologers"}
              />
            </Reanimated.View>

            {/* =========================================================
                ASTROLOGER CARDS
            ========================================================= */}

            {loadingAstrologers && astrologers.length === 0 ? (
              <View style={n.state}>
                <ActivityIndicator size="large" color={C.PLUM} />
                <Text style={n.stateText}>Finding astrologers…</Text>
              </View>
            ) : sortedList.length === 0 ? (
              <View style={n.state}>
                <Icon name="account-search-outline" size={30} color={C.PLUM} />
                <Text style={n.stateTitle}>No experts found</Text>
                <Text style={n.stateText}>Try another category</Text>
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
                      accessibilityLabel={`${a.name}, ${a.online ? "online" : "offline"}, ₹${a.price} per minute`}
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
                            {a.specialties.join(" · ")}
                          </Text>
                          <View style={n.metaRow}>
                            <Icon name="chat-processing-outline" size={12} color={C.TERRACOTTA} />
                            <Text style={n.meta}>{consultLabel(Number(a.consultations) || 0)}</Text>
                            <Text style={n.metaDot}>·</Text>
                            <Text style={n.meta}>{a.experience}+ yrs</Text>
                          </View>
                        </View>

                        <View style={n.priceCol}>
                          <Text style={n.price}>
                            ₹{a.price}
                            <Text style={n.perMin}>/min</Text>
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
                        {topics.map((t) => (
                          <View key={t.label} style={n.chip}>
                            <Icon name={t.icon as any} size={12} color={C.MUTED} />
                            <Text style={n.chipText} numberOfLines={1}>
                              {t.label}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <View style={n.cardFoot}>
                        <View style={n.footLeft}>
                          <View style={[n.statusDot, { backgroundColor: a.online ? "#2E9E57" : "#B8B0B8" }]} />
                          <Text style={[n.status, { color: a.online ? "#2E7D4F" : C.MUTED }]}>
                            {a.online ? "Online" : "Offline"}
                          </Text>
                          <Text style={n.metaDot}>·</Text>
                          <Text
                            style={[n.minCredit, user?.free_chat_minute_available && n.freeMinute]}
                            numberOfLines={1}
                          >
                            {user?.free_chat_minute_available ? "1 min free" : `Min ₹${minChatCredits(a.price)}`}
                          </Text>
                        </View>

                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`Chat with ${a.name}`}
                          activeOpacity={0.85}
                          disabled={startingChat}
                          onPress={() => handleAstrologerChat(a)}
                          style={[n.chatBtn, startingChat && { opacity: 0.6 }]}
                        >
                          <Icon name="chat-outline" size={15} color={C.CARD} />
                          <Text style={n.chatText}>Chat</Text>
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
                  accessibilityLabel="Go back"
                  style={[m.roundBtn, { top: insets.top + 8, left: HOME_PAD }]}
                >
                  <Icon name="arrow-left" size={22} color={C.PLUM} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    Share.share({
                      message: `Talk to ${selectedAstrologer.name}, a verified ${selectedAstrologer.type.toLowerCase()} expert on Vritta.`,
                    }).catch(() => {})
                  }
                  hitSlop={12}
                  accessibilityLabel={`Share ${selectedAstrologer.name}`}
                  style={[m.roundBtn, { top: insets.top + 8, right: HOME_PAD }]}
                >
                  <Icon name="share-variant" size={20} color={C.PLUM} />
                </TouchableOpacity>

                <View style={[m.status, { backgroundColor: selectedAstrologer.online ? "rgba(46,125,79,0.92)" : "rgba(28,24,32,0.7)" }]}>
                  <View style={[m.statusDot, { backgroundColor: selectedAstrologer.online ? "#7EE2A3" : "#B8B0B8" }]} />
                  <Text style={m.statusText}>{selectedAstrologer.online ? "Online now" : "Offline"}</Text>
                </View>
              </View>

              {/* Profile */}
              <View style={m.card}>
                <View style={m.nameRow}>
                  <Text style={m.name} numberOfLines={1}>
                    {selectedAstrologer.name}
                  </Text>
                  <Icon name="check-decagram" size={18} color={C.GOLD} />
                </View>
                <Text style={m.type}>{selectedAstrologer.specialties.join(" · ") || selectedAstrologer.type}</Text>

                <View style={m.chips}>
                  {!!selectedAstrologer.archetype && (
                    <View style={[m.chip, m.chipStrong]}>
                      <Icon name={(selectedAstrologer.archetypeIcon || "star-four-points-outline") as any} size={13} color={C.PLUM} />
                      <Text style={[m.chipText, { color: C.PLUM }]}>{selectedAstrologer.archetype}</Text>
                    </View>
                  )}
                  {(selectedAstrologer.topics || []).slice(0, 3).map((t) => (
                    <View key={t.label} style={m.chip}>
                      <Icon name={t.icon as any} size={13} color={C.MUTED} />
                      <Text style={m.chipText}>{t.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={m.stats}>
                  <View style={m.stat}>
                    <Text style={m.statValue}>{consultLabel(Number(selectedAstrologer.consultations) || 0)}</Text>
                    <Text style={m.statLabel}>Consultations</Text>
                  </View>
                  <View style={m.statLine} />
                  <View style={m.stat}>
                    <Text style={m.statValue}>{selectedAstrologer.experience}+ yrs</Text>
                    <Text style={m.statLabel}>Experience</Text>
                  </View>
                  <View style={m.statLine} />
                  <View style={m.stat}>
                    <View style={m.statRow}>
                      <Icon name="check-decagram" size={14} color={C.GOLD} />
                      <Text style={m.statValue}>Verified</Text>
                    </View>
                    <Text style={m.statLabel}>Expert</Text>
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
                        {tab === "about" ? "About" : "Reviews"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {profileTab === "about" ? (
                <View style={m.section}>
                  <Text style={m.overline}>ABOUT</Text>
                  <Text style={m.sectionTitle}>Meet {selectedAstrologer.name.split(" ")[0]}</Text>
                  <Text style={m.sectionText}>
                    {selectedAstrologer.description ||
                      `Namaste, I’m ${selectedAstrologer.name}. I help you understand your strengths, challenges and the right direction forward.`}
                  </Text>
                </View>
              ) : (
                <View style={[m.section, m.soonCard]}>
                  <View style={m.soonIcon}>
                    <Icon name="star-outline" size={24} color={C.GOLD} />
                  </View>
                  <View style={m.soonPill}>
                    <Text style={m.soonPillText}>Coming soon</Text>
                  </View>
                  <Text style={m.soonTitle}>Reviews are on their way</Text>
                  <Text style={m.soonText}>
                    Soon you’ll be able to read what others say about {selectedAstrologer.name.split(" ")[0]} and share your own experience.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Price and chat */}
            <View style={[m.bar, { paddingBottom: insets.bottom + 12 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={m.barPrice}>
                  ₹{selectedAstrologer.price}
                  <Text style={m.barPerMin}>/min</Text>
                </Text>
                <View style={m.barOfferRow}>
                  {Number(selectedAstrologer.oldPrice) > Number(selectedAstrologer.price) && (
                    <Text style={m.barOld}>₹{selectedAstrologer.oldPrice}/min</Text>
                  )}
                  {(user?.free_chat_minute_available || !!selectedAstrologer.discount) && (
                    <View style={m.offer}>
                      <Text style={m.offerText}>
                        {user?.free_chat_minute_available ? "1 min free" : selectedAstrologer.discount}
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
                <Text style={m.chatNowText}>Chat now</Text>
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

// "Choose your reading" sheet: one look per reading type.
const READING_LOOK: Record<string, { title: string; line: string; icon: string; tint: string; color: string }> = {
  vedic: {
    title: "Vedic Astrology",
    line: "Your birth chart, dashas and yogas",
    icon: "star-four-points-outline",
    tint: "#F6EEDD",
    color: "#8A6A2C",
  },
  kp: {
    title: "KP Astrology",
    line: "Precise timing for a specific question",
    icon: "compass-outline",
    tint: "#EFE8F7",
    color: C.PLUM,
  },
  lalkitab: {
    title: "Lal Kitab",
    line: "Chart reading with simple remedies",
    icon: "book-open-variant",
    tint: "#F7F1E8",
    color: "#5B4A3A",
  },
  tarot: {
    title: "Tarot",
    line: "Draw cards for clarity on what’s happening now",
    icon: "cards-playing-outline",
    tint: "#EFE8F7",
    color: C.PLUM,
  },
  numerology: {
    title: "Numerology",
    line: "Your birth date and name numbers",
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
