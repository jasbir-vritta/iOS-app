import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAstrologersStore } from "../../../components/stores/astrologersStore";
import { useUserStore } from "../../../components/stores/userStore";
import TopBar from "../../../components/TopBar";
import { ensureChatCredits, minChatCredits } from "../../../components/constants/chat";
import { API_URL, authHeaders } from "../../../lib/auth";
/*
 * All sizes below are measured in pixels of the reference design (853px wide)
 * and scaled to the device, so the layout keeps the same proportions on any phone.
 */

const K =
  Math.min(Dimensions.get("window").width, 430) / 853;

const px = (n: number) =>
  Math.round(n * K * 100) / 100;

const fs = (n: number) =>
  Math.max(9, px(n));

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
  return null;
};

export default function Chat() {
  const insets = useSafeAreaInsets();

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

    if (readingType === "vedic") {
      
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
  const openAstrologerProfile = (
    astrologer: Astrologer
  ) => {
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
          paddingHorizontal: px(40),
          paddingTop:
            insets.top + 4,
          paddingBottom: px(260),
        }}
      >
        {/* =========================================================
            CHAT READING TYPE MODAL
        ========================================================= */}

        <Modal
          visible={chatModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() =>
            setChatModalVisible(false)
          }
        >
          <Pressable
            style={{
              flex: 1,
              justifyContent:
                "flex-end",
              backgroundColor:
                "rgba(28,24,32,0.45)",
            }}
            onPress={() =>
              setChatModalVisible(
                false
              )
            }
          >
            <Pressable
              style={{
                backgroundColor:
                  C.CARD,
                borderTopLeftRadius:
                  px(28),
                borderTopRightRadius:
                  px(28),
                paddingHorizontal:
                  px(28),
                paddingTop: px(18),
                paddingBottom:
                  insets.bottom +
                  px(18),
              }}
              onPress={(event) =>
                event.stopPropagation()
              }
            >
              <View
                style={{
                  alignSelf: "center",
                  width: px(42),
                  height: px(4),
                  borderRadius: px(4),
                  backgroundColor:
                    C.BORDER,
                  marginBottom:
                    px(20),
                }}
              />

              <Text
                style={{
                  fontSize: fs(24),
                  fontWeight: "800",
                  color: C.INK,
                  textAlign: "center",
                }}
              >
                Choose your reading
              </Text>

              <Text
                style={{
                  marginTop: px(8),
                  fontSize: fs(14),
                  lineHeight:
                    fs(20),
                  color: C.MUTED,
                  textAlign:
                    "center",
                }}
              >
                {
                  chatAstrologer?.name
                }{" "}
                offers multiple types
                of guidance.
              </Text>

              <View
                style={{
                  marginTop: px(20),
                }}
              >
                {chatOptions.map(
                  (option) => {
                    const title =
                      option ===
                      "vedic"
                        ? "Vedic Astrology"
                        : option ===
                          "tarot"
                        ? "Tarot"
                        : "Numerology";

                    const icon =
                      option ===
                      "vedic"
                        ? "star-four-points-outline"
                        : option ===
                          "tarot"
                        ? "cards-playing-outline"
                        : "numeric-1-box-multiple-outline";

                    return (
                      <Pressable
                        key={option}
                        disabled={
                          startingChat
                        }
                        onPress={() => {
                          if (
                            !chatAstrologer
                          )
                            return;

                          startAstrologerChat(
                            chatAstrologer,
                            option
                          );
                        }}
                        style={{
                          flexDirection:
                            "row",
                          alignItems:
                            "center",
                          paddingHorizontal:
                            px(16),
                          paddingVertical:
                            px(15),
                          marginBottom:
                            px(10),
                          borderRadius:
                            px(18),
                          borderWidth: 1,
                          borderColor:
                            C.BORDER,
                          backgroundColor:
                            C.CARD,
                          opacity:
                            startingChat
                              ? 0.6
                              : 1,
                        }}
                      >
                        <View
                          style={{
                            width: px(44),
                            height: px(44),
                            borderRadius:
                              px(22),
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            backgroundColor:
                              "#F7F1E8",
                          }}
                        >
                          <Icon
                            name={
                              icon as any
                            }
                            size={px(22)}
                            color={
                              C.PLUM
                            }
                          />
                        </View>

                        <View
                          style={{
                            flex: 1,
                            marginLeft:
                              px(14),
                          }}
                        >
                          <Text
                            style={{
                              fontSize:
                                fs(16),
                              fontWeight:
                                "700",
                              color:
                                C.INK,
                            }}
                          >
                            {title}
                          </Text>

                          <Text
                            style={{
                              marginTop:
                                px(3),
                              fontSize:
                                fs(12),
                              color:
                                C.MUTED,
                            }}
                          >
                            Start your{" "}
                            {title.toLowerCase()}{" "}
                            chat
                          </Text>
                        </View>

                        <Icon
                          name="chevron-right"
                          size={px(22)}
                          color={
                            C.MUTED
                          }
                        />
                      </Pressable>
                    );
                  }
                )}
              </View>

              <Pressable
                disabled={
                  startingChat
                }
                onPress={() =>
                  setChatModalVisible(
                    false
                  )
                }
                style={{
                  alignItems:
                    "center",
                  paddingVertical:
                    px(12),
                }}
              >
                <Text
                  style={{
                    fontSize: fs(15),
                    fontWeight: "600",
                    color: C.MUTED,
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* =========================================================
            HEADER
        ========================================================= */}

        <TopBar />

        {/* =========================================================
            TOP BANNER
        ========================================================= */}

        <ImageBackground
          source={require(
            "../../../assets/backgrounds/chat_top_banner.png"
          )}
          resizeMode="cover"
          style={s.topBanner}
        >
          <Text style={s.eyebrow}>
            EXPERT GUIDANCE
          </Text>

          <Text style={s.title}>
            Astrologers
          </Text>

          <Text style={s.subtitle}>
            Get clarity for love,
            {"\n"}
            career, family and more.
          </Text>
        </ImageBackground>

        {/* =========================================================
            CATEGORIES
        ========================================================= */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            s.categoryRow
          }
        >
          {categories.map(
            (category) => {
              const active =
                category.id ===
                selectedCategory;

              return (
                <Pressable
                  key={category.id}
                  onPress={() =>
                    onCategory(
                      category.id
                    )
                  }
                  style={[
                    s.category,
                    {
                      width: px(
                        category.w
                      ),
                    },
                    active &&
                      s.categoryActive,
                  ]}
                >
                  <Icon
                    name={
                      category.icon as any
                    }
                    size={px(28)}
                    color={
                      active
                        ? C.CARD
                        : C.PLUM
                    }
                  />

                  <Text
                    style={[
                      s.categoryText,
                      active &&
                        s.categoryTextActive,
                    ]}
                  >
                    {category.title}
                  </Text>
                </Pressable>
              );
            }
          )}
        </ScrollView>

        {/* =========================================================
            FIND MY MATCH
        ========================================================= */}

        <ImageBackground
          source={require(
            "../../../assets/backgrounds/chat_mid_banner.png"
          )}
          resizeMode="cover"
          imageStyle={{
            borderRadius: px(22),
          }}
          style={s.match}
        >
          <Text
            style={s.matchTitle}
          >
            Not sure{" "}
            <Text
              style={{
                color: "#EBBA52",
              }}
            >
              who to choose?
            </Text>
          </Text>

          <Text style={s.matchSub}>
            Share what's on your mind
            and we'll find the right
            astrologer for you.
          </Text>

          <Pressable
            style={s.matchBtn}
          >
            <Text
              style={s.matchBtnText}
            >
              Find My Match
            </Text>

            <Icon
              name="arrow-right"
              size={px(30)}
              color={C.PLUM}
              style={{
                marginLeft: px(10),
              }}
            />
          </Pressable>
        </ImageBackground>

        {/* =========================================================
            ASTROLOGER CARDS
        ========================================================= */}

        {loadingAstrologers ? (
          <View
            style={{
              height: px(300),
              alignItems:
                "center",
              justifyContent:
                "center",
            }}
          >
            <ActivityIndicator
              size="large"
              color={C.PLUM}
            />

            <Text
              style={{
                marginTop:
                  px(12),
                fontSize: fs(16),
                color: C.MUTED,
              }}
            >
              Loading astrologers...
            </Text>
          </View>
        ) : list.length === 0 ? (
          <View style={s.empty}>
            <Text
              style={{
                fontSize: fs(34),
                fontWeight: "700",
                color: C.INK,
              }}
            >
              No experts found
            </Text>

            <Text
              style={{
                marginTop: px(8),
                fontSize: fs(26),
                color: C.MUTED,
              }}
            >
              Try another category
            </Text>
          </View>
        ) : (
          <View
  style={{
    marginTop: px(17),
    gap: px(15),
  }}
>
  {list.map((a) => (
    <Pressable
      key={a.id}
      onPress={() =>
        openAstrologerProfile(a)
      }
      style={s.card}
    >
      {/* PHOTO */}
      <View style={s.photo}>
        {a.photo ? (
          <Image
            source={{
              uri: a.photo,
            }}
            style={
              StyleSheet.absoluteFill
            }
            resizeMode="cover"
          />
        ) : (
          <View
            style={
              s.photoFallback
            }
          >
            <Text
              style={{
                fontSize: fs(84),
                fontWeight: "700",
                color: C.PLUM,
              }}
            >
              {a.avatar}
            </Text>
          </View>
        )}

        {/* CONSULTATIONS */}
        <View style={s.consult}>
          <Icon
            name="account-group"
            size={px(26)}
            color={C.PLUM}
          />

          <Text
            style={s.consultText}
            numberOfLines={1}
          >
            {a.consultations}
          </Text>
        </View>
      </View>

      {/* INFO */}
      <View style={s.info}>
        {/* ONLINE */}
        {a.online && (
          <View style={s.onlineInfo}>
            <View style={s.onlineInfoDot} />

            <Text style={s.onlineInfoText}>
              Online
            </Text>
          </View>
        )}

        {/* NAME */}
        <View style={s.nameRow}>
          <Text
            style={s.name}
            numberOfLines={1}
          >
            {a.name}
          </Text>

          <Icon
            name="check-decagram"
            size={px(36)}
            color={C.GOLD}
            style={{
              marginLeft: px(8),
            }}
          />
        </View>

        {/* TYPE */}
        <Text style={s.type}>
          {a.specialties.join(" · ")}
        </Text>

        {/* ARCHETYPE + EXPERIENCE */}
        <View style={s.chipRow}>
          <View style={s.chip}>
            <Icon
              name={
                a.archetypeIcon as any
              }
              size={px(26)}
              color={C.PLUM}
            />

            <Text
              style={s.chipText}
              numberOfLines={1}
            >
              {a.archetype}
            </Text>
          </View>

          <View
            style={[
              s.chip,
              {
                flexShrink: 1,
              },
            ]}
          >
            <Text style={s.chipText}>
              {a.experience}+
              {" "}
              years
            </Text>
          </View>
        </View>

        {/* TOPICS */}
        <View style={s.topicRow}>
          {a.topics.map((t) => (
            <View
              key={t.label}
              style={s.topic}
            >
              <Icon
                name={
                  t.icon as any
                }
                size={px(24)}
                color={C.PLUM}
              />

              <Text
                style={s.topicText}
                numberOfLines={1}
              >
                {t.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* PRICE */}
      <View style={s.priceCol}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
          }}
        >
          <Text style={s.price}>
            {a.price}
          </Text>

          <Text style={s.perMin}>
            /min
          </Text>
        </View>

        <View style={s.offerRow}>
          <Text style={s.oldPrice}>
            {a.oldPrice}
          </Text>

          <View style={s.offer}>
            <Text style={s.offerText}>
              {a.discount}
            </Text>
          </View>
        </View>

        <Text
          style={[
            s.minCredits,
            user?.free_chat_minute_available && s.freeMinute,
          ]}
        >
          {user?.free_chat_minute_available
            ? "1 min free"
            : `Min ₹${minChatCredits(a.price)}`}
        </Text>
      </View>

      {/* CHAT */}
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          handleAstrologerChat(a);
        }}
        style={s.chatBtn}
      >
        <Icon
          name="message-processing"
          size={px(36)}
          color="#fff"
        />

        <Text style={s.chatText}>
          Chat
        </Text>
      </Pressable>
    </Pressable>
  ))}
</View>
        )}
      </ScrollView>

      {/* =========================================================
          ASTROLOGER PROFILE MODAL
      ========================================================= */}

      <Modal
        visible={
          selectedAstrologer !== null
        }
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={
          closeAstrologerProfile
        }
      >
        {selectedAstrologer && (
          <View
            style={
              modalStyles.container
            }
          >
            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={{
                paddingBottom:
                  px(130),
              }}
            >
              {/* =================================================
                  PROFILE IMAGE
              ================================================= */}

              <View
  style={[
    modalStyles.hero,
    {
      position: "relative",
    },
  ]}
>
                {selectedAstrologer.photo ? (
                  <Image
                    source={{
                      uri: selectedAstrologer.photo,
                    }}
                    style={
                      StyleSheet.absoluteFill
                    }
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={
                      modalStyles.heroFallback
                    }
                  >
                    <Text
                      style={
                        modalStyles.heroInitial
                      }
                    >
                      {
                        selectedAstrologer.avatar
                      }
                    </Text>
                  </View>
                )}

                {/* Back button */}
                <Pressable
  onPress={() => {
    console.log("BACK BUTTON PRESSED");
    closeAstrologerProfile();
  }}
  style={[
    modalStyles.backButton,
    {
      position: "absolute",
      top: insets.top + px(1),
      left: px(16),
      width: px(68),
      height: px(68),
      zIndex: 99999,
      elevation: 999,
      justifyContent: "center",
      alignItems: "center",
    },
  ]}
  hitSlop={20}
>
  <Icon
    name="arrow-left"
    size={px(48)}
    color={C.PLUM}
  />
</Pressable>

                {/* Share button */}
                <Pressable
                  style={[
                    modalStyles.shareButton,
    {
      position: "absolute",
      top: insets.top + px(1),
      right: px(16),
      width: px(68),
      height: px(68),
      zIndex: 99999,
      elevation: 999,
      justifyContent: "center",
      alignItems: "center",
    }]
                  }
                >
                  <Icon
                    name="share-variant"
                    size={px(48)}
                    color={
                      C.PLUM
                    }
                  />
                </Pressable>

                {/* Online */}
                {selectedAstrologer.online && (
                  <View
                    style={
                      modalStyles.heroOnline
                    }
                  >
                    <View
                      style={
                        modalStyles.heroOnlineDot
                      }
                    />

                    <Text
                      style={
                        modalStyles.heroOnlineText
                      }
                    >
                      Online
                    </Text>
                  </View>
                )}
              </View>

              {/* =================================================
                  PROFILE INFORMATION
              ================================================= */}

              <View
                style={
                  modalStyles.profileCard
                }
              >
                {/* Name */}
                <View
                  style={
                    modalStyles.profileNameRow
                  }
                >
                  <Text
                    style={
                      modalStyles.profileName
                    }
                    numberOfLines={1}
                  >
                    {
                      selectedAstrologer.name
                    }
                  </Text>

                  <Icon
                    name="check-decagram"
                    size={px(31)}
                    color={C.GOLD}
                  />
                </View>

                {/* Type */}
                <Text
                  style={
                    modalStyles.profileType
                  }
                >
                  {
                    selectedAstrologer.type
                  }
                </Text>

                {/* Archetype + Experience */}
                <View
                  style={
                    modalStyles.profileChipRow
                  }
                >
                  <View
                    style={
                      modalStyles.profileChip
                    }
                  >
                    <Icon
                      name={
                        selectedAstrologer.archetypeIcon as any
                      }
                      size={px(25)}
                      color={C.PLUM}
                    />

                    <Text
                      style={
                        modalStyles.profileChipText
                      }
                    >
                      {
                        selectedAstrologer.archetype
                      }
                    </Text>
                  </View>

                  <View
                    style={
                      modalStyles.profileChip
                    }
                  >
                    <Icon
                      name="star-outline"
                      size={px(25)}
                      color={C.PLUM}
                    />

                    <Text
                      style={
                        modalStyles.profileChipText
                      }
                    >
                      {
                        selectedAstrologer.experience
                      }
                      + years
                    </Text>
                  </View>
                </View>

                {/* Description */}
                <Text
                  style={
                    modalStyles.profileDescription
                  }
                >
                  {
                    selectedAstrologer.description
                  }
                </Text>

                {/* =================================================
                    STATS
                ================================================= */}

                <View
                  style={
                    modalStyles.statsRow
                  }
                >
                  <View
                    style={
                      modalStyles.stat
                    }
                  >
                    <Icon
                      name="certificate-outline"
                      size={px(31)}
                      color={C.PLUM}
                    />

                    <View
                      style={
                        modalStyles.statText
                      }
                    >
                      <Text
                        style={
                          modalStyles.statValue
                        }
                      >
                        {selectedAstrologer.consultations.toLocaleString()}+
                      </Text>

                      <Text
                        style={
                          modalStyles.statLabel
                        }
                      >
                        consultations
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      modalStyles.statDivider
                    }
                  />

                  <View
                    style={
                      modalStyles.stat
                    }
                  >
                    <Icon
                      name="star"
                      size={px(30)}
                      color={C.GOLD}
                    />

                    <View
                      style={
                        modalStyles.statText
                      }
                    >
                      <Text
                        style={
                          modalStyles.statValue
                        }
                      >
                        4.8
                      </Text>

                      <Text
                        style={
                          modalStyles.statLabel
                        }
                      >
                        (1.2K reviews)
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* =================================================
                  TABS
              ================================================= */}

              <View
                style={
                  modalStyles.tabs
                }
              >
                <View
                  style={[
                    modalStyles.tab,
                    modalStyles.activeTab,
                  ]}
                >
                  <Text
                    style={[
                      modalStyles.tabText,
                      modalStyles.activeTabText,
                    ]}
                  >
                    About
                  </Text>
                </View>

                <View
                  style={
                    modalStyles.tab
                  }
                >
                  <Text
                    style={
                      modalStyles.tabText
                    }
                  >
                    Reviews
                  </Text>
                </View>

                <View
                  style={
                    modalStyles.tab
                  }
                >
                  <Text
                    style={
                      modalStyles.tabText
                    }
                  >
                    Expertise
                  </Text>
                </View>
              </View>

              {/* =================================================
                  ABOUT ME
              ================================================= */}

              <View
                style={
                  modalStyles.sectionCard
                }
              >
                <View
                  style={
                    modalStyles.sectionTitleRow
                  }
                >
                  <Icon
                    name="book-open-outline"
                    size={px(30)}
                    color={C.PLUM}
                  />

                  <Text
                    style={
                      modalStyles.sectionTitle
                    }
                  >
                    About Me
                  </Text>
                </View>

                <Text
                  style={
                    modalStyles.sectionText
                  }
                >
                  {`Namaste, I’m ${selectedAstrologer.name}. For many years I have studied ${selectedAstrologer.type.toLowerCase()} and gained deep insights into how guidance can influence your life. I help you understand your strengths, challenges and the right direction forward.`}
                </Text>
              </View>

              {/* =================================================
                  EXPERTISE
              ================================================= */}

              <View
                style={
                  modalStyles.sectionCard
                }
              >
                <View
                  style={
                    modalStyles.sectionTitleRow
                  }
                >
                  <Icon
                    name="flower-outline"
                    size={px(32)}
                    color={C.PLUM}
                  />

                  <Text
                    style={
                      modalStyles.sectionTitle
                    }
                  >
                    Expertise
                  </Text>

                  <Icon
                    name="chevron-right"
                    size={px(25)}
                    color={C.PLUM}
                    style={{
                      marginLeft:
                        "auto",
                    }}
                  />
                </View>

                <View
                  style={
                    modalStyles.expertiseRow
                  }
                >
                  {selectedAstrologer.topics.map(
                    (topic) => (
                      <View
                        key={
                          topic.label
                        }
                        style={
                          modalStyles.expertiseChip
                        }
                      >
                        <Text
                          style={
                            modalStyles.expertiseText
                          }
                        >
                          {
                            topic.label
                          }
                        </Text>
                      </View>
                    )
                  )}
                </View>
              </View>
            </ScrollView>

            {/* =================================================
                FIXED BOTTOM CTA
            ================================================= */}

            <View
              style={[
                modalStyles.bottomBar,
                {
                  paddingBottom:
                    insets.bottom +
                    px(10),
                },
              ]}
            >
              <View
                style={
                  modalStyles.bottomPrice
                }
              >
                <View
                  style={{
                    flexDirection:
                      "row",
                    alignItems:
                      "baseline",
                  }}
                >
                  <Text
                    style={
                      modalStyles.bottomPriceText
                    }
                  >
                    {
                      selectedAstrologer.price
                    }
                  </Text>

                  <Text
                    style={
                      modalStyles.bottomPerMin
                    }
                  >
                    /min
                  </Text>
                </View>

                <Text
                  style={
                    modalStyles.bottomOldPrice
                  }
                >
                  {
                    selectedAstrologer.oldPrice
                  }
                  /min
                </Text>
              </View>

              <View
                style={
                  modalStyles.bottomOffer
                }
              >
                <Text
                  style={
                    modalStyles.bottomOfferText
                  }
                >
                  {user?.free_chat_minute_available
                    ? "1 min free"
                    : selectedAstrologer.discount}
                </Text>
              </View>

              <Pressable
  style={modalStyles.chatNow}
  onPress={async () => {
    if (!selectedAstrologer) return;

    closeAstrologerProfile();

    await handleAstrologerChat(
      selectedAstrologer
    );
  }}
>
  <Icon
    name="message-processing"
    size={px(30)}
    color="#fff"
  />

  <Text style={modalStyles.chatNowText}>
    Chat Now
  </Text>
</Pressable>
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

const s = StyleSheet.create({
  header: {
    height: px(65),
    flexDirection: "row",
    alignItems: "center",
    marginTop: px(6),
  },

  viewingRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },

  avatarRing: {
    width: px(56),
    height: px(56),
    borderRadius: px(28),
    borderWidth: px(3),
    borderColor: "#E8742A",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      "rgba(255,255,255,0.5)",
  },

  avatarLetter: {
    fontSize: fs(30),
    fontWeight: "600",
    color: "#E8742A",
  },

  viewing: {
    flexShrink: 1,
    marginLeft: px(14),
    marginRight: px(6),
    fontSize: fs(31),
    fontWeight: "600",
    color: C.INK,
  },

  history: {
    height: px(65),
    paddingHorizontal: px(18),
    flexDirection: "row",
    alignItems: "center",
    borderRadius: px(20),
    backgroundColor: C.GLASS,
    borderWidth: 1,
    borderColor:
      "rgba(150,130,185,0.22)",
  },

  historyText: {
    marginLeft: px(10),
    fontSize: fs(29),
    fontWeight: "500",
    color: C.INK,
  },

  wallet: {
    height: px(65),
    marginLeft: px(17),
    paddingLeft: px(18),
    paddingRight: px(6),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: px(20),
    backgroundColor: C.GLASS,
    borderWidth: 1,
    borderColor:
      "rgba(150,130,185,0.22)",
    gap: px(14),
  },

  walletLabel: {
    fontSize: fs(23),
    color: C.MUTED,
  },

  walletAmount: {
    fontSize: fs(30),
    fontWeight: "700",
    color: C.INK,
    marginTop: -px(2),
  },

  walletPlus: {
    width: px(52),
    height: px(52),
    borderRadius: px(12),
    backgroundColor: C.PLUM,
    alignItems: "center",
    justifyContent: "center",
  },

  topBanner: {
    marginHorizontal: -px(40),
    paddingHorizontal: px(45),
    paddingTop: px(22),
    paddingBottom: px(18),
    minHeight: px(178),
    justifyContent: "center",
  },

  eyebrow: {
    fontSize: fs(22),
    fontWeight: "700",
    letterSpacing: px(8),
    color: "#3A3350",
  },

  title: {
    marginTop: px(4),
    fontSize: fs(70),
    lineHeight: px(78),
    fontWeight: "800",
    color: C.INK,
  },

  subtitle: {
    marginTop: px(2),
    fontSize: fs(27),
    color: C.MUTED,
  },

  categoryRow: {
    paddingTop: px(18),
    paddingBottom: px(2),
    gap: px(12),
  },

  category: {
    height: px(58),
    paddingHorizontal: px(18),
    borderRadius: px(18),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: px(9),
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.BORDER,
  },

  categoryActive: {
    backgroundColor: C.PLUM,
    borderColor: C.PLUM,
  },

  categoryText: {
    fontSize: fs(21),
    fontWeight: "600",
    color: C.INK,
  },

  categoryTextActive: {
    color: C.CARD,
  },

  match: {
    marginTop: px(20),
    minHeight: px(215),
    borderRadius: px(22),
    overflow: "hidden",
    paddingLeft: px(36),
    paddingRight: px(250),
    paddingVertical: px(26),
    backgroundColor: "#3A1B63",
    justifyContent: "center",
  },

  matchTitle: {
    fontSize: fs(38),
    lineHeight: px(46),
    fontWeight: "800",
    color: "#fff",
  },

  matchSub: {
    marginTop: px(8),
    fontSize: fs(26),
    lineHeight: px(34),
    color: "#fff",
  },

  matchBtn: {
    alignSelf: "flex-start",
    marginTop: px(14),
    height: px(52),
    paddingHorizontal: px(26),
    flexDirection: "row",
    alignItems: "center",
    borderRadius: px(14),
    backgroundColor: "#fff",
  },

  matchBtnText: {
    fontSize: fs(25),
    fontWeight: "700",
    color: C.PLUM,
  },

  card: {
    height: px(233),
    paddingLeft: px(16),
    paddingRight: px(15),
    flexDirection: "row",
    alignItems: "center",
    borderRadius: px(24),
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.BORDER,
  },

  photo: {
    width: px(202),
    height: px(218),
    borderRadius: px(18),
    overflow: "hidden",
    backgroundColor: "#F1EAE0",
  },

  photoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1EAE0",
  },

  online: {
    position: "absolute",
    top: px(8),
    left: px(8),
    height: px(30),
    paddingHorizontal: px(12),
    flexDirection: "row",
    alignItems: "center",
    borderRadius: px(15),
    backgroundColor:
      "rgba(28,24,32,0.72)",
  },

  onlineDot: {
    width: px(13),
    height: px(13),
    borderRadius: px(7),
    marginRight: px(7),
    backgroundColor: "#22C55E",
  },


  

  onlineText: {
    fontSize: fs(20),
    color: "#fff",
  },

  consult: {
    position: "absolute",
    bottom: px(8),
    left: px(8),
    height: px(30),
    paddingHorizontal: px(10),
    flexDirection: "row",
    alignItems: "center",
    borderRadius: px(15),
    backgroundColor:
      "rgba(255,255,255,0.9)",
  },

  consultText: {
    marginLeft: px(5),
    fontSize: fs(18),
    fontWeight: "600",
    color: C.PLUM,
  },

  info: {
    flex: 1,
    marginLeft: px(18),
    minWidth: 0,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  name: {
    flexShrink: 1,
    fontSize: fs(27),
    fontWeight: "800",
    color: C.INK,
  },

  type: {
    marginTop: px(6),
    fontSize: fs(19),
    color: C.MUTED,
  },

  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: px(8),
    marginTop: px(10),
  },

  chip: {
    maxWidth: "70%",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: px(10),
    paddingVertical: px(7),
    borderRadius: px(12),
    backgroundColor: C.CHIP,
  },

  chipText: {
    marginLeft: px(6),
    fontSize: fs(17),
    fontWeight: "600",
    color: C.PLUM,
  },

  topicRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: px(7),
  marginTop: px(9),
  paddingRight: px(155),
  maxHeight: px(42),
  overflow: "hidden",
},

  topic: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: px(9),
    paddingVertical: px(6),
    borderRadius: px(10),
    backgroundColor: "#F7F1E8",
  },

  topicText: {
    marginLeft: px(4),
    fontSize: fs(16),
    color: C.MUTED,
  },

  priceCol: {
    position: "absolute",
    right: px(15),
    top: px(18),
    alignItems: "flex-end",
  },

  price: {
    fontSize: fs(27),
    fontWeight: "800",
    color: C.PLUM,
  },

  perMin: {
    fontSize: fs(16),
    color: C.MUTED,
  },

  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: px(3),
  },

  freeMinute: {
    color: "#26784B",
    fontWeight: "700",
  },
  minCredits: {
    marginTop: px(3),
    fontSize: px(11),
    fontWeight: "500",
    color: C.MUTED,
  },
  oldPrice: {
    fontSize: fs(16),
    textDecorationLine:
      "line-through",
    color: C.MUTED,
  },

  offer: {
    marginLeft: px(5),
    paddingHorizontal: px(5),
    paddingVertical: px(2),
    borderRadius: px(5),
    backgroundColor: "#E7F5E9",
  },

  offerText: {
    fontSize: fs(13),
    fontWeight: "700",
    color: "#238A3B",
  },

  chatBtn: {
    position: "absolute",
    right: px(15),
    bottom: px(15),
    height: px(48),
    paddingHorizontal: px(18),
    flexDirection: "row",
    alignItems: "center",
    borderRadius: px(15),
    backgroundColor: C.TERRACOTTA,
  },

  chatText: {
    marginLeft: px(6),
    fontSize: fs(19),
    fontWeight: "700",
    color: "#fff",
  },

  empty: {
    height: px(300),
    alignItems: "center",
    justifyContent: "center",
  },
 onlineInfo: {
  flexDirection: "row",
  alignItems: "center",
  alignSelf: "flex-start",
  paddingHorizontal: 7,
  paddingVertical: 3,
  borderRadius: 999,
  backgroundColor: "#E8F3E6",
},

onlineInfoDot: {
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: "#5C8A4A",
  marginRight: 4,
},

onlineInfoText: {
  fontSize: 8,
  lineHeight: 14,
  fontWeight: "500",
  color: "#2F7D3E",
},
});

/* =============================================================
   MODAL STYLES
============================================================= */

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.BG,
  },

  hero: {
    height: px(430),
    overflow: "hidden",
    backgroundColor: "#F1EAE0",
  },

  heroFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1EAE0",
  },

  heroInitial: {
    fontSize: fs(120),
    fontWeight: "700",
    color: C.PLUM,
  },

  backButton: {
    position: "absolute",
    top: px(45),
    left: px(22),
    width: px(50),
    height: px(50),
    borderRadius: px(25),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      "rgba(255,255,255,0.9)",
  },

  shareButton: {
    position: "absolute",
    top: px(45),
    right: px(22),
    width: px(50),
    height: px(50),
    borderRadius: px(25),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      "rgba(255,255,255,0.9)",
  },

  heroOnline: {
    position: "absolute",
    bottom: px(18),
    left: px(20),
    height: px(38),
    paddingHorizontal: px(14),
    flexDirection: "row",
    alignItems: "center",
    borderRadius: px(19),
    backgroundColor:
      "rgba(28,24,32,0.75)",
  },

  heroOnlineDot: {
    width: px(13),
    height: px(13),
    borderRadius: px(7),
    marginRight: px(7),
    backgroundColor: "#22C55E",
  },

  heroOnlineText: {
    fontSize: fs(20),
    fontWeight: "600",
    color: "#fff",
  },

  profileCard: {
    marginTop: -px(22),
    marginHorizontal: px(18),
    paddingHorizontal: px(22),
    paddingVertical: px(22),
    borderRadius: px(24),
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.BORDER,
  },

  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  profileName: {
    flex: 1,
    fontSize: fs(31),
    fontWeight: "800",
    color: C.INK,
  },

  profileType: {
    marginTop: px(6),
    fontSize: fs(20),
    color: C.MUTED,
  },

  profileChipRow: {
    flexDirection: "row",
    gap: px(8),
    marginTop: px(13),
  },

  profileChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: px(11),
    paddingVertical: px(8),
    borderRadius: px(12),
    backgroundColor: C.CHIP,
  },

  profileChipText: {
    marginLeft: px(6),
    fontSize: fs(17),
    fontWeight: "600",
    color: C.PLUM,
  },

  profileDescription: {
    marginTop: px(15),
    fontSize: fs(19),
    lineHeight: px(28),
    color: C.MUTED,
  },

  statsRow: {
    marginTop: px(20),
    flexDirection: "row",
    alignItems: "center",
  },

  stat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  statDivider: {
    width: 1,
    height: px(40),
    backgroundColor: C.BORDER,
    marginHorizontal: px(14),
  },

  statText: {
    marginLeft: px(9),
  },

  statValue: {
    fontSize: fs(22),
    fontWeight: "800",
    color: C.INK,
  },

  statLabel: {
    marginTop: px(2),
    fontSize: fs(15),
    color: C.MUTED,
  },

  tabs: {
    marginTop: px(20),
    marginHorizontal: px(18),
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.BORDER,
  },

  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: px(14),
  },

  activeTab: {
    borderBottomWidth: px(3),
    borderBottomColor: C.PLUM,
  },

  tabText: {
    fontSize: fs(18),
    fontWeight: "600",
    color: C.MUTED,
  },

  activeTabText: {
    color: C.PLUM,
  },

  sectionCard: {
    marginTop: px(16),
    marginHorizontal: px(18),
    paddingHorizontal: px(20),
    paddingVertical: px(20),
    borderRadius: px(22),
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.BORDER,
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  sectionTitle: {
    marginLeft: px(9),
    fontSize: fs(23),
    fontWeight: "800",
    color: C.INK,
  },

  sectionText: {
    marginTop: px(12),
    fontSize: fs(18),
    lineHeight: px(28),
    color: C.MUTED,
  },

  expertiseRow: {
    marginTop: px(15),
    flexDirection: "row",
    flexWrap: "wrap",
    gap: px(9),
  },

  expertiseChip: {
    paddingHorizontal: px(12),
    paddingVertical: px(9),
    borderRadius: px(12),
    backgroundColor: C.CHIP,
  },

  expertiseText: {
    fontSize: fs(16),
    fontWeight: "600",
    color: C.PLUM,
  },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: px(18),
    paddingTop: px(12),
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.CARD,
    borderTopWidth: 1,
    borderTopColor: C.BORDER,
  },

  bottomPrice: {
    marginRight: px(12),
  },

  bottomPriceText: {
    fontSize: fs(28),
    fontWeight: "800",
    color: C.PLUM,
  },

  bottomPerMin: {
    fontSize: fs(16),
    color: C.MUTED,
  },

  bottomOldPrice: {
    marginTop: px(2),
    fontSize: fs(15),
    textDecorationLine:
      "line-through",
    color: C.MUTED,
  },

  bottomOffer: {
    paddingHorizontal: px(8),
    paddingVertical: px(6),
    borderRadius: px(8),
    backgroundColor: "#E7F5E9",
  },

  bottomOfferText: {
    fontSize: fs(14),
    fontWeight: "700",
    color: "#238A3B",
  },

  chatNow: {
    marginLeft: "auto",
    height: px(52),
    paddingHorizontal: px(20),
    flexDirection: "row",
    alignItems: "center",
    borderRadius: px(16),
    backgroundColor: C.PLUM,
  },

  chatNowText: {
    marginLeft: px(7),
    fontSize: fs(18),
    fontWeight: "700",
    color: "#fff",
  },

  
});