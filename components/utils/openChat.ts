import { router } from "expo-router";
import { Alert } from "react-native";

import { API_URL, authHeaders } from "../../lib/auth";
import { translate } from "../../lib/i18n";
import { ensureChatCredits } from "../constants/chat";
import { useAstrologersStore } from "../stores/astrologersStore";

export type ChatHistoryItem = {
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

/**
 * Adds each astrologer's own photo (as on the Chat tab) to chat history rows.
 * Older backends send no photo with the history, so it's looked up by id.
 */
export async function withAstrologerPhotos(sessions: ChatHistoryItem[]): Promise<ChatHistoryItem[]> {
  const store = useAstrologersStore.getState();
  if (!store.astrologers.length) {
    await store.fetchAstrologers().catch(() => {});
  }

  const photoById = new Map<string, string>();
  for (const astrologer of useAstrologersStore.getState().astrologers) {
    const photo = astrologer.photo;
    if (typeof photo === "string" && photo.startsWith("http")) {
      photoById.set(String(astrologer.astrologer_id || astrologer.id), photo);
    }
  }

  return sessions.map((chat) => {
    const photo = chat.astrologer_id ? photoById.get(String(chat.astrologer_id)) : undefined;
    return chat.astrologer_image_url || !photo ? chat : { ...chat, astrologer_image_url: photo };
  });
}

type ChatUser = { credits?: number; free_chat_minute_available?: boolean } | null | undefined;

const CHAT_SCREENS: Record<string, string> = {
  vedic: "/(root)/chat/vedic",
  // KP and Lal Kitab use the Vedic chat screen.
  kp: "/(root)/chat/vedic",
  lalkitab: "/(root)/chat/vedic",
  tarot: "/(root)/chat/tarot",
  numerology: "/(root)/chat/numerology",
};

const reopenHumanChat = async (chat: ChatHistoryItem, user: ChatUser) => {
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
        typeof data?.detail === "string" ? data.detail : translate("chat.open.failed")
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
      translate("chat.open.title"),
      error instanceof Error ? error.message : translate("chat.pleaseTryAgain")
    );
  }
};

/** Opens a past chat: AI chats continue on their screen, human ones reopen live. */
export const openChatSession = (chat: ChatHistoryItem, user: ChatUser) => {
  // Real astrologers work like AI chats: opening the conversation again
  // reopens it (the astrologer gets a new request) on the live screen.
  if (chat.participant_type === "human") {
    reopenHumanChat(chat, user);
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
