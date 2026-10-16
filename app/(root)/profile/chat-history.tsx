import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "../../../components/ui/BrandText";
import BottomSheet from "../../../components/ui/BottomSheet";

import useProfilesStore from "../../../components/stores/profilesStore";
import { useUserStore } from "../../../components/stores/userStore";
import { ChatHistoryItem, openChatSession, withAstrologerPhotos } from "../../../components/utils/openChat";
import { parseServerDate } from "../../../components/utils/serverDate";
import { API_URL, authHeaders } from "../../../lib/auth";

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  GOLD: "#C49A4A",
  TERRACOTTA: "#A94C36", // human astrologers only
  LAVENDER: "#F4F0F8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  LINE: "rgba(217,206,193,0.7)",
  SOFT: "#EFE8F7",
};

// Label for each kind of chat.
const READING_LABEL: Record<string, string> = {
  vedic: "Vedic",
  kp: "KP",
  lalkitab: "Lal Kitab",
  tarot: "Tarot",
  numerology: "Numerology",
};

export default function ChatHistory() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const [sessions, setSessions] = useState<ChatHistoryItem[]>([]);

  // Which profile's history is loaded; loading until it matches the selected one.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Profile switcher sheet
  const [profileSheet, setProfileSheet] = useState(false);

  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore((state) => state.updateUser);
  const profiles = useProfilesStore((state) => state.profiles);
  const fetchProfiles = useProfilesStore((state) => state.fetchProfiles);

  const activeProfileId = user?.active_profile_id;
  const activeProfile = profiles.find((profile) => profile.profile_id === activeProfileId);

  // =========================================================
  // FETCH PROFILES
  // =========================================================

  useEffect(() => {
    fetchProfiles().catch((err) => {
      console.error("FETCH PROFILES ERROR:", err);
    });
  }, [fetchProfiles]);

  // =========================================================
  // FETCH CHAT HISTORY
  // =========================================================

  // Bumped by "Try again" to load once more.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!activeProfileId) return;
    let cancelled = false;

    (async () => {
      try {
        const headers = await authHeaders();

        const response = await fetch(
          `${API_URL}/chat/history?profile_id=${encodeURIComponent(activeProfileId)}`,
          { method: "GET", headers }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.detail || "Failed to load chat history.");
        }

        // Each astrologer's own photo, as on the Chat tab.
        const rows = await withAstrologerPhotos(Array.isArray(data?.sessions) ? data.sessions : []);
        if (cancelled) return;
        setSessions(rows);
        setError("");
      } catch (err) {
        console.error("CHAT HISTORY ERROR:", err);
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load chat history.");
        setSessions([]);
      } finally {
        if (!cancelled) setLoadedFor(`${activeProfileId}:${reloadKey}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProfileId, reloadKey]);

  const showLoading = !!activeProfileId && loadedFor !== `${activeProfileId}:${reloadKey}`;

  const retry = () => setReloadKey((key) => key + 1);

  // =========================================================
  // PROFILE SELECTION
  // =========================================================

  const handleSelectProfile = (profileId: string) => {
    if (profileId !== activeProfileId) {
      updateUser({ active_profile_id: profileId });
    }
    setProfileSheet(false);
  };

  // =========================================================
  // SEARCH
  // =========================================================

  const filteredSessions = useMemo(() => {
    // No profile selected: nothing to show.
    const visible = activeProfileId ? sessions : [];
    const q = query.trim().toLowerCase();
    if (!q) return visible;

    return visible.filter((chat) => {
      const name = chat.astrologer_name || "";
      const message = chat.last_message || "";
      const readingType = READING_LABEL[chat.reading_type || ""] || chat.reading_type || "";
      return `${name} ${message} ${readingType}`.toLowerCase().includes(q);
    });
  }, [query, sessions, activeProfileId]);

  // =========================================================
  // DATE GROUPING
  // =========================================================

  const groups = useMemo(() => {
    const when = (chat: ChatHistoryItem) => chat.last_message_at || chat.created_at;
    const today = filteredSessions.filter((chat) => isToday(when(chat)));
    const yesterday = filteredSessions.filter((chat) => isYesterday(when(chat)));
    const older = filteredSessions.filter((chat) => !isToday(when(chat)) && !isYesterday(when(chat)));
    return [
      { title: "TODAY", chats: today, older: false },
      { title: "YESTERDAY", chats: yesterday, older: false },
      { title: "EARLIER", chats: older, older: true },
    ].filter((group) => group.chats.length > 0);
  }, [filteredSessions]);

  // Same as Home's "Continue your journey" chat cards.
  const openChat = (chat: ChatHistoryItem) => openChatSession(chat, user);

  const profileName = activeProfile?.name?.trim() || "";

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backButton} accessibilityLabel="Go back">
          <Icon name="chevron-left" size={24} color={C.INK} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Chat history</Text>
          <Text style={s.subtitle} numberOfLines={1}>
            {profileName ? `Conversations for ${profileName}` : "Your past conversations"}
          </Text>
        </View>

        {/* Switch profile */}
        <Pressable onPress={() => setProfileSheet(true)} style={s.profileChip} accessibilityLabel="Switch profile">
          <View style={s.profileChipAvatar}>
            {activeProfile?.avatar_url ? (
              <Image source={{ uri: activeProfile.avatar_url }} style={StyleSheet.absoluteFill} />
            ) : (
              <Text style={s.profileChipInitial}>{profileName[0]?.toUpperCase() || "?"}</Text>
            )}
          </View>
          <Icon name="chevron-down" size={16} color={C.PLUM} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={s.search}>
        <Icon name="magnify" size={19} color={C.MUTED} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search astrologer, message or type"
          placeholderTextColor={C.MUTED}
          style={s.searchInput}
          returnKeyType="search"
        />
        {!!query && (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Icon name="close-circle" size={17} color={C.MUTED} />
          </Pressable>
        )}
      </View>

      {/* Content */}
      {showLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.PLUM} />
          <Text style={s.centerText}>Loading conversations…</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <View style={s.stateIcon}>
            <Icon name="wifi-off" size={26} color={C.PLUM} />
          </View>
          <Text style={s.stateTitle}>Couldn&apos;t load chat history</Text>
          <Text style={s.centerText}>{error}</Text>
          <Pressable onPress={retry} style={s.stateButton}>
            <Icon name="refresh" size={17} color={C.CARD} />
            <Text style={s.stateButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        >
          {groups.map((group, groupIndex) => (
            <Reanimated.View key={group.title} entering={FadeInDown.delay(70 * groupIndex).duration(400)}>
              <View style={s.groupHead}>
                <Text style={s.overline}>{group.title}</Text>
                <Text style={s.groupCount}>{group.chats.length}</Text>
              </View>

              <View style={s.groupCard}>
                {group.chats.map((chat, index) => (
                  <ChatRow
                    key={chat.session_id}
                    chat={chat}
                    showDate={group.older}
                    last={index === group.chats.length - 1}
                    onPress={() => openChat(chat)}
                  />
                ))}
              </View>
            </Reanimated.View>
          ))}

          {/* Empty */}
          {filteredSessions.length === 0 && (
            <View style={s.empty}>
              <View style={s.stateIcon}>
                <Icon name={query.trim() ? "text-search" : "chat-outline"} size={26} color={C.PLUM} />
              </View>
              <Text style={s.stateTitle}>{query.trim() ? "No conversations found" : "No chats yet"}</Text>
              <Text style={s.centerText}>
                {query.trim()
                  ? "Try a different name or word."
                  : "Your conversations with astrologers will appear here."}
              </Text>
              {!query.trim() && (
                <Pressable onPress={() => router.navigate("/(root)/(tabs)/chat")} style={s.stateButton}>
                  <Icon name="chat-processing-outline" size={17} color={C.CARD} />
                  <Text style={s.stateButtonText}>Talk to an astrologer</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Switch profile */}
      <BottomSheet visible={profileSheet} onClose={() => setProfileSheet(false)}>
        <Text style={s.sheetTitle}>Show chats for</Text>
        <View style={{ gap: 8, marginTop: 14 }}>
          {profiles.map((profile) => {
            const selected = profile.profile_id === activeProfileId;
            return (
              <Pressable
                key={profile.profile_id}
                onPress={() => handleSelectProfile(profile.profile_id)}
                style={[s.sheetRow, selected && s.sheetRowSelected]}
              >
                <View style={s.sheetAvatar}>
                  {profile.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill} />
                  ) : (
                    <Text style={s.sheetInitial}>{profile.name?.charAt(0).toUpperCase() || "?"}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetName} numberOfLines={1}>
                    {profile.name}
                  </Text>
                  {!!profile.relation && <Text style={s.sheetRelation}>{profile.relation}</Text>}
                </View>
                {selected ? (
                  <View style={s.sheetCheck}>
                    <Icon name="check" size={14} color={C.CARD} />
                  </View>
                ) : (
                  <View style={s.sheetRadio} />
                )}
              </Pressable>
            );
          })}

          {profiles.length === 0 && <Text style={s.centerText}>No profiles available.</Text>}
        </View>
      </BottomSheet>
    </View>
  );
}

// =============================================================
// CHAT ROW
// =============================================================

function ChatRow({
  chat,
  last,
  showDate,
  onPress,
}: {
  chat: ChatHistoryItem;
  last: boolean;
  showDate: boolean;
  onPress: () => void;
}) {
  const name = chat.astrologer_name?.trim() || "Astrologer";
  const message = chat.last_message?.trim() || "No messages yet";
  const photo = chat.astrologer_image_url || chat.astrologer_image || undefined;
  const human = chat.participant_type === "human";
  const reading = READING_LABEL[chat.reading_type || ""];
  const when = chat.last_message_at || chat.created_at;
  const fromUser = chat.last_message_role === "user";

  return (
    <Pressable onPress={onPress} style={[s.row, !last && s.rowDivider]}>
      {/* Avatar: gold ring, terracotta for human astrologers */}
      <View style={[s.avatarRing, human && { borderColor: "rgba(169,76,54,0.7)" }]}>
        <View style={s.avatar}>
          <Text style={s.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
          {!!photo && <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} />}
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.rowTop}>
          <Text numberOfLines={1} style={s.rowName}>
            {name}
          </Text>
          <Text style={s.rowTime}>{showDate ? formatDay(when) : formatTime(when)}</Text>
        </View>

        <View style={s.rowTags}>
          {human && (
            <View style={[s.tag, s.tagHuman]}>
              <Text style={[s.tagText, { color: C.TERRACOTTA }]}>Live astrologer</Text>
            </View>
          )}
          {!!reading && (
            <View style={s.tag}>
              <Text style={s.tagText}>{reading}</Text>
            </View>
          )}
        </View>

        <Text numberOfLines={1} style={s.rowMessage}>
          {fromUser ? "You: " : ""}
          {message}
        </Text>
      </View>

      <Icon name="chevron-right" size={20} color={C.MUTED} />
    </Pressable>
  );
}

// =============================================================
// DATE HELPERS
// =============================================================

function isToday(value?: string | null) {
  if (!value) return false;
  const date = parseServerDate(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isYesterday(value?: string | null) {
  if (!value) return false;
  const date = parseServerDate(value);
  if (Number.isNaN(date.getTime())) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  );
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = parseServerDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "12 Oct" (this year) or "12 Oct 2025".
function formatDay(value?: string | null) {
  if (!value) return "";
  const date = parseServerDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === new Date().getFullYear() ? day : `${day} ${date.getFullYear()}`;
}

const shadow = {
  shadowColor: "#2B1A3D",
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.LAVENDER },

  /* Header */
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  title: { fontSize: 21, fontWeight: "700", color: C.INK, letterSpacing: -0.3 },
  subtitle: { marginTop: 1, fontSize: 12.5, color: C.MUTED },
  profileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 3,
    paddingRight: 8,
    borderRadius: 999,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  profileChipAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.SOFT,
  },
  profileChipInitial: { fontSize: 14, fontWeight: "700", color: C.PLUM },

  /* Search */
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 46,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.INK, paddingVertical: 0 },

  content: { paddingHorizontal: 16, paddingTop: 6 },

  /* Groups */
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, marginBottom: 8 },
  overline: { fontSize: 11, fontWeight: "700", letterSpacing: 1.3, color: C.GOLD },
  groupCount: {
    fontSize: 10.5,
    fontWeight: "700",
    color: C.MUTED,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: C.CARD,
    overflow: "hidden",
  },
  groupCard: {
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    ...shadow,
  },

  /* Row */
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: "#EFE9F2" },
  avatarRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 2.5,
    borderWidth: 1.5,
    borderColor: "rgba(196,154,74,0.7)",
  },
  avatar: {
    flex: 1,
    borderRadius: 25,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.SOFT,
  },
  avatarInitial: { fontSize: 19, fontWeight: "700", color: C.PLUM },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowName: { flex: 1, fontSize: 15, fontWeight: "700", color: C.INK },
  rowTime: { fontSize: 11, color: C.MUTED },
  rowTags: { flexDirection: "row", gap: 6, marginTop: 4 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: C.SOFT },
  tagHuman: { backgroundColor: "#F6E7E2" },
  tagText: { fontSize: 10.5, fontWeight: "700", color: C.PLUM },
  rowMessage: { marginTop: 4, fontSize: 12.5, color: C.MUTED },

  /* States */
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  centerText: { fontSize: 13, lineHeight: 19, color: C.MUTED, textAlign: "center" },
  empty: { alignItems: "center", marginTop: 70, paddingHorizontal: 16, gap: 8 },
  stateIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    marginBottom: 4,
  },
  stateTitle: { fontSize: 16, fontWeight: "700", color: C.INK, textAlign: "center" },
  stateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    marginTop: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: C.PLUM,
  },
  stateButtonText: { fontSize: 13.5, fontWeight: "700", color: C.CARD },

  /* Profile sheet */
  sheetTitle: { fontSize: 18, fontWeight: "700", color: C.INK, textAlign: "center" },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  sheetRowSelected: { borderColor: C.PLUM, backgroundColor: "#FAF7FD" },
  sheetAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.SOFT,
  },
  sheetInitial: { fontSize: 16, fontWeight: "700", color: C.PLUM },
  sheetName: { fontSize: 15, fontWeight: "700", color: C.INK },
  sheetRelation: { marginTop: 1, fontSize: 12, color: "#8A6A2C", fontWeight: "600" },
  sheetRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#B9AFC0" },
  sheetCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.PLUM,
  },
});
