import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardInset } from "../../../components/utils/useKeyboardInset";

import ChatWelcome from "../../../components/chat/ChatWelcome";
import {
  CardBack,
  TarotPicker,
  type TarotPickerCard,
  type TarotPickerPhase,
} from "../../../components/chat/TarotPicker";
import { ensureChatCredits } from "../../../components/constants/chat";
import { track, useChatTracking } from "../../../lib/analytics";
import { useAstrologersStore } from "../../../components/stores/astrologersStore";
import {
  applyWalletUpdate,
  refreshWalletCredits,
  useUserStore,
} from "../../../components/stores/userStore";
import { API_URL, authHeaders } from "../../../lib/auth";
import { translate, useT } from "../../../lib/i18n";

// Live chat with a human astrologer (sessions with participant_type
// "human"). AI astrologers use the vedic / tarot / numerology screens.

type Sender = "user" | "astrologer";

type TarotRequest = {
  count: number;
  note?: string;
  picked: TarotPickerCard[];
};

type Message = {
  id: string;
  text: string;
  sender: Sender;
  // Which chat (session) it belongs to; earlier chats get a divider.
  sessionId?: string;
  at?: string | null;
  // Tarot: the astrologer's card request, or a card the user picked.
  kind?: "text" | "tarot_request" | "tarot_card";
  tarot?: TarotRequest;
  card?: TarotPickerCard;
};

type PickerState = {
  requestId: string;
  phase: TarotPickerPhase;
  revealCard: TarotPickerCard | null;
};

const toMessage = (item: any, fallbackSessionId: string, fallbackId: string): Message => ({
  id: item.id || fallbackId,
  text: item.message || "",
  sender: item.from === "user" ? "user" : "astrologer",
  sessionId: item.session_id || fallbackSessionId,
  at: item.at,
  kind: item.message_type || "text",
  tarot: item.tarot || undefined,
  card: item.card || undefined,
});

type ChatState = "loading" | "waiting" | "active" | "ended";

const C = {
  card: "#FFFDFC",
  ink: "#1C1820",
  inputInk: "#2D2633",
  muted: "#68616A",
  placeholder: "#756B7D",
  disabled: "#DDD3E5",
  border: "#D9CEC1",
  plum: "#2B1A3D",
  gold: "#C49A4A",
  ivory: "#F7F1E8",
  online: "#5C8A4A",
  green: "#26784B",
  warnBg: "#FFF4E5",
  warnInk: "#7A4B00",
} as const;

type ReadingType = "vedic" | "numerology" | "tarot";

// Mirrors app/(root)/chat/vedic.tsx, numerology.tsx and tarot.tsx so a
// real-astrologer chat looks like the matching AI chat page.
const THEMES: Record<
  ReadingType,
  {
    background: number;
    screenBg: string;
    userBubble: string;
    astroBg: string;
    astroBorder: string;
    inputBg: string;
    inputBorder: string;
    send: string;
    corner: number;
  }
> = {
  vedic: {
    background: require("../../../assets/backgrounds/vedic_chat_background.png"),
    screenBg: "#F5F1FA",
    userBubble: "#2B1A3D",
    astroBg: "#FFFDFC",
    astroBorder: "#D9CEC1",
    inputBg: "#FFFEFF",
    inputBorder: "#DDD3E5",
    send: "#6D4C8D",
    corner: 7,
  },
  numerology: {
    background: require("../../../assets/backgrounds/numerology_chat_background.png"),
    screenBg: "#F5F1FA",
    userBubble: "#6D4C8D",
    astroBg: "#FFFEFF",
    astroBorder: "#DDD3E5",
    inputBg: "#FFFEFF",
    inputBorder: "#DDD3E5",
    send: "#6D4C8D",
    corner: 7,
  },
  tarot: {
    background: require("../../../assets/backgrounds/tarot_chat_background.png"),
    screenBg: "#F4F0F8",
    userBubble: "#2B1A3D",
    astroBg: "#FFFDFC",
    astroBorder: "#D9CEC1",
    inputBg: "#FFFDFC",
    inputBorder: "#D9CEC1",
    send: "#2B1A3D",
    corner: 8,
  },
};

// Translation keys; `{name}` in the body is the astrologer's name.
const END_REASONS: Record<string, { title: string; body: string; recharge?: boolean }> = {
  missed: {
    title: "chat.live.end.missedTitle",
    body: "chat.live.end.missedBody",
  },
  declined: {
    title: "chat.live.end.declinedTitle",
    body: "chat.live.end.declinedBody",
  },
  cancelled: {
    title: "chat.live.end.cancelledTitle",
    body: "chat.live.end.cancelledBody",
  },
  user_ended: { title: "chat.live.chatEnded", body: "chat.live.end.userEndedBody" },
  astrologer_ended: { title: "chat.live.chatEnded", body: "chat.live.end.astrologerEndedBody" },
  user_left: { title: "chat.live.chatEnded", body: "chat.live.end.userLeftBody" },
  astrologer_left: { title: "chat.live.chatEnded", body: "chat.live.end.astrologerLeftBody" },
  credits_exhausted: {
    title: "chat.live.end.outOfCreditsTitle",
    body: "chat.live.end.outOfCreditsBody",
    recharge: true,
  },
  insufficient_credits: {
    title: "chat.live.end.notEnoughTitle",
    body: "chat.live.end.notEnoughBody",
    recharge: true,
  },
};

const formatDay = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const formatClock = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

export default function LiveChat() {
  const t = useT();
  const insets = useSafeAreaInsets();
  // Keeps the input above the keyboard on Android (edge-to-edge).
  const keyboard = useKeyboardInset();

  const {
    sessionId,
    astrologerId,
    astrologerName,
    profileId,
    readingType,
    walletBalance,
    ratePerMinute,
    remainingTimeSeconds,
  } = useLocalSearchParams<{
    sessionId: string;
    astrologerId: string;
    astrologerName: string;
    profileId: string;
    readingType?: string;
    walletBalance?: string;
    ratePerMinute?: string;
    remainingTimeSeconds?: string;
  }>();

  // `name` (English fallback) feeds analytics and the socket effect; the
  // screen shows `displayName`.
  const name = astrologerName || "Astrologer";
  const displayName = astrologerName || t("chat.astrologer");

  // Analytics: chat_started_<astrologer> + chat_<astrologer>_time_spent.
  useChatTracking({ astrologerName: name, astrologerId, readingType, sessionId, chatType: "human" });

  const astrologer = useAstrologersStore((state) =>
    state.astrologers.find((a) => a.astrologer_id === astrologerId)
  );

  // Paid time: from the backend if given, else wallet / rate.
  const initialSeconds = (() => {
    const fromBackend = Number(remainingTimeSeconds);
    if (Number.isFinite(fromBackend) && fromBackend > 0) return Math.floor(fromBackend);
    const wallet = Number(walletBalance) || 0;
    const rate = Number(ratePerMinute) || 0;
    return rate > 0 ? Math.floor((wallet / rate) * 60) : 0;
  })();

  const [state, setState] = useState<ChatState>("loading");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [waitSeconds, setWaitSeconds] = useState(60);
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const [astrologerTyping, setAstrologerTyping] = useState(false);
  const [notice, setNotice] = useState("");
  const [endReason, setEndReason] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  // Bumped by "Chat again" to reconnect the same conversation.
  const [attempt, setAttempt] = useState(0);
  const [reopening, setReopening] = useState(false);
  const user = useUserStore((s) => s.user);
  const pickerRef = useRef<PickerState | null>(null);
  pickerRef.current = picker;

  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<ScrollView>(null);
  const seenIds = useRef(new Set<string>());
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const addMessage = useCallback((message: Message) => {
    if (seenIds.current.has(message.id)) return;
    seenIds.current.add(message.id);
    setMessages((previous) => [...previous, message]);
  }, []);

  const finish = useCallback((reason: string) => {
    setEndReason(reason);
    setState("ended");
    setAstrologerTyping(false);
    setNotice("");
  }, []);

  // ------------------------------------------------------------
  // 1. Earlier messages (HTTP), then 2. the live socket.
  // ------------------------------------------------------------

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let socket: WebSocket | null = null;

    const run = async () => {
      try {
        const headers = (await authHeaders()) as Record<string, string>;

        // Earlier chats with this astrologer + this chat so far.
        const response = await fetch(`${API_URL}/chat/session/${sessionId}/conversation`, { headers });
        const data = await response.json().catch(() => ({}));

        if (response.ok && !cancelled) {
          (data?.messages ?? []).forEach((item: any, index: number) =>
            addMessage(toMessage(item, sessionId, `history-${index}`))
          );
        }

        const token = (headers.Authorization || headers.authorization || "").replace(/^Bearer\s+/i, "");
        if (!token || cancelled) return;

        socket = new WebSocket(
          `${API_URL.replace(/^http/, "ws")}/chat/session/${sessionId}/ws?token=${encodeURIComponent(token)}`
        );
        socketRef.current = socket;

        socket.onmessage = (event) => {
          let data: any;
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }

          if (applyWalletUpdate(data)) return;

          switch (data.type) {
            case "waiting_for_astrologer":
              setWaitSeconds(Math.max(0, Number(data.expires_in) || 0));
              setState("waiting");
              break;

            case "astrologer_joined":
              setState("active");
              track("chat_started", { chat_type: "human", reading_type: readingType, astrologer_id: astrologerId });
              setNotice("");
              break;

            case "peer_reconnected":
              setState((current) => (current === "ended" ? current : "active"));
              setNotice("");
              break;

            case "peer_disconnected":
              setNotice(translate("chat.live.peerLost", { name }));
              setAstrologerTyping(false);
              break;

            case "message":
              addMessage(toMessage(data, sessionId, `${Date.now()}-${Math.random()}`));
              if (data.from === "astrologer") setAstrologerTyping(false);

              // The card the server drew for the open picker: reveal it.
              if (
                data.message_type === "tarot_card" &&
                pickerRef.current?.requestId === data.request_id
              ) {
                setPicker({ ...pickerRef.current, phase: "ready", revealCard: data.card });
              }
              break;

            case "tarot_request_update":
              setMessages((previous) =>
                previous.map((m) =>
                  m.id === data.request_id && m.tarot
                    ? { ...m, tarot: { ...m.tarot, picked: data.picked ?? [] } }
                    : m
                )
              );
              break;

            case "error":
              if (pickerRef.current) {
                setPicker(null);
                Alert.alert(translate("chat.live.tarot"), data.message || translate("chat.pleaseTryAgain"));
              }
              break;

            case "typing":
              if (data.from === "astrologer") setAstrologerTyping(Boolean(data.typing));
              break;

            case "insufficient_credits":
              finish("insufficient_credits");
              break;

            case "credits_exhausted":
              setRemainingSeconds(0);
              finish("credits_exhausted");
              break;

            case "session_ended":
              finish(data.reason || "ended");
              break;
          }
        };

        socket.onclose = () => {
          socketRef.current = null;

          // The server makes the chat's last charge after the disconnect.
          setTimeout(refreshWalletCredits, 1500);
          if (!cancelled) {
            setState((current) => (current === "ended" || current === "loading" ? current : "ended"));
            setEndReason((current) => current ?? "user_left");
          }
        };

        socket.onerror = () => {
          if (!cancelled) setNotice(translate("chat.live.connectionProblem"));
        };
      } catch (error) {
        console.error("Live chat failed to start:", error);
        if (!cancelled) {
          Alert.alert(translate("chat.live.unableToOpen"), translate("chat.pleaseTryAgain"));
          finish("user_left");
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      socket?.close();
      socketRef.current = null;
    };
  }, [sessionId, name, addMessage, finish, attempt]);

  // Countdowns: request timeout while waiting, paid time while active.
  useEffect(() => {
    if (state !== "waiting" && state !== "active") return;

    const timer = setInterval(() => {
      if (state === "waiting") setWaitSeconds((s) => Math.max(0, s - 1));
      else setRemainingSeconds((s) => Math.max(0, s - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length, astrologerTyping, state]);

  // ------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------

  const send = (payload: object) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      return true;
    }
    return false;
  };

  const canType = state === "waiting" || state === "active";

  const sendMessage = () => {
    const message = text.trim();
    if (!message || !canType) return;
    if (send({ type: "message", message })) {
      setText("");
      send({ type: "typing", typing: false });
    }
  };

  const onChangeText = (value: string) => {
    setText(value);
    if (state !== "active") return;
    send({ type: "typing", typing: value.length > 0 });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => send({ type: "typing", typing: false }), 2000);
  };

  // Same conversation, new request: the astrologer is notified again.
  const chatAgain = async () => {
    if (reopening) return;

    const rate = Number(ratePerMinute) || Number(astrologer?.price) || 0;

    if (
      !ensureChatCredits(
        Number(user?.credits ?? 0),
        rate,
        Boolean(user?.free_chat_minute_available)
      )
    ) {
      return;
    }

    setReopening(true);

    try {
      const response = await fetch(`${API_URL}/chat/session/start`, {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          astrologer_id: astrologerId,
          reading_type: readingType,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data?.detail === "string" ? data.detail : t("chat.pleaseTryAgain"));
      }

      if (Number(data.remaining_time_seconds) > 0) {
        setRemainingSeconds(Math.floor(Number(data.remaining_time_seconds)));
      }

      setEndReason(null);
      setNotice("");
      setWaitSeconds(60);
      setState("loading");
      setAttempt((n) => n + 1);
    } catch (error) {
      Alert.alert(t("chat.live.cantStart"), error instanceof Error ? error.message : t("chat.pleaseTryAgain"));
    } finally {
      setReopening(false);
    }
  };

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(root)/(tabs)/chat" as never);
  };

  const confirmEnd = () => {
    if (state === "waiting") {
      Alert.alert(t("chat.live.cancelRequestTitle"), t("chat.live.cancelRequestBody", { name: displayName }), [
        { text: t("chat.live.keepWaiting"), style: "cancel" },
        { text: t("chat.live.cancelRequest"), style: "destructive", onPress: () => send({ type: "end" }) },
      ]);
      return;
    }

    if (state === "active") {
      Alert.alert(t("chat.live.endChatTitle"), t("chat.live.endChatBody"), [
        { text: t("chat.live.continueChatting"), style: "cancel" },
        { text: t("chat.live.endChat"), style: "destructive", onPress: () => send({ type: "end" }) },
      ]);
      return;
    }

    leave();
  };

  // ------------------------------------------------------------
  // Tarot picker
  // ------------------------------------------------------------

  const pickerRequest = picker ? messages.find((m) => m.id === picker.requestId) : undefined;
  const pickedCount = pickerRequest?.tarot?.picked.length ?? 0;
  const totalCards = pickerRequest?.tarot?.count ?? 1;

  const openPicker = (request: Message) => {
    if (state !== "active" || !request.tarot) return;
    if (request.tarot.picked.length >= request.tarot.count) return;
    setPicker({ requestId: request.id, phase: "pick", revealCard: null });
  };

  const pickCard = () => {
    if (!picker || picker.phase !== "pick") return;
    if (send({ type: "tarot_pick", request_id: picker.requestId })) {
      setPicker({ ...picker, phase: "waiting" });
    }
  };

  const pickerDone = () => {
    if (picker && pickedCount < totalCards && state === "active") {
      setPicker({ ...picker, phase: "pick", revealCard: null });
    } else {
      setPicker(null);
    }
  };

  // ------------------------------------------------------------
  // UI (same look as the AI chat pages for this reading type)
  // ------------------------------------------------------------

  const theme = THEMES[(readingType as ReadingType) || "vedic"] ?? THEMES.vedic;
  const ended = endReason ? END_REASONS[endReason] : undefined;
  const sendDisabled = !canType || !text.trim();

  const statusText =
    state === "loading"
      ? t("chat.live.connecting")
      : state === "waiting"
        ? t("chat.live.waitingToAccept")
        : state === "active"
          ? t("chat.online")
          : t("chat.live.chatEnded");

  const statusColor = state === "active" ? C.online : C.muted;

  const userBubble = {
    backgroundColor: theme.userBubble,
    borderBottomRightRadius: theme.corner,
  };

  const astroBubble = {
    backgroundColor: theme.astroBg,
    borderColor: theme.astroBorder,
    borderBottomLeftRadius: theme.corner,
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingBottom: keyboard.padding }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      onLayout={keyboard.onLayout}
    >
      <View style={[styles.flex, { backgroundColor: theme.screenBg }]}>
        {/* Header (as in the AI chat pages) */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 52) }]}>
          <Pressable onPress={leave} hitSlop={8} style={styles.iconButton} accessibilityLabel={t("common.back")}>
            <MaterialCommunityIcons name="arrow-left" size={27} color={C.ink} />
          </Pressable>

          <View style={styles.avatar}>
            {astrologer?.photo ? (
              <Image source={{ uri: astrologer.photo }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <MaterialCommunityIcons name="account" size={27} color={C.plum} />
            )}
          </View>

          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.status, { color: statusColor }]} numberOfLines={1}>
                {statusText}
              </Text>
            </View>
          </View>

          {(state === "waiting" || state === "active") && (
            <Pressable onPress={confirmEnd} style={styles.endButton}>
              <Text style={styles.endText} numberOfLines={1}>
                {state === "waiting" ? t("common.cancel") : t("chat.live.end")}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Remaining time (as in the AI chat pages) */}
        {state === "active" && (
          <View style={styles.timeBar}>
            <MaterialCommunityIcons name="clock-outline" size={18} color="#FFFFFF" />
            <Text style={styles.timeText}>
              {t("chat.remainingTime", { time: formatClock(remainingSeconds) })}
            </Text>
          </View>
        )}

        <ImageBackground
          source={theme.background}
          style={styles.flex}
          imageStyle={styles.backgroundImage}
          resizeMode="cover"
        >
          {/* Waiting for the astrologer to accept */}
          {state === "waiting" && (
            <View style={[styles.waitCard, { borderColor: theme.astroBorder, backgroundColor: theme.astroBg }]}>
              <ActivityIndicator color={C.plum} />
              <View style={styles.flex}>
                <Text style={styles.waitTitle}>{t("chat.live.waitingFor", { name: displayName })}</Text>
                <Text style={styles.waitBody}>
                  {waitSeconds > 0
                    ? t("chat.live.waitLeft", { seconds: waitSeconds })
                    : t("chat.live.almostOut")}
                </Text>
              </View>
            </View>
          )}

          {!!notice && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          )}

          {state === "loading" ? (
            <View style={styles.centered}>
              <ActivityIndicator size="small" color={C.plum} />
              <Text style={styles.loadingText}>{t("chat.loadingConversation")}</Text>
            </View>
          ) : (
            <ScrollView
              ref={listRef}
              style={styles.flex}
              contentContainerStyle={styles.messages}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <ChatWelcome
                type={(readingType as ReadingType) || "vedic"}
                astrologerName={displayName}
                fresh={messages.length === 0}
                bubbleColor={theme.astroBg}
                borderColor={theme.astroBorder}
              />

              {messages.map((m, index) => {
                const chatId = m.sessionId || sessionId;
                const previousChatId = index > 0 ? messages[index - 1].sessionId || sessionId : null;
                const hasEarlierChats = messages.some((x) => (x.sessionId || sessionId) !== sessionId);
                const showDivider = hasEarlierChats && chatId !== previousChatId;
                const isUser = m.sender === "user";

                return (
                  <View key={m.id} style={[styles.row, isUser ? styles.rowEnd : styles.rowStart]}>
                    {showDivider && (
                      <Text style={styles.divider}>
                        {chatId === sessionId
                          ? t("chat.live.thisChat")
                          : t("chat.live.previousChat", { date: formatDay(m.at) })}
                      </Text>
                    )}

                    {m.kind === "tarot_request" && m.tarot ? (
                      <View style={[styles.bubble, styles.astroBubble, astroBubble, styles.tarotRequest]}>
                        <CardBack width={54} height={92} />
                        <View style={styles.flex}>
                          <Text style={styles.tarotTitle}>
                            {m.tarot.count > 1
                              ? t("chat.live.tarotAskMany", { name: displayName, count: m.tarot.count })
                              : t("chat.live.tarotAskOne", { name: displayName })}
                          </Text>
                          {!!m.tarot.note && <Text style={styles.astroText}>{m.tarot.note}</Text>}
                          {m.tarot.picked.length < m.tarot.count ? (
                            <Pressable
                              onPress={() => openPicker(m)}
                              disabled={state !== "active"}
                              style={[
                                styles.tarotButton,
                                { backgroundColor: state === "active" ? C.plum : C.disabled },
                              ]}
                            >
                              <Text style={styles.tarotButtonText}>
                                {m.tarot.count > 1
                                  ? t(
                                      m.tarot.picked.length > 0
                                        ? "chat.live.pickNextProgress"
                                        : "chat.live.pickYourProgress",
                                      { current: m.tarot.picked.length + 1, total: m.tarot.count }
                                    )
                                  : m.tarot.picked.length > 0
                                    ? t("chat.tarot.pickNext")
                                    : t("chat.tarot.pickYourCard")}
                              </Text>
                            </Pressable>
                          ) : (
                            <Text style={styles.tarotDone}>
                              {m.tarot.count > 1 ? t("chat.live.cardsPickedCheck") : t("chat.live.cardPickedCheck")}
                            </Text>
                          )}
                        </View>
                      </View>
                    ) : m.kind === "tarot_card" && m.card ? (
                      // Same as the revealed card in the AI tarot chat.
                      <View style={[styles.cardBubble, astroBubble, { borderBottomRightRadius: theme.corner }]}>
                        {m.card.image ? (
                          <Image source={{ uri: m.card.image }} style={styles.tarotImage} resizeMode="cover" />
                        ) : (
                          <CardBack width={150} height={258} />
                        )}
                        <Text style={styles.tarotCardName}>{m.card.name}</Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.bubble,
                          isUser ? userBubble : [styles.astroBubble, astroBubble],
                        ]}
                      >
                        <Text style={isUser ? styles.userText : styles.astroText}>{m.text}</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Typing (as in the AI chat pages) */}
              {astrologerTyping && (
                <View style={[styles.row, styles.rowStart]}>
                  <View style={[styles.bubble, styles.astroBubble, astroBubble, styles.typingBubble]}>
                    <ActivityIndicator size="small" color={C.plum} />
                    <Text style={styles.typingText}>{t("chat.typingShort")}</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </ImageBackground>

        {/* Ended panel (as the AI pages' "Consultation time ended") or input */}
        {state === "ended" ? (
          <View style={[styles.endPanel, { paddingBottom: insets.bottom + 20 }]}>
            <MaterialCommunityIcons
              name={ended?.recharge ? "wallet-outline" : "message-text-outline"}
              size={34}
              color={C.gold}
            />
            <Text style={styles.endTitle}>{t(ended?.title ?? "chat.live.chatEnded")}</Text>
            <Text style={styles.endBody}>
              {t(ended?.body ?? "chat.live.end.defaultBody", { name: displayName })}
            </Text>

            {ended?.recharge && (
              <Pressable
                style={[styles.panelButton, { backgroundColor: C.green }]}
                onPress={() => router.push("/profile/wallet")}
              >
                <Text style={styles.panelButtonText}>{t("chat.rechargeWallet")}</Text>
              </Pressable>
            )}

            {!ended?.recharge && (
              <Pressable
                style={[styles.panelButton, { backgroundColor: C.plum }]}
                onPress={chatAgain}
                disabled={reopening}
              >
                {reopening ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.panelButtonText}>{t("chat.live.chatAgain", { name: displayName })}</Text>
                )}
              </Pressable>
            )}

            <Pressable style={[styles.panelButton, styles.panelButtonOutline]} onPress={leave}>
              <Text style={[styles.panelButtonText, { color: C.plum }]}>{t("chat.live.backToAstrologers")}</Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              styles.composer,
              {
                borderTopColor: theme.inputBorder,
                backgroundColor: theme.inputBg,
                paddingBottom: keyboard.open ? 12 : Math.max(insets.bottom, 12) + 8,
              },
            ]}
          >
            <View style={[styles.inputRow, { borderColor: theme.inputBorder, backgroundColor: theme.inputBg }]}>
              <TextInput
                value={text}
                onChangeText={onChangeText}
                placeholder={
                  state === "loading"
                    ? t("chat.connecting")
                    : state === "waiting"
                      ? t("chat.live.writePlaceholder")
                      : t("chat.askPlaceholder")
                }
                placeholderTextColor={C.placeholder}
                multiline
                editable={canType}
                textAlignVertical="center"
                style={styles.input}
              />

              <Pressable
                onPress={sendMessage}
                disabled={sendDisabled}
                style={[styles.sendButton, { backgroundColor: sendDisabled ? C.disabled : theme.send }]}
                accessibilityLabel={t("chat.send")}
              >
                <MaterialCommunityIcons
                  name="arrow-up"
                  size={22}
                  color={sendDisabled ? C.placeholder : "#FFFFFF"}
                />
              </Pressable>
            </View>

            <Text style={styles.disclaimer}>{t("chat.disclaimer")}</Text>
          </View>
        )}

        {picker && (
          <TarotPicker
            phase={picker.phase}
            astrologerName={displayName}
            cardNumber={Math.min(totalCards, pickedCount + (picker.phase === "pick" ? 1 : 0))}
            total={totalCards}
            revealCard={picker.revealCard}
            onPick={pickCard}
            onClose={() => setPicker(null)}
            onDone={pickerDone}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iconButton: { width: 40, height: 44, marginRight: 12, alignItems: "center", justifyContent: "center" },
  avatar: {
    width: 52,
    height: 52,
    marginRight: 12,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.gold,
    backgroundColor: C.ivory,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: "100%", height: "100%" },
  name: { fontSize: 16, fontWeight: "600", color: C.ink },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  status: { fontSize: 13, fontWeight: "500" },
  endButton: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  endText: { fontSize: 14, fontWeight: "600", color: "#B3261E" },
  timeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: C.plum,
  },
  timeText: { marginLeft: 8, color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  backgroundImage: { width: "100%", height: "100%" },
  waitCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
  },
  waitTitle: { fontSize: 15, fontWeight: "600", color: C.ink },
  waitBody: { marginTop: 2, fontSize: 13, color: C.muted, lineHeight: 18 },
  notice: { marginHorizontal: 16, marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: C.warnBg },
  noticeText: { fontSize: 13, color: C.warnInk },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: C.muted },
  messages: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24 },
  row: { marginBottom: 16 },
  rowStart: { alignItems: "flex-start" },
  rowEnd: { alignItems: "flex-end" },
  divider: {
    alignSelf: "center",
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: C.card,
    color: C.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  // Same bubble shape as the AI chat pages.
  bubble: { maxWidth: "86%", paddingHorizontal: 20, paddingVertical: 16, borderRadius: 22 },
  astroBubble: { borderWidth: 1 },
  userText: { color: C.card, fontSize: 16, lineHeight: 24 },
  astroText: { color: C.ink, fontSize: 16, lineHeight: 24 },
  typingBubble: { flexDirection: "row", alignItems: "center" },
  typingText: { marginLeft: 12, fontSize: 14, color: C.muted },
  tarotRequest: { flexDirection: "row", gap: 14, alignItems: "center", width: "86%" },
  tarotTitle: { color: C.ink, fontSize: 15, fontWeight: "600", marginBottom: 4 },
  tarotButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  tarotButtonText: { color: C.card, fontSize: 15, fontWeight: "600" },
  tarotDone: { marginTop: 8, color: C.green, fontSize: 14, fontWeight: "600" },
  cardBubble: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 22,
    borderWidth: 1,
  },
  tarotImage: { width: 150, height: 258, borderRadius: 8 },
  tarotCardName: { marginTop: 10, fontSize: 16, fontWeight: "600", color: C.ink },
  composer: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    paddingVertical: 16,
    fontSize: 16,
    color: C.inputInk,
  },
  sendButton: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimer: { marginTop: 8, textAlign: "center", fontSize: 11, color: C.placeholder },
  endPanel: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  endTitle: { marginTop: 12, fontSize: 21, fontWeight: "700", color: C.ink, textAlign: "center" },
  endBody: { marginTop: 8, fontSize: 14, color: C.muted, textAlign: "center", lineHeight: 20 },
  panelButton: { width: "100%", marginTop: 12, paddingVertical: 15, borderRadius: 16, alignItems: "center" },
  panelButtonOutline: { borderWidth: 1, borderColor: C.border },
  panelButtonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
