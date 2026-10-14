import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ImageBackground,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ensureChatCredits } from "../../../components/constants/chat";
import useProfilesStore from "../../../components/stores/profilesStore";
import { useUserStore } from "../../../components/stores/userStore";
import { parseServerDate } from "../../../components/utils/serverDate";
import {
    API_URL,
    authHeaders,
} from "../../../lib/auth";


type ChatHistoryItem = {
  session_id: string;
  profile_id: string;
  astrologer_id?: string;
  astrologer_name?: string | null;
  astrologer_image?: string | null;
  astrologer_image_url?: string | null;
  reading_type?: string | null;
  status?: string | null;
  participant_type?: "ai" | "human" | null;
  last_message?: string | null;
  last_message_role?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;

  // Timer fields
  rate_per_minute?: number | string | null;
  remaining_time_seconds?: number | string | null;
};


export default function ChatHistory() {
  const [query, setQuery] = useState("");

  const [sessions, setSessions] = useState<
    ChatHistoryItem[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Profile modal
  const [profileModalVisible, setProfileModalVisible] =
    useState(false);

  const user = useUserStore(
    (state) => state.user
  );

  const updateUser = useUserStore(
    (state) => state.updateUser
  );

  const profiles = useProfilesStore(
    (state) => state.profiles
  );

  const fetchProfiles = useProfilesStore(
    (state) => state.fetchProfiles
  );

  const activeProfileId =
    user?.active_profile_id;

  const activeProfile = profiles.find(
    (profile) =>
      profile.profile_id === activeProfileId
  );

  // =========================================================
  // FETCH PROFILES
  // =========================================================

  useEffect(() => {
    fetchProfiles().catch((err) => {
      console.error(
        "FETCH PROFILES ERROR:",
        err
      );
    });
  }, [fetchProfiles]);

  // =========================================================
  // FETCH CHAT HISTORY
  // =========================================================

  useEffect(() => {
    if (!activeProfileId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    loadChatHistory();
  }, [activeProfileId]);

  const loadChatHistory = async () => {
    if (!activeProfileId) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const headers = await authHeaders();

      const response = await fetch(
        `${API_URL}/chat/history?profile_id=${encodeURIComponent(
          activeProfileId
        )}`,
        {
          method: "GET",
          headers,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Failed to load chat history."
        );
      }

      setSessions(
        Array.isArray(data?.sessions)
          ? data.sessions
          : []
      );
    } catch (err) {
      console.error(
        "CHAT HISTORY ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load chat history."
      );

      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // PROFILE SELECTION
  // =========================================================

  const handleSelectProfile = (
    profileId: string
  ) => {
    if (profileId === activeProfileId) {
      setProfileModalVisible(false);
      return;
    }

    updateUser({
      active_profile_id: profileId,
    });

    setProfileModalVisible(false);
  };

  // =========================================================
  // SEARCH
  // =========================================================

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return sessions;
    }

    return sessions.filter((chat) => {
      const name =
        chat.astrologer_name || "";

      const message =
        chat.last_message || "";

      const readingType =
        chat.reading_type || "";

      return `${name} ${message} ${readingType}`
        .toLowerCase()
        .includes(q);
    });
  }, [query, sessions]);

  // =========================================================
  // DATE GROUPING
  // =========================================================

  const todayChats = useMemo(
    () =>
      filteredSessions.filter((chat) =>
        isToday(
          chat.last_message_at ||
            chat.created_at
        )
      ),
    [filteredSessions]
  );

  const yesterdayChats = useMemo(
    () =>
      filteredSessions.filter((chat) =>
        isYesterday(
          chat.last_message_at ||
            chat.created_at
        )
      ),
    [filteredSessions]
  );

  const olderChats = useMemo(
    () =>
      filteredSessions.filter((chat) => {
        const date =
          chat.last_message_at ||
          chat.created_at;

        return (
          !isToday(date) &&
          !isYesterday(date)
        );
      }),
    [filteredSessions]
  );

  // =========================================================
  // OPEN CHAT
  // =========================================================

 
const CHAT_SCREENS: Record<string, string> = {
  vedic: "/(root)/chat/vedic",
  tarot: "/(root)/chat/tarot",
  numerology: "/(root)/chat/numerology",
};

const reopenHumanChat = async (chat: ChatHistoryItem) => {
  if (
    !ensureChatCredits(
      Number(user?.credits ?? 0),
      Number(chat.rate_per_minute ?? 0),
      Boolean(user?.free_chat_minute_available)
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/chat/session/start`, {
      method: "POST",
      headers: {
        ...(await authHeaders()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profile_id: chat.profile_id,
        astrologer_id: chat.astrologer_id,
        reading_type: chat.reading_type,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.session_id) {
      throw new Error(
        typeof data?.detail === "string" ? data.detail : "Couldn't open this chat."
      );
    }

    router.push({
      pathname: "/(root)/chat/live",
      params: {
        sessionId: String(data.session_id),
        profileId: chat.profile_id,
        astrologerName: chat.astrologer_name || "",
        astrologerId: chat.astrologer_id || "",
        readingType: chat.reading_type || "",
        walletBalance: String(user?.credits ?? 0),
        ratePerMinute: String(chat.rate_per_minute ?? 0),
        ...(Number(data.remaining_time_seconds) > 0
          ? { remainingTimeSeconds: String(Math.floor(Number(data.remaining_time_seconds))) }
          : {}),
      },
    });
  } catch (error) {
    // e.g. "This astrologer is offline right now."
    Alert.alert(
      "Can't open chat",
      error instanceof Error ? error.message : "Please try again."
    );
  }
};

const openChat = (chat: ChatHistoryItem) => {
  // Real astrologers work like AI chats: opening the conversation again
  // reopens it (the astrologer gets a new request) on the live screen.
  if (chat.participant_type === "human") {
    reopenHumanChat(chat);
    return;
  }

  const pathname = CHAT_SCREENS[chat.reading_type || ""];

  if (!pathname) {
    console.error("Unsupported reading type:", chat.reading_type);
    return;
  }

  // Reopening connects the billed chat, so apply the same minimum.
  if (
    !ensureChatCredits(
      Number(user?.credits ?? 0),
      Number(chat.rate_per_minute ?? 0),
      Boolean(user?.free_chat_minute_available)
    )
  ) {
    return;
  }

  router.push({
    pathname: pathname as any,
    params: {
      sessionId: chat.session_id,
      profileId: chat.profile_id,
      astrologerName: chat.astrologer_name || "",
      astrologerId: chat.astrologer_id || "",
      readingType: chat.reading_type || "",

      // Timer parameters
      walletBalance: String(user?.credits ?? 0),
      ratePerMinute: String(chat.rate_per_minute ?? 0),
      remainingTimeSeconds: String(
        chat.remaining_time_seconds ?? 0
      ),
    },
  });
};


  return (
    <ImageBackground
      source={require("../../../assets/images/profile/language.png")}
      resizeMode="cover"
      style={{
        flex: 1,
        backgroundColor: "#F4F0F8",
      }}
    >
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 px-[20px]">

          {/* =================================================
              HEADER
          ================================================= */}

          <View className="flex-row items-center pt-[6px]">

            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              className="-ml-[8px] h-[44px] w-[44px] items-center justify-center"
            >
              <Ionicons
                name="chevron-back"
                size={26}
                color="#1C1820"
              />
            </Pressable>

            <View className="flex-1 items-center">
              <Text className="text-[17px] font-bold text-[#1C1820]">
                Chat History
              </Text>

              <Text className="mt-[2px] text-[11.5px] text-[#68616A]">
                {activeProfile?.name
                  ? `Conversations for ${activeProfile.name}`
                  : "Your past conversations"}
              </Text>
            </View>

            {/* SWITCH PROFILE */}

            <Pressable
              className="flex-row items-center"
              onPress={() =>
                setProfileModalVisible(
                  (visible) => !visible
                )
              }
            >
              <Text className="text-[12px] font-semibold text-[#2B1A3D]">
                Switch Profile
              </Text>

              <Ionicons
                name={
                  profileModalVisible
                    ? "chevron-up"
                    : "chevron-down"
                }
                size={15}
                color="#2B1A3D"
                style={{
                  marginLeft: 3,
                }}
              />
            </Pressable>
          </View>

          {/* =================================================
              SEARCH
          ================================================= */}

          <View className="mt-[14px] h-[42px] flex-row items-center rounded-[13px] border border-[#E6DFEA] bg-[#F1EDF3] px-[14px]">

            <Ionicons
              name="search-outline"
              size={19}
              color="#68616A"
            />

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search conversations..."
              placeholderTextColor="#8A838C"
              className="ml-[10px] flex-1 text-[13px] text-[#1C1820]"
              returnKeyType="search"
            />
          </View>

          {/* =================================================
              CONTENT
          ================================================= */}

          {loading ? (
            <View className="flex-1 items-center justify-center">

              <ActivityIndicator
                size="large"
                color="#2B1A3D"
              />

              <Text className="mt-[10px] text-[13px] text-[#68616A]">
                Loading conversations...
              </Text>

            </View>
          ) : error ? (
            <View className="flex-1 items-center justify-center px-[20px]">

              <Ionicons
                name="alert-circle-outline"
                size={42}
                color="#A94C36"
              />

              <Text className="mt-[12px] text-center text-[16px] font-semibold text-[#1C1820]">
                Unable to load chat history
              </Text>

              <Text className="mt-[5px] text-center text-[13px] text-[#68616A]">
                {error}
              </Text>

              <Pressable
                onPress={loadChatHistory}
                className="mt-[16px] rounded-[12px] bg-[#2B1A3D] px-[18px] py-[10px]"
              >
                <Text className="text-[13px] font-semibold text-white">
                  Try Again
                </Text>
              </Pressable>

            </View>
          ) : (
            <ScrollView
              className="mt-[8px]"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 40,
              }}
            >

              {/* =================================================
                  TODAY
              ================================================= */}

              {todayChats.length > 0 && (
                <>
                  <Text className="mb-[4px] mt-[14px] text-[18px] font-bold text-[#1C1820]">
                    Today
                  </Text>

                  {todayChats.map(
                    (chat, index) => (
                      <ChatRow
                        key={chat.session_id}
                        chat={chat}
                        last={
                          index ===
                          todayChats.length - 1
                        }
                        onPress={() =>
                          openChat(chat)
                        }
                      />
                    )
                  )}
                </>
              )}

              {/* =================================================
                  YESTERDAY
              ================================================= */}

              {yesterdayChats.length > 0 && (
                <>
                  <Text className="mb-[4px] mt-[22px] text-[18px] font-bold text-[#1C1820]">
                    Yesterday
                  </Text>

                  {yesterdayChats.map(
                    (chat, index) => (
                      <ChatRow
                        key={chat.session_id}
                        chat={chat}
                        last={
                          index ===
                          yesterdayChats.length - 1
                        }
                        onPress={() =>
                          openChat(chat)
                        }
                      />
                    )
                  )}
                </>
              )}

              {/* =================================================
                  OLDER
              ================================================= */}

              {olderChats.length > 0 && (
                <>
                  <Text className="mb-[4px] mt-[22px] text-[18px] font-bold text-[#1C1820]">
                    Older
                  </Text>

                  {olderChats.map(
                    (chat, index) => (
                      <ChatRow
                        key={chat.session_id}
                        chat={chat}
                        last={
                          index ===
                          olderChats.length - 1
                        }
                        onPress={() =>
                          openChat(chat)
                        }
                      />
                    )
                  )}
                </>
              )}

              {/* =================================================
                  EMPTY
              ================================================= */}

              {filteredSessions.length === 0 && (
                <View className="mt-[60px] items-center">

                  <Ionicons
                    name="chatbubbles-outline"
                    size={42}
                    color="#7A727F"
                  />

                  <Text className="mt-[12px] text-[16px] font-semibold text-[#1C1820]">
                    {query.trim()
                      ? "No conversations found"
                      : "No chat history yet"}
                  </Text>

                  <Text className="mt-[4px] text-center text-[13px] text-[#68616A]">
                    {query.trim()
                      ? "Try a different search."
                      : "Your conversations will appear here."}
                  </Text>

                </View>
              )}

            </ScrollView>
          )}
        </View>

        {/* =====================================================
            SWITCH PROFILE MODAL
        ===================================================== */}

        <Modal
          visible={profileModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() =>
            setProfileModalVisible(false)
          }
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor:
                "rgba(0,0,0,0.15)",
            }}
            onPress={() =>
              setProfileModalVisible(false)
            }
          >
            <Pressable
              onPress={(event) =>
                event.stopPropagation()
              }
              style={{
                position: "absolute",
                top: 62,
                left: 20,
                right: 20,
                backgroundColor: "#FFFDFC",
                borderRadius: 16,
                padding: 8,
                borderWidth: 1,
                borderColor: "#E6DFEA",

                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 12,
                shadowOffset: {
                  width: 0,
                  height: 5,
                },

                elevation: 5,
              }}
            >
              {/* MODAL TITLE */}

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: "#68616A",
                  paddingHorizontal: 12,
                  paddingTop: 6,
                  paddingBottom: 8,
                }}
              >
                Select profile
              </Text>

              {/* PROFILES */}

              {profiles.map((profile) => {
                const selected =
                  profile.profile_id ===
                  activeProfileId;

                return (
                  <Pressable
                    key={profile.profile_id}
                    onPress={() =>
                      handleSelectProfile(
                        profile.profile_id
                      )
                    }
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor:
                        selected
                          ? "rgba(43,26,61,0.07)"
                          : "transparent",
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    {/* PROFILE AVATAR */}

                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor:
                          "#F4F0F8",
                        alignItems: "center",
                        justifyContent:
                          "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "700",
                          color: "#2B1A3D",
                        }}
                      >
                        {profile.name
                          ?.charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>

                    {/* PROFILE NAME */}

                    <Text
                      style={{
                        flex: 1,
                        marginLeft: 10,
                        fontSize: 15,
                        fontWeight: "600",
                        color: "#1C1820",
                      }}
                      numberOfLines={1}
                    >
                      {profile.name}
                    </Text>

                    {/* CHECKMARK */}

                    {selected && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color="#2B1A3D"
                      />
                    )}
                  </Pressable>
                );
              })}

              {/* NO PROFILES */}

              {profiles.length === 0 && (
                <View
                  style={{
                    paddingVertical: 18,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#68616A",
                    }}
                  >
                    No profiles available.
                  </Text>
                </View>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
}

// =============================================================
// CHAT ROW
// =============================================================

function ChatRow({
  chat,
  last,
  onPress,
}: {
  chat: ChatHistoryItem;
  last: boolean;
  onPress: () => void;
}) {
  const name =
    chat.astrologer_name?.trim() ||
    "Astrologer";

  const message =
    chat.last_message?.trim() ||
    "No messages yet";

  const photo =
    chat.astrologer_image_url ||
    chat.astrologer_image ||
    undefined;

  const avatar =
    name.charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center py-[11px] ${
        last
          ? ""
          : "border-b border-[#E9E3EE]"
      }`}
    >
      {/* =====================================================
          AVATAR
      ===================================================== */}

      <View
        className="h-[56px] w-[56px] items-center justify-center overflow-hidden rounded-full"
        style={{
          backgroundColor:
            getAvatarColor(name),
        }}
      >
        <Text className="text-[22px] font-bold text-[#2B1A3D]">
          {avatar}
        </Text>

        {!!photo && (
          <Image
            source={{ uri: photo }}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
            }}
            onError={() => {
              // Initial avatar remains visible
              // behind failed image.
            }}
          />
        )}
      </View>

      {/* =====================================================
          CONTENT
      ===================================================== */}

      <View className="ml-[14px] min-w-0 flex-1">

        <View className="flex-row items-center">

          <Text
            numberOfLines={1}
            className="flex-1 text-[15px] font-bold text-[#1C1820]"
          >
            {name}
          </Text>

          <Text className="ml-[8px] text-[11px] text-[#817985]">
            {formatTime(
              chat.last_message_at ||
                chat.created_at
            )}
          </Text>

        </View>

        <Text
          numberOfLines={1}
          className="mt-[3px] text-[12.5px] text-[#817985]"
        >
          {message}
        </Text>

      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color="#1C1820"
        style={{
          marginLeft: 8,
        }}
      />
    </Pressable>
  );
}

// =============================================================
// DATE HELPERS
// =============================================================

function isToday(
  value?: string | null
) {
  if (!value) {
    return false;
  }

  const date = parseServerDate(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  return (
    date.getFullYear() ===
      now.getFullYear() &&
    date.getMonth() ===
      now.getMonth() &&
    date.getDate() ===
      now.getDate()
  );
}

function isYesterday(
  value?: string | null
) {
  if (!value) {
    return false;
  }

  const date = parseServerDate(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const yesterday = new Date();

  yesterday.setDate(
    yesterday.getDate() - 1
  );

  return (
    date.getFullYear() ===
      yesterday.getFullYear() &&
    date.getMonth() ===
      yesterday.getMonth() &&
    date.getDate() ===
      yesterday.getDate()
  );
}

function formatTime(
  value?: string | null
) {
  if (!value) {
    return "";
  }

  const date = parseServerDate(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// =============================================================
// AVATAR COLOR
// =============================================================

function getAvatarColor(name: string) {
  const colors = [
    "#E7B38D",
    "#A9D7B8",
    "#E3C48D",
    "#B9A7D8",
    "#D8B5C4",
  ];

  const index =
    name.charCodeAt(0) %
    colors.length;

  return colors[index];
}