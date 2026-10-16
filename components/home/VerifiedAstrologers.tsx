
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    LayoutChangeEvent,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_URL, authHeaders } from "../../lib/auth";
import { useAstrologersStore } from "../stores/astrologersStore";
import { minChatCredits, ensureChatCredits } from "../constants/chat";
import { useUserStore } from "../stores/userStore";
import { C as HOME, CardArt, F, HOME_PAD, LIST_BOTTOM, LIST_TOP, SectionHeader, softShadow } from "./homeUi";

// Home palette: astrologers are people, so their actions use terracotta
// (as on the Chat tab); gold marks "verified".
const C = {
  INK: HOME.INK,
  PLUM: HOME.PLUM,
  BUTTON: HOME.TERRACOTTA,
  MUTED: HOME.MUTED,
  CARD: HOME.CARD,
  BORDER: HOME.BORDER,
  VERIFIED: HOME.GOLD,
  ORANGE: HOME.TERRACOTTA,
};

const px = (value: number) =>
  Math.round(value * (Math.min(Dimensions.get("window").width, 430) / 430));

const GAP = 10;

const H_PAD = HOME_PAD;

const CARD_WIDTH_FRACTION = 0.42;
const LIST_PAD_TOP = LIST_TOP;
const LIST_PAD_BOTTOM = LIST_BOTTOM;

const getReadingType = (specialty: string) => {
  const value = String(specialty ?? "").trim().toLowerCase();

  if (value === "vedic astrology" || value === "vedic") return "vedic";
  if (value === "tarot" || value === "tarot reading") return "tarot";
  if (value === "numerology") return "numerology";
  // KP and Lal Kitab chats use the Vedic chat screen (own school).
  if (value === "kp" || value === "kp astrology" || value === "krishnamurti paddhati") return "kp";
  if (value === "lal kitab" || value === "lalkitab") return "lalkitab";

  return null;
};

const getReadingTypes = (astrologer: any): string[] => {
  const specialties =
    Array.isArray(astrologer.specialties) &&
    astrologer.specialties.length > 0
      ? astrologer.specialties
      : [astrologer.type];

  return [
    ...new Set(
      specialties
        .map(getReadingType)
        .filter((value: string | null): value is string => Boolean(value))
    ),
  ];
};

const readingTitle = (type: string) => {
  if (type === "vedic") return "Vedic Astrology";
  if (type === "tarot") return "Tarot";
  if (type === "numerology") return "Numerology";
  if (type === "kp") return "KP Astrology";
  if (type === "lalkitab") return "Lal Kitab";
  return type;
};

const getSpecialtyLabel = (astrologer: any): string => {
  const raw = [
    astrologer.type,
    ...(Array.isArray(astrologer.specialties) ? astrologer.specialties : []),
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  const kept: string[] = [];

  for (const item of raw) {
    const lower = item.toLowerCase();
    const index = kept.findIndex((existing) => {
      const existingLower = existing.toLowerCase();
      return (
        existingLower === lower ||
        existingLower.includes(lower) ||
        lower.includes(existingLower)
      );
    });

    if (index === -1) {
      kept.push(item);
    } else if (item.length > kept[index].length) {
      kept[index] = item;
    }
  }

  return kept.slice(0, 2).join(" · ");
};

export default function VerifiedAstrologers() {
  const insets = useSafeAreaInsets();
  const { user } = useUserStore() as any;

  const {
    astrologers,
    loading,
    error,
    fetchAstrologers,
  } = useAstrologersStore();

  const [selectedAstrologer, setSelectedAstrologer] = useState<any>(null);
  const [chatOptions, setChatOptions] = useState<string[]>([]);
  const [chatModalVisible, setChatModalVisible] = useState(false);

  // Track which astrologer is starting a chat, not a global button state.
  const [startingAstrologerId, setStartingAstrologerId] = useState<string | null>(
    null
  );

  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const [rowWidth, setRowWidth] = useState(
    Dimensions.get("window").width - H_PAD * 2
  );

  const scrollRef = useRef<ScrollView>(null);
  const [scrollX, setScrollX] = useState(0);
  const [contentW, setContentW] = useState(0);
  const [tallestCard, setTallestCard] = useState(0);

  useEffect(() => {
    if (astrologers.length === 0 && !loading) {
      fetchAstrologers();
    }
  }, [astrologers.length, loading, fetchAstrologers]);

  const cardW = Math.round(rowWidth * CARD_WIDTH_FRACTION);
  // Round photo, half-way over the soft band at the top.
  const avatar = Math.round(cardW * 0.46);
  const bandH = Math.round(avatar * 0.62);

  const viewportW = rowWidth + H_PAD * 2;
  const showArrow =
    contentW > viewportW + 4 && scrollX + viewportW < contentW - 8;

  const onLayout = (event: LayoutChangeEvent) => {
    setRowWidth(event.nativeEvent.layout.width);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollX(event.nativeEvent.contentOffset.x);
  };

  const scrollNext = () => {
    scrollRef.current?.scrollTo({
      x: scrollX + (cardW + GAP) * 2,
      animated: true,
    });
  };

  const onCardLayout = (event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    setTallestCard((previous) => (height > previous ? height : previous));
  };

 
const startAstrologerChat = async (
  astrologer: any,
  readingType: string
) => {
  const astrologerId = String(
    astrologer.id || astrologer.astrologer_id
  );

  if (startingAstrologerId === astrologerId) return;

  try {
    setStartingAstrologerId(astrologerId);
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

    // Get wallet balance from the user store.
    const currentWalletBalance = Number(
      user?.credits ?? 0
    );

    // Astrologer price is the per-minute rate.
    const ratePerMinute = Number(astrologer.price);

    const params: Record<string, string> = {
      sessionId: String(data.session_id),
      astrologerId: String(astrologer.astrologer_id),
      astrologerName: String(astrologer.name),
      readingType: String(readingType),
      profileId: String(profileId),

      walletBalance: String(
        Number.isFinite(currentWalletBalance)
          ? Math.max(0, currentWalletBalance)
          : 0
      ),

      ratePerMinute: String(
        Number.isFinite(ratePerMinute)
          ? Math.max(0, ratePerMinute)
          : 0
      ),
    };

    // Prefer remaining time calculated by the backend.
    const remainingTime = Number(
      data.remaining_time_seconds
    );

    if (
      data.remaining_time_seconds != null &&
      Number.isFinite(remainingTime) &&
      remainingTime >= 0
    ) {
      params.remainingTimeSeconds = String(
        Math.floor(remainingTime)
      );
    }

    console.log("[VERIFIED ASTROLOGERS] Chat timer params:", params);

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
    } else if (readingType === "tarot") {
      router.push({
        pathname: "/(root)/chat/tarot",
        params,
      });
    } else if (readingType === "numerology") {
      router.push({
        pathname: "/(root)/chat/numerology",
        params,
      });
    } else {
      console.error("Unsupported reading type:", readingType);
    }
  } catch (err) {
    console.error(
      "Failed to start astrologer chat:",
      err
    );

    // e.g. "This astrologer is busy right now."
    Alert.alert(
      "Can't start chat",
      err instanceof Error ? err.message : "Please try again."
    );
  } finally {
    setStartingAstrologerId(null);
  }
};


  const handleChatNow = async (astrologer: any) => {
    const astrologerId = String(
      astrologer.id || astrologer.astrologer_id
    );

    if (startingAstrologerId === astrologerId) return;

    const types = getReadingTypes(astrologer);

    if (types.length === 1) {
      await startAstrologerChat(astrologer, types[0]);
      return;
    }

    if (types.length > 1) {
      setSelectedAstrologer(astrologer);
      setChatOptions(types);
      setChatModalVisible(true);
      return;
    }

    console.error(
      "No supported reading type for astrologer:",
      astrologer.name,
      astrologer.specialties
    );
  };

  const getImageUrl = (astrologer: any): string | null => {
    const photo = astrologer.photo;

    if (typeof photo === "string" && photo.trim()) {
      return photo;
    }

    if (photo && typeof photo === "object" && typeof photo.uri === "string") {
      return photo.uri;
    }

    if (
      typeof astrologer.avatar === "string" &&
      /^https?:\/\//i.test(astrologer.avatar)
    ) {
      return astrologer.avatar;
    }

    return null;
  };

  const getConsultationLabel = (count: number) => {
    if (count >= 100000) return `${(count / 100000).toFixed(1)}L chats`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K chats`;
    return `${count} chats`;
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      <SectionHeader
        overline="TALK TO AN EXPERT"
        title="Verified astrologers"
        onViewAll={() => router.push("/(root)/(tabs)/chat" as any)}
      />

      {loading && astrologers.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={C.PLUM} />
          <Text style={styles.message}>Finding astrologers...</Text>
        </View>
      ) : error && astrologers.length === 0 ? (
        <Pressable onPress={fetchAstrologers} style={styles.loader}>
          <Text style={styles.message}>
            Couldn’t load astrologers. Tap to retry.
          </Text>
        </Pressable>
      ) : astrologers.length === 0 ? (
        <View style={styles.loader}>
          <Text style={styles.message}>
            No astrologers available right now.
          </Text>
        </View>
      ) : (
        <View style={{ marginHorizontal: -H_PAD }}>
          <ScrollView
            ref={scrollRef}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={cardW + GAP}
            snapToAlignment="start"
            scrollEventThrottle={16}
            onScroll={onScroll}
            onContentSizeChange={(width) => setContentW(width)}
            style={[
              styles.scroll,
              {
                height:
                  // Real card height once measured (270 is only a first guess).
                  (tallestCard || px(270)) +
                  LIST_PAD_TOP +
                  LIST_PAD_BOTTOM,
              },
            ]}
            contentContainerStyle={[
              styles.cards,
              { paddingHorizontal: H_PAD, gap: GAP },
            ]}
          >
            {astrologers.map((astrologer: any) => {
              const id = String(astrologer.id || astrologer.astrologer_id);
              const imageUrl = getImageUrl(astrologer);
              const specialtyLabel = getSpecialtyLabel(astrologer);
              const isStarting = startingAstrologerId === id;

              const rating =
                typeof astrologer.rating === "number"
                  ? astrologer.rating
                  : null;

              const online = Boolean(astrologer.online);

              return (
                <View
                  key={id}
                  onLayout={onCardLayout}
                  style={[styles.card, { width: cardW }]}
                >
                  {/* Soft band with faint orbits behind the photo */}
                  <View style={[styles.band, { height: bandH }]}>
                    <CardArt width={cardW} height={bandH} />
                  </View>

                  {rating !== null && (
                    <View style={styles.rating}>
                      <Icon name="star" size={11} color={HOME.GOLD} />
                      <Text allowFontScaling={false} style={styles.ratingText}>
                        {rating.toFixed(1)}
                      </Text>
                    </View>
                  )}

                  {/* Round photo with a fine ring, online dot on its edge */}
                  <View style={[styles.avatarRing, { width: avatar + 8, height: avatar + 8, borderRadius: (avatar + 8) / 2, marginTop: bandH - (avatar + 8) / 2 }]}>
                    <View style={[styles.avatar, { width: avatar, height: avatar, borderRadius: avatar / 2 }]}>
                      {imageUrl && !imageErrors[id] ? (
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.photo}
                          resizeMode="cover"
                          onError={() =>
                            setImageErrors((previous) => ({
                              ...previous,
                              [id]: true,
                            }))
                          }
                        />
                      ) : (
                        <View style={styles.photoFallback}>
                          <Text style={[styles.initial, { fontSize: Math.round(avatar * 0.38) }]}>
                            {String(astrologer.name || "A").trim().charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View
                      style={[
                        styles.onlineDot,
                        { backgroundColor: online ? "#2E9E57" : "#B8B0B8" },
                      ]}
                    />
                  </View>

                  <View style={styles.details}>
                    <View style={styles.nameRow}>
                      <Text numberOfLines={1} allowFontScaling={false} style={styles.name}>
                        {astrologer.name}
                      </Text>
                      <Icon name="check-decagram" size={14} color={C.VERIFIED} />
                    </View>

                    <Text numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false} style={styles.specialty}>
                      {specialtyLabel || "Astrologer"}
                    </Text>

                    <View style={styles.consultationRow}>
                      <Icon name="chat-processing-outline" size={13} color={C.ORANGE} />
                      <Text numberOfLines={1} allowFontScaling={false} style={styles.consultationText}>
                        {getConsultationLabel(astrologer.consultations || 0)}
                      </Text>
                    </View>

                    <View style={[styles.priceBadge, !online && styles.priceBadgeOff]}>
                      <Text allowFontScaling={false} style={[styles.priceText, !online && styles.priceTextOff]}>
                        {!online
                          ? "Available soon"
                          : user?.free_chat_minute_available
                            ? "1 min free"
                            : `Min ₹${minChatCredits(astrologer.price)} to chat`}
                      </Text>
                    </View>

                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Chat with ${astrologer.name}`}
                      activeOpacity={0.8}
                      disabled={isStarting}
                      onPress={() => handleChatNow(astrologer)}
                      style={[styles.chatButton, isStarting && styles.disabled]}
                    >
                      <Icon name="chat-outline" size={15} color={HOME.CARD} />
                      <Text allowFontScaling={false} style={styles.chatButtonText}>
                        {isStarting ? "Starting..." : "Chat Now"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {showArrow && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show more astrologers"
              onPress={scrollNext}
              style={[
                styles.nextButton,
                {
                  width: Math.round(cardW * 0.3),
                  height: Math.round(cardW * 0.3),
                  borderRadius: Math.round(cardW * 0.15),
                  right: Math.round(cardW * 0.08),
                  top: Math.round(cardW * 0.5),
                },
              ]}
            >
              <Icon
                name="arrow-right"
                size={Math.round(cardW * 0.16)}
                color={C.INK}
              />
            </Pressable>
          )}
        </View>
      )}

      <Modal
        visible={chatModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setChatModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setChatModalVisible(false)}
        >
          <Pressable
            style={[
              styles.modalContent,
              { paddingBottom: insets.bottom + px(18) },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>Choose your reading</Text>

            <Text style={styles.modalSubtitle}>
              {selectedAstrologer?.name} offers multiple types of guidance.
            </Text>

            <View style={styles.options}>
              {chatOptions.map((option) => (
                <Pressable
                  key={option}
                  disabled={
                    startingAstrologerId !== null &&
                    startingAstrologerId ===
                      String(
                        selectedAstrologer?.id ||
                          selectedAstrologer?.astrologer_id
                      )
                  }
                  onPress={() => {
                    if (selectedAstrologer) {
                      startAstrologerChat(selectedAstrologer, option);
                    }
                  }}
                  style={styles.option}
                >
                  <View style={styles.optionIcon}>
                    <Icon
                      name={
                        option === "vedic"
                          ? "star-four-points-outline"
                          : option === "tarot"
                            ? "cards-playing-outline"
                            : option === "kp"
                              ? "compass-outline"
                              : option === "lalkitab"
                                ? "book-open-variant"
                                : "numeric-1-box-multiple-outline"
                      }
                      size={px(22)}
                      color={C.PLUM}
                    />
                  </View>

                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>
                      {readingTitle(option)}
                    </Text>
                    <Text style={styles.optionSubtitle}>
                      Start your {readingTitle(option).toLowerCase()} chat
                    </Text>
                  </View>

                  <Icon
                    name="chevron-right"
                    size={px(22)}
                    color={C.MUTED}
                  />
                </Pressable>
              ))}
            </View>

            <Pressable
              disabled={startingAstrologerId !== null}
              onPress={() => setChatModalVisible(false)}
              style={styles.cancel}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: px(10),
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    paddingRight: px(6),
  },
  heading: {
    fontSize: px(16),
    lineHeight: px(20),
    fontFamily: F.bold,
    color: C.INK,
  },
  subtitle: {
    fontSize: px(10),
    lineHeight: px(14),
    color: C.MUTED,
    marginTop: px(1),
  },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: px(4),
    marginLeft: px(6),
  },
  viewAllText: {
    color: C.PLUM,
    fontSize: px(14),
    fontFamily: F.semibold,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
    overflow: "visible",
  },
  cards: {
    alignItems: "flex-start",
    paddingTop: LIST_PAD_TOP,
    paddingBottom: LIST_PAD_BOTTOM,
  },
  card: {
    backgroundColor: C.CARD,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: HOME.LINE,
    flexShrink: 0,
    alignItems: "center",
    overflow: "hidden",
    ...softShadow,
  },
  band: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: HOME.SOFT,
  },
  rating: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.CARD,
  },
  ratingText: {
    color: C.INK,
    fontSize: 11,
    fontFamily: F.bold,
  },
  avatarRing: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: "rgba(43,26,61,0.18)",
  },
  avatar: {
    overflow: "hidden",
    backgroundColor: HOME.IVORY,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: HOME.SOFT,
  },
  initial: {
    color: C.PLUM,
    fontFamily: F.bold,
  },
  onlineDot: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
    borderColor: C.CARD,
  },
  details: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
  },
  name: {
    flexShrink: 1,
    color: C.INK,
    fontSize: 14.5,
    fontFamily: F.bold,
  },
  specialty: {
    color: C.MUTED,
    fontSize: 11.5,
    fontFamily: F.regular,
    marginTop: 2,
    textAlign: "center",
  },
  consultationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  consultationText: {
    color: C.MUTED,
    fontSize: 11.5,
    fontFamily: F.medium,
  },
  priceBadge: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: "#E6F2EA",
  },
  priceBadgeOff: {
    backgroundColor: "rgba(43,26,61,0.07)",
  },
  priceText: {
    color: "#2E7D4F",
    fontSize: 10.5,
    fontFamily: F.semibold,
  },
  priceTextOff: {
    color: C.MUTED,
  },
  chatButton: {
    alignSelf: "stretch",
    marginTop: 10,
    height: 38,
    borderRadius: 999,
    backgroundColor: C.BUTTON,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  chatButtonText: {
    color: HOME.CARD,
    fontSize: 13,
    fontFamily: F.bold,
  },
  nextButton: {
    position: "absolute",
    backgroundColor: C.CARD,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2B1A3D",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  disabled: {
    opacity: 0.65,
  },
  loader: {
    minHeight: px(100),
    alignItems: "center",
    justifyContent: "center",
    gap: px(8),
  },
  message: {
    fontFamily: F.regular,
    fontSize: px(10),
    color: C.MUTED,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(28,24,32,0.45)",
  },
  modalContent: {
    backgroundColor: C.CARD,
    borderTopLeftRadius: px(24),
    borderTopRightRadius: px(24),
    paddingHorizontal: px(24),
    paddingTop: px(16),
  },
  modalHandle: {
    alignSelf: "center",
    width: px(42),
    height: px(4),
    borderRadius: px(4),
    backgroundColor: C.BORDER,
    marginBottom: px(18),
  },
  modalTitle: {
    fontSize: px(21),
    fontFamily: F.bold,
    color: C.INK,
    textAlign: "center",
  },
  modalSubtitle: {
    fontFamily: F.regular,
    marginTop: px(8),
    fontSize: px(12),
    lineHeight: px(18),
    color: C.MUTED,
    textAlign: "center",
  },
  options: {
    marginTop: px(18),
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: px(13),
    paddingVertical: px(13),
    marginBottom: px(9),
    borderRadius: px(14),
    borderWidth: 1,
    borderColor: C.BORDER,
    backgroundColor: C.CARD,
  },
  optionIcon: {
    width: px(40),
    height: px(40),
    borderRadius: px(20),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F1E8",
  },
  optionText: {
    flex: 1,
    marginLeft: px(12),
  },
  optionTitle: {
    fontSize: px(13),
    fontFamily: F.bold,
    color: C.INK,
  },
  optionSubtitle: {
    fontFamily: F.regular,
    marginTop: px(3),
    fontSize: px(10),
    color: C.MUTED,
  },
  cancel: {
    alignItems: "center",
    paddingVertical: px(12),
  },
  cancelText: {
    fontSize: px(12),
    fontFamily: F.semibold,
    color: C.MUTED,
  },
});
