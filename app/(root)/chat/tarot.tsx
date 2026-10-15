
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardInset } from "../../../components/utils/useKeyboardInset";

import tarotCards from "../../../components/constants/tarot_cards.json";
import ChatWelcome from "../../../components/chat/ChatWelcome";
import { track } from "../../../lib/analytics";
import { useAstrologersStore } from "../../../components/stores/astrologersStore";
import {
  applyWalletUpdate,
  refreshWalletCredits,
} from "../../../components/stores/userStore";
import { API_URL, getAccessToken } from "../../../lib/auth";

/* ============================================================
 * THEME
 * ============================================================ */

const TAROT_CHAT_BACKGROUND = require(
  "../../../assets/backgrounds/tarot_chat_background.png"
);

const C = {
  ink: "#1C1820",
  plum: "#2B1A3D",
  plumDeep: "#1E1230",
  gold: "#C49A4A",
  lavender: "#F4F0F8",
  ivory: "#F7F1E8",
  card: "#FFFDFC",
  secondary: "#68616A",
  border: "#D9CEC1",
  online: "#5C8A4A",
} as const;

/* ============================================================
 * FORMATTED ASSISTANT MESSAGES
 * ============================================================ */

function FormattedAssistantMessage({
  text,
}: {
  text: string;
}) {
  const lines = text.split(/\r?\n/);

  return (
    <View>
      {lines.map((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <View key={index} style={{ height: 8 }} />;
        }

        const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);

        if (bulletMatch) {
          return (
            <View key={index} className="mb-1 flex-row">
              <Text className="mr-2 text-[16px] leading-6 text-[#1C1820]">
                •
              </Text>
              <View className="flex-1">
                <FormattedInlineText text={bulletMatch[1]} />
              </View>
            </View>
          );
        }

        const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);

        if (numberMatch) {
          return (
            <View key={index} className="mb-1 flex-row">
              <Text className="mr-2 text-[16px] leading-6 text-[#1C1820]">
                {numberMatch[1]}.
              </Text>
              <View className="flex-1">
                <FormattedInlineText text={numberMatch[2]} />
              </View>
            </View>
          );
        }

        const headingMatch = trimmed.match(/^#{1,3}\s+(.*)$/);

        if (headingMatch) {
          return (
            <Text
              key={index}
              className="mb-2 mt-1 text-[18px] font-bold leading-6 text-[#1C1820]"
            >
              {headingMatch[1]}
            </Text>
          );
        }

        return (
          <View key={index} className="mb-2">
            <FormattedInlineText text={line} />
          </View>
        );
      })}
    </View>
  );
}

function FormattedInlineText({
  text,
}: {
  text: string;
}) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return (
    <Text className="text-[16px] leading-6 text-[#1C1820]">
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <Text
              key={index}
              className="font-bold text-[#1C1820]"
            >
              {part.slice(2, -2)}
            </Text>
          );
        }

        if (
          part.startsWith("*") &&
          part.endsWith("*") &&
          !part.startsWith("**")
        ) {
          return (
            <Text key={index} className="italic text-[#1C1820]">
              {part.slice(1, -1)}
            </Text>
          );
        }

        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
}

/* ============================================================
 * TYPES
 * ============================================================ */

type TarotCard = {
  name: string;
  image: string;
};

type ChatItem =
  | {
      id: string;
      kind: "text";
      text: string;
      sender: "user" | "assistant";
    }
  | {
      id: string;
      kind: "prompt";
      question: string;
      used: boolean;
      // Cards to pick for the spread (1-3) and its name.
      count: number;
      label?: string;
    }
  | {
      id: string;
      kind: "card";
      card: TarotCard;
      // e.g. "Past", "Cause", "Your answer".
      position?: string;
    };

type DrawnCard = TarotCard & { position?: string };

const ORDINALS = ["1st", "2nd", "3rd"];

type Phase = "pick" | "waiting" | "ready" | null;

/* ============================================================
 * DECK
 * ============================================================ */

const TAROT_CARDS: TarotCard[] = tarotCards;

const normalize = (s: string) =>
  s.trim().toLowerCase().replace("judgment", "judgement").replace(/^the\s+/, "");

const findTarotCard = (name: string) =>
  TAROT_CARDS.find((c) => normalize(c.name) === normalize(name));

const shuffleCards = (cards: TarotCard[]) => {
  const a = [...cards];

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
};

/* ============================================================
 * FAN CONSTANTS
 * ============================================================ */

const CARD_W = 116;
const CARD_H = 200;
const STEP = 56;
const FAN_COUNT = 15;

/* ============================================================
 * CARD BACK
 * ============================================================ */

function CardBack({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <View
      style={{
        width,
        height,
        borderRadius: 12,
        backgroundColor: C.plum,
        borderWidth: 1,
        borderColor: "rgba(217,206,193,0.45)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 6,
          right: 6,
          top: 6,
          bottom: 6,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: C.gold,
        }}
      />
      <View className="flex-1 items-center justify-center">
        <MaterialCommunityIcons
          name="star-four-points-outline"
          size={Math.round(width * 0.22)}
          color={C.gold}
        />
      </View>
    </View>
  );
}

/* ============================================================
 * SCREEN
 * ============================================================ */

export default function TarotChat() {
  const insets = useSafeAreaInsets();
  // Keeps the input above the keyboard on Android (edge-to-edge).
  const keyboard = useKeyboardInset();
  const {
    sessionId,
    astrologerName,
    profileId,
    astrologerId,
    walletBalance,
    ratePerMinute,
    remainingTimeSeconds,
  } = useLocalSearchParams<{
    sessionId?: string;
    astrologerName?: string;
    profileId?: string;
    astrologerId?: string;
    walletBalance?: string;
    ratePerMinute?: string;
    remainingTimeSeconds?: string;
  }>();

  const { width } = useWindowDimensions();
  const fanPad = (width - CARD_W) / 2;

  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<ScrollView>(null);
  const fanRef = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const phaseRef = useRef<Phase>(null);
  const heldRef = useRef<ChatItem[]>([]);
  const lastQuestionRef = useRef("");
  const activePromptRef = useRef<string | null>(null);
  const activeQuestionRef = useRef("");
  const idRef = useRef(0);

  const [message, setMessage] = useState("");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [phase, setPhaseState] = useState<Phase>(null);
  const [fanCards, setFanCards] = useState<TarotCard[]>([]);
  const [center, setCenter] = useState(0);
  // Cards revealed after the reading (1-3, with positions).
  const [revealCards, setRevealCards] = useState<DrawnCard[]>([]);
  // How many cards this spread needs, and the fan cards picked so far.
  const [needed, setNeeded] = useState(1);
  const [picked, setPicked] = useState<number[]>([]);

  /* ============================================================
   * SESSION COUNTDOWN
   * ============================================================ */

  const wallet = Number(walletBalance ?? 0);
  const rate = Number(ratePerMinute ?? 0);
  const backendRemaining = Number(remainingTimeSeconds ?? 0);

  const initialTime =
    Number.isFinite(backendRemaining) && backendRemaining > 0
      ? Math.floor(backendRemaining)
      : Number.isFinite(wallet) &&
          Number.isFinite(rate) &&
          rate > 0
        ? Math.floor((wallet / rate) * 60)
        : 0;

  const [timeLeft, setTimeLeft] = useState(initialTime);

  useEffect(() => {
    setTimeLeft(initialTime);

    if (initialTime <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          clearInterval(interval);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionId, initialTime]);

  const formatCountdown = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

  const uid = (k: string) =>
    `${k}-${Date.now()}-${idRef.current++}`;

  const { astrologers } = useAstrologersStore();

  const astrologer = astrologers.find(
    (item) => item.astrologer_id === astrologerId
  );

  /* ============================================================
   * SCROLL TO LATEST
   * ============================================================ */

  const scrollToLatest = (animated = true) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated });
      }, 50);
    });
  };

  useEffect(() => {
    if (!items.length) return;
    scrollToLatest(true);
  }, [items]);

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  /* ============================================================
   * ADD ITEMS
   * ============================================================ */

  const addItems = (next: ChatItem[]) => {
    if (!next.length) return;

    if (
      phaseRef.current === "waiting" ||
      phaseRef.current === "ready"
    ) {
      heldRef.current.push(...next);
    } else {
      setItems((prev) => [...prev, ...next]);
    }
  };

  /* ============================================================
   * FAILED READING
   * ============================================================ */

  const failReading = () => {
    if (phaseRef.current !== "waiting") {
      return;
    }

    const id = activePromptRef.current;

    setPhase(null);

    setItems((prev) =>
      prev.map((it) =>
        it.kind === "prompt" && it.id === id
          ? { ...it, used: false }
          : it
      )
    );
  };

  /* ============================================================
   * LOAD PREVIOUS MESSAGES
   * ============================================================ */

  useEffect(() => {
    if (!sessionId || !profileId) {
      return;
    }

    let mounted = true;

    const loadPreviousMessages = async () => {
      try {
        console.log("Loading previous Tarot messages:", sessionId);

        const accessToken = await getAccessToken();

        if (!accessToken) {
          console.error("Access token is missing");
          return;
        }

        const response = await fetch(
          `${API_URL}/chat/session/${sessionId}/messages?profile_id=${encodeURIComponent(
            profileId
          )}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const data = await response.json();

        console.log("Previous Tarot messages response:", data);

        if (!response.ok) {
          throw new Error(
            data?.detail || "Failed to load Tarot chat history"
          );
        }

        if (!mounted) {
          return;
        }

        const loadedItems: ChatItem[] = [];
        const historyMessages = Array.isArray(data?.messages)
          ? data.messages
          : [];

        for (let i = 0; i < historyMessages.length; i++) {
          const item = historyMessages[i];
          const messageType = item?.message_type;

          const sender =
            item?.sender_type === "user" ? "user" : "assistant";

          /* TAROT CARD */
          if (messageType === "tarot_card" && item?.card) {
            // The app's deck image, or DivineAPI's for a card not in it.
            const card =
              findTarotCard(String(item.card)) ??
              (item.card_image ? { name: String(item.card), image: String(item.card_image) } : null);

            if (card) {
              loadedItems.push({
                id: item.message_id || uid("history-card"),
                kind: "card",
                card,
                position: item.card_position || undefined,
              });
            }

            // Skip duplicated user question.
            const nextItem = historyMessages[i + 1];

            if (
              nextItem &&
              nextItem?.sender_type === "user" &&
              nextItem?.message &&
              nextItem?.message_type !== "tarot_card"
            ) {
              i++;
            }

            continue;
          }

          /* AI MESSAGE */
          if (sender === "assistant" && item?.message) {
            const aiMessage = String(item.message).trim();
            const lowerMessage = aiMessage.toLowerCase();

            const asksForTarotCard =
              lowerMessage.includes("draw a tarot card") ||
              lowerMessage.includes("draw tarot card") ||
              lowerMessage.includes("pick a card") ||
              lowerMessage.includes("pick your card") ||
              lowerMessage.includes("draw a card") ||
              lowerMessage.includes("tarot card whenever you're ready");

            if (asksForTarotCard) {
              let question = "";

              // Find the user's question before this Tarot prompt.
              for (let j = i - 1; j >= 0; j--) {
                const previous = historyMessages[j];

                if (
                  previous?.sender_type === "user" &&
                  previous?.message &&
                  previous?.message_type !== "tarot_card"
                ) {
                  question = String(previous.message);
                  break;
                }
              }

              let promptUsed = false;

              for (let j = i + 1; j < historyMessages.length; j++) {
                const next = historyMessages[j];

                if (
                  next?.message_type === "tarot_card" &&
                  next?.card
                ) {
                  promptUsed = true;
                  break;
                }

                if (
                  next?.sender_type === "user" &&
                  next?.message &&
                  next?.message_type !== "tarot_card"
                ) {
                  break;
                }
              }

              loadedItems.push({
                id: item.message_id || uid("history-prompt"),
                kind: "prompt",
                question,
                used: promptUsed,
              });

              continue;
            }

            loadedItems.push({
              id: item.message_id || uid("history-ai"),
              kind: "text",
              text: aiMessage,
              sender: "assistant",
            });

            continue;
          }

          /* NORMAL USER MESSAGE */
          if (sender === "user" && item?.message) {
            loadedItems.push({
              id: item.message_id || uid("history-user"),
              kind: "text",
              text: String(item.message),
              sender: "user",
            });
          }
        }

        setItems(loadedItems);

        requestAnimationFrame(() => {
          setTimeout(() => {
            if (mounted) {
              scrollToLatest(false);
            }
          }, 100);
        });
      } catch (error) {
        console.error("Failed to load Tarot chat history:", error);
      }
    };

    loadPreviousMessages();

    return () => {
      mounted = false;
    };
  }, [sessionId, profileId]);

  /* ============================================================
   * WEBSOCKET
   * ============================================================ */

  useEffect(() => {
    let mounted = true;
    let attempts = 0;

    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      if (!sessionId) {
        console.error("Tarot session ID is missing");
        return;
      }

      try {
        const accessToken = await getAccessToken();

        if (!accessToken || !mounted) {
          return;
        }

        const wsUrl =
          `${API_URL.replace(/^http/, "ws")}/chat/session/${sessionId}/ws` +
          `?token=${encodeURIComponent(accessToken)}`;

        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          if (!mounted) return;

          // Only the first connection (it reconnects automatically).
          if (attempts === 0) {
            track("chat_started", { chat_type: "ai", reading_type: "tarot", astrologer_id: astrologerId });
          }

          attempts = 0;
          setConnected(true);
        };

        socket.onmessage = (event) => {
          if (!mounted || event.data === "pong") {
            return;
          }

          try {
            const data =
              typeof event.data === "string"
                ? JSON.parse(event.data)
                : event.data;

            // Balance update mid-reading: keep the spinner.
            if (applyWalletUpdate(data)) return;

            // Cards drawn: reveal them now; the reading follows.
            if (data?.type === "tarot_cards") {
              const drawn: DrawnCard[] = (Array.isArray(data.cards) ? data.cards : []).map((c: any) => ({
                ...(findTarotCard(String(c.name)) ?? {
                  name: String(c.name),
                  image: String(c.image || ""),
                }),
                position: c.position || undefined,
              }));
              if (drawn.length && phaseRef.current === "waiting") {
                setRevealCards(drawn);
                setPhase("ready");
              }
              return;
            }

            // The reading arrives message by message (held behind the
            // overlay until "Back to chat").
            if (data?.type === "message_part") {
              if (typeof data.text === "string" && data.text.trim()) {
                addItems([
                  { id: uid("a"), kind: "text", text: data.text.trim(), sender: "assistant" },
                ]);
              }
              return;
            }

            setLoading(false);

            // Already shown message by message (cards came first).
            if (data?.streamed) {
              return;
            }

            /* Assistant response */
            if (data?.response) {
              const parts = String(data.response)
                .split(/\n\s*\n/)
                .map((p: string) => p.trim())
                .filter(Boolean);

              addItems(
                parts.map(
                  (text: string): ChatItem => ({
                    id: uid("a"),
                    kind: "text",
                    text,
                    sender: "assistant",
                  })
                )
              );
            }

            /* AI asks for Tarot card */
            if (data?.action === "draw_tarot_card") {
              addItems([
                {
                  id: uid("prompt"),
                  kind: "prompt",
                  question: lastQuestionRef.current,
                  used: false,
                  count: Math.min(3, Math.max(1, Number(data?.cards_needed) || 1)),
                  label: data?.spread_label || undefined,
                },
              ]);
            }

            /* Tarot reading returned */
            if (data?.reading_type === "tarot" && data?.card) {
              // DivineAPI drew these cards: the app's deck image, else theirs.
              const source = Array.isArray(data.cards) && data.cards.length
                ? data.cards
                : [{ name: data.card, image: data.card_image }];
              const drawn: DrawnCard[] = source.map((c: any) => ({
                ...(findTarotCard(String(c.name)) ?? {
                  name: String(c.name),
                  image: String(c.image || ""),
                }),
                position: c.position || undefined,
              }));

              if (phaseRef.current === "waiting") {
                setRevealCards(drawn);
                setPhase("ready");
              } else {
                setItems((prev) => [
                  ...prev,
                  ...drawn.map(
                    (card): ChatItem => ({
                      id: uid("card"),
                      kind: "card",
                      card,
                      position: card.position,
                    })
                  ),
                ]);
              }
            }

            if (data?.success === false) {
              console.error(
                "Tarot WebSocket error:",
                data?.error || data?.message
              );

              failReading();
            }
          } catch (error) {
            console.error(
              "Failed to parse Tarot WebSocket response:",
              error
            );

            setLoading(false);
            failReading();
          }
        };

        socket.onerror = () => {
          if (!mounted) return;

          setConnected(false);
          setLoading(false);
          failReading();
        };

        socket.onclose = () => {
          // The server makes the chat's last charge after the disconnect.
          setTimeout(refreshWalletCredits, 1500);

          if (!mounted) return;

          setConnected(false);
          setLoading(false);
          failReading();

          if (attempts < 5) {
            const delay = Math.min(1000 * 2 ** attempts, 10000);
            attempts += 1;

            retry = setTimeout(connect, delay);
          }
        };
      } catch (error) {
        console.error("Failed to connect Tarot WebSocket:", error);
      }
    };

    connect();

    return () => {
      mounted = false;

      if (retry) {
        clearTimeout(retry);
      }

      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [sessionId]);

  /* ============================================================
   * SEND MESSAGE
   * ============================================================ */

  const handleSend = () => {
    const question = message.trim();

    if (!question || loading) {
      return;
    }

    if (!socketRef.current || !connected) {
      return;
    }

    lastQuestionRef.current = question;

    setItems((prev) => [
      ...prev,
      {
        id: uid("u"),
        kind: "text",
        text: question,
        sender: "user",
      },
    ]);

    setMessage("");
    setLoading(true);

    socketRef.current.send(
      JSON.stringify({
        type: "message",
        message: question,
      })
    );

    scrollToLatest(true);
  };

  /* ============================================================
   * OPEN TAROT PICKER
   * ============================================================ */

  const openPicker = (
    prompt: Extract<ChatItem, { kind: "prompt" }>
  ) => {
    if (prompt.used || !connected) {
      return;
    }

    const mid = Math.floor(FAN_COUNT / 2);

    activePromptRef.current = prompt.id;
    activeQuestionRef.current = prompt.question;

    setNeeded(prompt.count || 1);
    setPicked([]);
    setFanCards(shuffleCards(TAROT_CARDS).slice(0, FAN_COUNT));
    setCenter(mid);
    scrollX.setValue(mid * STEP);

    setPhase("pick");
  };

  /* ============================================================
   * PICK CARD
   * ============================================================ */

  const handlePick = (card: TarotCard, index: number) => {
    const socket = socketRef.current;

    if (
      !socket ||
      !connected ||
      phaseRef.current !== "pick" ||
      picked.includes(index)
    ) {
      return;
    }

    // Keep picking until the spread has all its cards.
    const nowPicked = [...picked, index];
    setPicked(nowPicked);
    if (nowPicked.length < needed) {
      return;
    }

    const id = activePromptRef.current;

    setItems((prev) =>
      prev.map((it) =>
        it.kind === "prompt" && it.id === id
          ? { ...it, used: true }
          : it
      )
    );

    setPhase("waiting");
    setLoading(true);

    socket.send(
      JSON.stringify({
        type: "tarot_card_selected",
        card: card.name,
        cards: nowPicked.map((i) => fanCards[i]?.name).filter(Boolean),
        question: activeQuestionRef.current,
      })
    );
  };

  /* ============================================================
   * FINISH READING
   * ============================================================ */

  const finishReading = () => {
    if (!revealCards.length) {
      return;
    }

    const queued = heldRef.current;
    heldRef.current = [];

    setPhase(null);

    setItems((prev) => [
      ...prev,
      ...revealCards.map(
        (card): ChatItem => ({
          id: uid("card"),
          kind: "card",
          card,
          position: card.position,
        })
      ),
      ...queued,
    ]);

    setRevealCards([]);
    setPicked([]);
  };

  /* ============================================================
   * FAN NAVIGATION
   * ============================================================ */

  const nudgeFan = (dir: 1 | -1) => {
    const next = Math.max(
      0,
      Math.min(FAN_COUNT - 1, center + dir)
    );

    fanRef.current?.scrollTo({
      x: next * STEP,
      animated: true,
    });
  };

  const sendDisabled =
    loading || !connected || !message.trim();

  /* ============================================================
   * OVERLAY COPY
   * ============================================================ */

  const plural = needed > 1;

  const overlayTitle =
    phase === "pick"
      ? plural
        ? `Choose your ${ORDINALS[Math.min(picked.length, 2)]} card`
        : "Choose your card"
      : phase === "waiting"
        ? `${astrologerName || "Your astrologer"} is reading`
        : plural
          ? "Your cards are ready"
          : "Your card is ready";

  const overlaySubtitle =
    phase === "pick"
      ? plural
        ? `Pick ${needed} cards · ${picked.length} of ${needed} chosen`
        : "This card will reveal your reading"
      : phase === "waiting"
        ? plural
          ? "your cards"
          : "your card"
        : plural
          ? "Your cards"
          : "Your card";

  /* ============================================================
   * RENDER
   * ============================================================ */

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F4F0F8]"
      style={{ flex: 1, paddingBottom: keyboard.padding }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      onLayout={keyboard.onLayout}
    >
      <View className="flex-1 bg-[#F4F0F8]">
        {/* CHAT HEADER */}
        <View
          className="border-b border-[#D9CEC1] bg-[#FFFDFC]"
          style={{
            paddingTop: 52,
            paddingBottom: 16,
            paddingHorizontal: 20,
          }}
        >
          <View className="flex-row items-center">
            {/* BACK */}
            <Pressable
              onPress={() => router.back()}
              className="mr-3 h-11 w-10 items-center justify-center"
              hitSlop={8}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={27}
                color={C.ink}
              />
            </Pressable>

            {/* ASTROLOGER AVATAR */}
            <View
              className="mr-3 h-[52px] w-[52px] overflow-hidden rounded-full"
              style={{
                borderWidth: 1,
                borderColor: C.gold,
                backgroundColor: C.ivory,
              }}
            >
              {astrologer?.photo ? (
                <Image
                  source={{ uri: astrologer.photo }}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                  resizeMode="cover"
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <MaterialCommunityIcons
                    name="account"
                    size={27}
                    color={C.plum}
                  />
                </View>
              )}
            </View>

            {/* NAME + ONLINE + TIMER */}
            <View className="flex-1">
              <Text
                className="text-[16px] font-semibold text-[#1C1820]"
                numberOfLines={1}
              >
                {astrologerName || "Astrologer"}
              </Text>

              <View className="mt-1 flex-row items-center">
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: astrologer?.online
                      ? C.online
                      : C.secondary,
                    marginRight: 6,
                  }}
                />

                <Text
                  className="text-[13px]"
                  style={{
                    color: astrologer?.online
                      ? C.online
                      : C.secondary,
                    fontWeight: "500",
                  }}
                >
                  {astrologer?.online ? "Online" : "Offline"}
                </Text>
              </View>

              
            </View>
          </View>
        </View>
{/* SESSION TIMER — same layout and colors as Vedic Chat */}
<View className="flex-row items-center justify-center bg-[#2B1A3D] px-4 py-2">
  <MaterialCommunityIcons
    name="clock-outline"
    size={18}
    color="#FFFFFF"
  />
  <Text className="ml-2 text-[15px] font-semibold text-white">
    Remaining time: {formatCountdown(timeLeft)}
  </Text>
</View>
        {/* CHAT */}
        <ImageBackground
          source={TAROT_CHAT_BACKGROUND}
          className="flex-1"
          resizeMode="cover"
          imageStyle={{
            width: "100%",
            height: "100%",
          }}
        >
          <ScrollView
            ref={listRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              scrollToLatest(false);
            }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 130,
            }}
          >
            <ChatWelcome type="tarot" astrologerName={astrologerName} />

            {items.map((item) => {
              /* TEXT MESSAGE */
              if (item.kind === "text") {
                const isUser = item.sender === "user";

                return (
                  <View
                    key={item.id}
                    className={`mb-4 ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    <View
                      className={`max-w-[85%] rounded-[22px] px-5 py-4 ${
                        isUser
                          ? "rounded-br-[8px] bg-[#2B1A3D]"
                          : "rounded-bl-[8px] border border-[#D9CEC1] bg-[#FFFDFC]"
                      }`}
                    >
                      {isUser ? (
                        <Text className="text-[16px] leading-6 text-[#FFFDFC]">
                          {item.text}
                        </Text>
                      ) : (
                        <View className="w-full">
                          <FormattedAssistantMessage text={item.text} />
                        </View>
                      )}
                    </View>
                  </View>
                );
              }

              /* TAROT PROMPT */
              if (item.kind === "prompt") {
                const disabled = item.used || !connected;

                return (
                  <View
                    key={item.id}
                    className="mb-4 items-start"
                  >
                    <View className="w-[70%] items-center rounded-[22px] rounded-bl-[8px] border border-[#D9CEC1] bg-[#FFFDFC] px-5 py-5">
                      {!!item.label && (
                        <Text className="mb-3 text-[12px] font-semibold uppercase tracking-[1px] text-[#68616A]">
                          {item.label}
                        </Text>
                      )}
                      <View className="flex-row" style={{ gap: 8 }}>
                        {Array.from({ length: item.count || 1 }, (_, i) => (
                          <CardBack
                            key={i}
                            width={item.count > 1 ? 64 : 96}
                            height={item.count > 1 ? 110 : 165}
                          />
                        ))}
                      </View>

                      <Pressable
                        onPress={() => openPicker(item)}
                        disabled={disabled}
                        className="mt-5 h-12 w-full items-center justify-center rounded-full"
                        style={{
                          backgroundColor: disabled
                            ? C.border
                            : C.plum,
                        }}
                      >
                        <Text
                          className="text-[16px] font-semibold"
                          style={{
                            color: disabled
                              ? C.secondary
                              : C.card,
                          }}
                        >
                          {item.used
                            ? item.count > 1
                              ? "Cards picked"
                              : "Card picked"
                            : item.count > 1
                              ? `Pick your ${item.count} cards`
                              : "Pick your card"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }

              /* REVEALED TAROT CARD */
              return (
                <View
                  key={item.id}
                  className="mb-4 items-start"
                >
                  <View className="items-center rounded-[22px] rounded-bl-[8px] border border-[#D9CEC1] bg-[#FFFDFC] px-5 py-5">
                    {item.card.image ? (
                      <Image
                        source={{ uri: item.card.image }}
                        style={{
                          width: 150,
                          height: 258,
                          borderRadius: 8,
                        }}
                        resizeMode="cover"
                      />
                    ) : (
                      <CardBack width={150} height={258} />
                    )}

                    <Text className="mt-3 text-[14px] font-semibold text-[#1C1820]">
                      {item.card.name}
                    </Text>
                    {!!item.position && (
                      <Text className="mt-0.5 text-[12px] font-medium uppercase tracking-[1px] text-[#68616A]">
                        {item.position}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}

            {/* TYPING */}
            {loading && !phase && (
              <View className="mb-4 items-start">
                <View className="rounded-[22px] rounded-bl-[8px] border border-[#D9CEC1] bg-[#FFFDFC] px-5 py-4">
                  <ActivityIndicator color={C.plum} />
                </View>

                <Text className="ml-1 mt-1 text-[11px] text-[#68616A]">
                  Typing…
                </Text>
              </View>
            )}
          </ScrollView>
        </ImageBackground>

        {/* FULL SCREEN TAROT OVERLAY */}
        {phase && (
          <View
            className="absolute inset-0 z-30"
            style={{
              backgroundColor: C.plumDeep,
            }}
          >
            <View className="px-14 pt-16">
              <Text className="text-center text-[26px] font-semibold text-[#FFFDFC]">
                {overlayTitle}
              </Text>

              <Text className="mt-1 text-center text-[15px] text-[#D9CEC1]">
                {overlaySubtitle}
              </Text>
            </View>

            {phase !== "waiting" && (
              <Pressable
                onPress={
                  phase === "ready"
                    ? finishReading
                    : () => setPhase(null)
                }
                hitSlop={12}
                className="absolute right-5 top-16 z-10"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={26}
                  color={C.card}
                />
              </Pressable>
            )}

            {/* PICK */}
            {phase === "pick" && (
              <>
                <View className="mt-10 flex-row justify-center" style={{ gap: 12 }}>
                  {Array.from({ length: needed }, (_, i) => {
                    const slotW = needed > 1 ? 92 : 130;
                    const slotH = needed > 1 ? 156 : 220;

                    return i < picked.length ? (
                      <CardBack key={i} width={slotW} height={slotH} />
                    ) : (
                      <View
                        key={i}
                        className="items-center justify-center rounded-[14px]"
                        style={{
                          width: slotW,
                          height: slotH,
                          borderWidth: 1,
                          borderStyle: "dashed",
                          borderColor: "rgba(217,206,193,0.5)",
                        }}
                      >
                        <Text className="text-[34px] text-[#D9CEC1]">{i + 1}</Text>
                      </View>
                    );
                  })}
                </View>

                <View
                  className="absolute left-0 right-0"
                  style={{
                    bottom: 100,
                    height: CARD_H + 100,
                  }}
                >
                  <Animated.ScrollView
                    ref={fanRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={STEP}
                    decelerationRate="fast"
                    scrollEventThrottle={16}
                    onLayout={() =>
                      fanRef.current?.scrollTo(
                        {
                          x: Math.floor(FAN_COUNT / 2) * STEP,
                          animated: false,
                        }
                      )
                    }
                    onScroll={Animated.event(
                      [
                        {
                          nativeEvent: {
                            contentOffset: {
                              x: scrollX,
                            },
                          },
                        },
                      ],
                      {
                        useNativeDriver: true,
                        listener: (e: any) => {
                          const i = Math.round(
                            e.nativeEvent.contentOffset.x / STEP
                          );

                          setCenter(
                            Math.max(
                              0,
                              Math.min(i, FAN_COUNT - 1)
                            )
                          );
                        },
                      }
                    )}
                    contentContainerStyle={{
                      paddingLeft: fanPad,
                      paddingRight: fanPad + CARD_W - STEP,
                      paddingTop: 20,
                    }}
                  >
                    {fanCards.map((card, i) => {
                      const at = (k: number) => (i + k) * STEP;

                      const rotate = scrollX.interpolate({
                        inputRange: [at(-4), at(0), at(4)],
                        outputRange: ["28deg", "0deg", "-28deg"],
                        extrapolate: "clamp",
                      });

                      const translateY = scrollX.interpolate({
                        inputRange: [
                          at(-4),
                          at(-2),
                          at(-1),
                          at(0),
                          at(1),
                          at(2),
                          at(4),
                        ],
                        outputRange: [64, 16, 4, 0, 4, 16, 64],
                        extrapolate: "clamp",
                      });

                      return (
                        <Animated.View
                          key={`${card.name}-${i}`}
                          style={{
                            width: CARD_W,
                            marginRight: -(CARD_W - STEP),
                            zIndex: 100 - Math.abs(i - center),
                            transform: [
                              { translateY },
                              { rotate },
                            ],
                          }}
                        >
                          <Pressable
                            onPress={() => handlePick(card, i)}
                            disabled={picked.includes(i)}
                            style={{ opacity: picked.includes(i) ? 0.2 : 1 }}
                          >
                            <CardBack
                              width={CARD_W}
                              height={CARD_H}
                            />
                          </Pressable>
                        </Animated.View>
                      );
                    })}
                  </Animated.ScrollView>

                  <Pressable
                    onPress={() => nudgeFan(-1)}
                    className="absolute left-4 h-12 w-12 items-center justify-center rounded-full"
                    style={{
                      bottom: 10,
                      backgroundColor: "rgba(255,253,252,0.14)",
                    }}
                  >
                    <MaterialCommunityIcons
                      name="chevron-left"
                      size={28}
                      color={C.card}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => nudgeFan(1)}
                    className="absolute right-4 h-12 w-12 items-center justify-center rounded-full"
                    style={{
                      bottom: 10,
                      backgroundColor: "rgba(255,253,252,0.14)",
                    }}
                  >
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={28}
                      color={C.card}
                    />
                  </Pressable>
                </View>

                <View className="absolute bottom-10 left-0 right-0 items-center">
                  <MaterialCommunityIcons
                    name="gesture-swipe-horizontal"
                    size={26}
                    color={C.border}
                  />

                  <Text className="mt-2 text-[15px] text-[#D9CEC1]">
                    Swipe to browse. Tap to pick.
                  </Text>
                </View>
              </>
            )}

            {/* WAITING */}
            {phase === "waiting" && (
              <View className="flex-1 items-center justify-center px-8">
                <View className="flex-row" style={{ gap: 10 }}>
                  {Array.from({ length: needed }, (_, i) => (
                    <CardBack
                      key={i}
                      width={needed > 1 ? 96 : 145}
                      height={needed > 1 ? 166 : 250}
                    />
                  ))}
                </View>

                <ActivityIndicator
                  className="mt-8"
                  color={C.gold}
                  size="small"
                />
              </View>
            )}

            {/* READY */}
            {phase === "ready" && revealCards.length > 0 && (
              <>
                <View className="flex-1 flex-row items-center justify-center px-3" style={{ gap: 10 }}>
                  {revealCards.map((card, i) => {
                    const w = revealCards.length === 1 ? 190 : revealCards.length === 2 ? 140 : 104;
                    const h = Math.round(w * 1.71);

                    return (
                      <View key={`${card.name}-${i}`} className="items-center" style={{ width: w }}>
                        {!!card.position && (
                          <Text className="mb-2 text-[12px] font-semibold uppercase tracking-[1px] text-[#D9CEC1]">
                            {card.position}
                          </Text>
                        )}
                        {card.image ? (
                          <Image
                            source={{ uri: card.image }}
                            style={{ width: w, height: h, borderRadius: 10 }}
                            resizeMode="cover"
                          />
                        ) : (
                          <CardBack width={w} height={h} />
                        )}
                        <Text
                          className="mt-3 text-center font-semibold text-[#FFFDFC]"
                          style={{ fontSize: revealCards.length > 2 ? 14 : 18 }}
                          numberOfLines={2}
                        >
                          {card.name}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View className="items-center px-5 pb-10">
                  <View
                    className="mb-5 rounded-full px-5 py-3"
                    style={{
                      borderWidth: 1,
                      borderColor: "rgba(217,206,193,0.5)",
                    }}
                  >
                    <Text className="text-[16px] text-[#D9CEC1]">
                      Your Tarot reading is done
                    </Text>
                  </View>

                  <Pressable
                    onPress={finishReading}
                    className="h-[54px] w-full items-center justify-center rounded-full bg-[#FFFDFC]"
                  >
                    <Text className="text-[18px] font-semibold text-[#2B1A3D]">
                      Back to chat
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}

        {/* INPUT */}
        <View
          className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-3"
          style={{
            // Keep the input above Android's navigation bar (edge-to-edge).
            paddingBottom: keyboard.open ? 12 : 16 + insets.bottom,
            backgroundColor: C.lavender,
            borderTopWidth: 1,
            borderTopColor: C.border,
          }}
        >
          <View className="flex-row items-center rounded-[26px] border border-[#D9CEC1] bg-[#FFFDFC] px-3">
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={connected ? "Type a message" : "Connecting..."}
              placeholderTextColor="#68616A"
              multiline
              textAlignVertical="center"
              editable={connected && !loading}
              className="max-h-[110px] min-h-[52px] flex-1 py-4 text-[16px] text-[#1C1820]"
            />

            <Pressable
              onPress={handleSend}
              disabled={sendDisabled}
              className="mb-1 ml-2 h-11 w-11 items-center justify-center rounded-full"
              style={{
                backgroundColor: sendDisabled ? C.border : C.plum,
              }}
            >
              <MaterialCommunityIcons
                name="arrow-up"
                size={22}
                color={C.card}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
