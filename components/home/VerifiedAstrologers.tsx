
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  BUTTON: "#3A1659",
  MUTED: "#68616A",
  CARD: "#FFFFFF",
  BORDER: "#D9CEC1",
  VERIFIED: "#2998E3",
  ORANGE: "#D2692F",
};

const px = (value: number) =>
  Math.round(value * (Math.min(Dimensions.get("window").width, 430) / 430));

const GAP = 10;

const H_PAD = Math.round(
  16 * (Math.min(Dimensions.get("window").width, 430) / 853)
);

const CARD_WIDTH_FRACTION = 0.33;
const LIST_PAD_TOP = px(4);
const LIST_PAD_BOTTOM = px(12);

const getReadingType = (specialty: string) => {
  const value = String(specialty ?? "").trim().toLowerCase();

  if (value === "vedic astrology" || value === "vedic") return "vedic";
  if (value === "tarot" || value === "tarot reading") return "tarot";
  if (value === "numerology") return "numerology";

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
  const pad = Math.round(cardW * 0.045);
  const inner = cardW - pad * 2;

  // Increased thumbnail height from 60% to 75% of the inner card width.
  const photoH = Math.round(inner * 0.75);

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

    if (readingType === "vedic") {
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
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Talk to verified astrologers</Text>
          <Text style={styles.subtitle}>
            Get personalised guidance from India’s top experts
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(root)/(tabs)/chat" as any)}
          style={styles.viewAll}
          hitSlop={8}
        >
          <Text style={styles.viewAllText}>View all</Text>
          <Icon name="arrow-right" size={px(14)} color={C.PLUM} />
        </Pressable>
      </View>

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
                  Math.max(tallestCard, px(270)) +
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

              return (
                <View
                  key={id}
                  onLayout={onCardLayout}
                  style={[
                    styles.card,
                    {
                      width: cardW,
                      padding: pad,
                      borderRadius: Math.round(cardW * 0.1),
                    },
                  ]}
                >
                  <LinearGradient
                    colors={["#FDEBD3", "#F7D2A6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.photoContainer,
                      {
                        height: photoH,
                        borderRadius: Math.round(cardW * 0.07),
                      },
                    ]}
                  >
                    <Icon
                      name="leaf"
                      size={Math.round(cardW * 0.5)}
                      color={C.ORANGE}
                      style={{
                        position: "absolute",
                        right: -Math.round(cardW * 0.06),
                        bottom: -Math.round(cardW * 0.04),
                        opacity: 0.16,
                      }}
                    />

                    <Icon
                      name="leaf"
                      size={Math.round(cardW * 0.34)}
                      color={C.ORANGE}
                      style={{
                        position: "absolute",
                        left: -Math.round(cardW * 0.04),
                        bottom: Math.round(cardW * 0.02),
                        opacity: 0.12,
                        transform: [{ scaleX: -1 }],
                      }}
                    />

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
                        <Icon
                          name="account"
                          size={Math.round(cardW * 0.4)}
                          color={C.PLUM}
                        />
                      </View>
                    )}

                    <View
                      style={[
                        styles.onlineDot,
                        {
                          top: Math.round(cardW * 0.05),
                          left: Math.round(cardW * 0.05),
                          width: Math.round(cardW * 0.075),
                          height: Math.round(cardW * 0.075),
                          borderRadius: Math.round(cardW * 0.0375),
                          backgroundColor: astrologer.online
                            ? "#2DB55D"
                            : "#B8B0B8",
                        },
                      ]}
                    />

                    {rating !== null && (
                      <View
                        style={[
                          styles.rating,
                          {
                            top: Math.round(cardW * 0.04),
                            right: Math.round(cardW * 0.04),
                            gap: Math.round(cardW * 0.02),
                            paddingHorizontal: Math.round(cardW * 0.05),
                            paddingVertical: Math.round(cardW * 0.025),
                            borderRadius: Math.round(cardW * 0.1),
                          },
                        ]}
                      >
                        <Icon
                          name="star"
                          size={Math.round(cardW * 0.085)}
                          color="#F2A81D"
                        />
                        <Text
                          allowFontScaling={false}
                          style={[
                            styles.ratingText,
                            { fontSize: Math.round(cardW * 0.08) },
                          ]}
                        >
                          {rating.toFixed(1)}
                        </Text>
                      </View>
                    )}
                  </LinearGradient>

                  <View style={styles.details}>
                    <View
                      style={[
                        styles.nameRow,
                        { gap: Math.round(cardW * 0.03) },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        allowFontScaling={false}
                        style={[
                          styles.name,
                          { fontSize: Math.round(cardW * 0.098) },
                        ]}
                      >
                        {astrologer.name}
                      </Text>
                      <Icon
                        name="check-decagram"
                        size={Math.round(cardW * 0.11)}
                        color={C.VERIFIED}
                      />
                    </View>

                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      allowFontScaling={false}
                      style={[
                        styles.specialty,
                        {
                          fontSize: Math.round(cardW * 0.08),
                          marginTop: Math.round(cardW * 0.02),
                        },
                      ]}
                    >
                      {specialtyLabel}
                    </Text>

                    <View
                      style={[
                        styles.consultationRow,
                        {
                          gap: Math.round(cardW * 0.03),
                          marginTop: Math.round(cardW * 0.035),
                        },
                      ]}
                    >
                      <Icon
                        name="chat-processing-outline"
                        size={Math.round(cardW * 0.095)}
                        color={C.ORANGE}
                      />
                      <Text
                        numberOfLines={1}
                        allowFontScaling={false}
                        style={[
                          styles.consultationText,
                          { fontSize: Math.round(cardW * 0.08) },
                        ]}
                      >
                        {getConsultationLabel(astrologer.consultations || 0)}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.priceBadge,
                        {
                          borderRadius: Math.round(cardW * 0.08),
                          paddingHorizontal: Math.round(cardW * 0.06),
                          paddingVertical: Math.round(cardW * 0.025),
                          marginTop: Math.round(cardW * 0.045),
                        },
                      ]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.priceText,
                          { fontSize: Math.round(cardW * 0.075) },
                        ]}
                      >
                        {!astrologer.online
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
                      style={[
                        styles.chatButton,
                        {
                          height: Math.max(
                            px(34),
                            Math.round(cardW * 0.22)
                          ),
                          borderRadius: Math.round(cardW * 0.065),
                          marginTop: Math.round(cardW * 0.06),
                        },
                        isStarting && styles.disabled,
                      ]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.chatButtonText,
                          { fontSize: Math.round(cardW * 0.092) },
                        ]}
                      >
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
    marginTop: px(20),
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
    fontWeight: "700",
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
    fontWeight: "600",
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
    borderWidth: 1,
    borderColor: "rgba(217,206,193,0.45)",
    flexShrink: 0,
    shadowColor: "#2B1A3D",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  photoContainer: {
    overflow: "hidden",
    position: "relative",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: C.CARD,
  },
  rating: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.CARD,
  },
  ratingText: {
    color: C.INK,
    fontWeight: "700",
  },
  details: {
    flexShrink: 0,
    paddingBottom: px(3),
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    flexShrink: 1,
    color: C.INK,
    fontWeight: "700",
  },
  specialty: {
    color: C.MUTED,
  },
  consultationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  consultationText: {
    color: C.MUTED,
    flexShrink: 1,
  },
  priceBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#DDF5DA",
  },
  priceText: {
    color: "#237A32",
    fontWeight: "600",
  },
  chatButton: {
    width: "100%",
    backgroundColor: C.BUTTON,
    alignItems: "center",
    justifyContent: "center",
  },
  chatButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
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
    fontWeight: "800",
    color: C.INK,
    textAlign: "center",
  },
  modalSubtitle: {
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
    fontWeight: "700",
    color: C.INK,
  },
  optionSubtitle: {
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
    fontWeight: "600",
    color: C.MUTED,
  },
});
