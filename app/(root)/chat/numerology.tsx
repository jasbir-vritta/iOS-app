import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
    router,
    useLocalSearchParams,
} from "expo-router";
import {
    useEffect,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    Image,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardInset } from "../../../components/utils/useKeyboardInset";

import ChatWelcome from "../../../components/chat/ChatWelcome";
import { track } from "../../../lib/analytics";
import { useAstrologersStore } from "../../../components/stores/astrologersStore";
import {
    applyWalletUpdate,
    refreshWalletCredits,
} from "../../../components/stores/userStore";
import {
    API_URL,
    authHeaders,
} from "../../../lib/auth";

const NUMEROLOGY_CHAT_BACKGROUND = require(
  "../../../assets/backgrounds/numerology_chat_background.png"
);

const C = {
  ink: "#1C1820",
  plum: "#2B1A3D",
  gold: "#C49A4A",
  ivory: "#F7F1E8",
  secondary: "#68616A",
  online: "#5C8A4A",
  border: "#D9CEC1",
} as const;

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
          return (
            <View
              key={index}
              style={{ height: 8 }}
            />
          );
        }

        const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);

        if (bulletMatch) {
          return (
            <View
              key={index}
              className="mb-1 flex-row"
            >
              <Text className="mr-2 text-[16px] leading-6 text-[#2D2633]">
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
            <View
              key={index}
              className="mb-1 flex-row"
            >
              <Text className="mr-2 text-[16px] leading-6 text-[#2D2633]">
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
              className="mb-2 mt-1 text-[18px] font-bold leading-6 text-[#2D2633]"
            >
              {headingMatch[1]}
            </Text>
          );
        }

        return (
          <View
            key={index}
            className="mb-2"
          >
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
  const parts = text.split(
    /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  );

  return (
    <Text className="text-[16px] leading-6 text-[#2D2633]">
      {parts.map((part, index) => {
        if (
          part.startsWith("**") &&
          part.endsWith("**")
        ) {
          return (
            <Text
              key={index}
              className="font-bold text-[#2D2633]"
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
            <Text
              key={index}
              className="italic text-[#2D2633]"
            >
              {part.slice(1, -1)}
            </Text>
          );
        }

        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
}

type Message = {
  id: string;
  text: string;
  sender: "user" | "assistant";
};

const splitAssistantText = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

export default function NumerologyChat() {
  const insets = useSafeAreaInsets();
  // Keeps the input above the keyboard on Android (edge-to-edge).
  const keyboard = useKeyboardInset();
  const {
    sessionId,
    astrologerId,
    readingType,
    profileId,
    astrologerName,
    walletBalance,
    ratePerMinute,
    remainingTimeSeconds,
  } = useLocalSearchParams<{
    sessionId: string;
    astrologerId: string;
    readingType: string;
    profileId: string;
    astrologerName: string;
    walletBalance?: string;
    ratePerMinute?: string;
    remainingTimeSeconds?: string;
  }>();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);

  // Prefer backend remaining time; use wallet/rate as a fallback.
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

  const listRef = useRef<ScrollView>(null);

  const { astrologers } = useAstrologersStore();

  const astrologer = astrologers.find(
    (item) => item.astrologer_id === astrologerId
  );

  const scrollToBottom = (
    animated: boolean = true
  ) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        listRef.current?.scrollToEnd({
          animated,
        });
      }, 100);
    });
  };

  // Load existing conversation.
  useEffect(() => {
    if (!sessionId || !profileId) {
      setLoadingMessages(false);
      return;
    }

    let mounted = true;

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);

        console.log(
          "Loading numerology chat session:",
          sessionId
        );

        const headers = await authHeaders();

        const response = await fetch(
          `${API_URL}/chat/session/${sessionId}/messages?profile_id=${encodeURIComponent(
            profileId
          )}`,
          {
            method: "GET",
            headers,
          }
        );

        const data = await response.json();

        console.log(
          "Previous numerology messages response:",
          data
        );

        if (!response.ok) {
          throw new Error(
            data?.detail || "Failed to load chat messages"
          );
        }

        if (!mounted) {
          return;
        }

        const loadedMessages: Message[] = (
          data?.messages || []
        ).flatMap((item: any, index: number) => {
          const sender =
            item.sender_type === "user" ||
            item.sender === "user"
              ? "user"
              : "assistant";

          const parts =
            sender === "assistant"
              ? splitAssistantText(item.message || "")
              : [item.message || ""];

          return parts.map(
            (part: string, partIndex: number) => ({
              id: `${
                item.message_id ||
                `${item.created_at || Date.now()}-${index}`
              }-${partIndex}`,
              text: part,
              sender,
            })
          );
        });

        setMessages(loadedMessages);

        requestAnimationFrame(() => {
          setTimeout(() => {
            if (mounted) {
              listRef.current?.scrollToEnd({
                animated: false,
              });
            }
          }, 100);
        });
      } catch (error) {
        console.error(
          "Failed to load numerology chat messages:",
          error
        );
      } finally {
        if (mounted) {
          setLoadingMessages(false);
        }
      }
    };

    loadMessages();

    return () => {
      mounted = false;
    };
  }, [sessionId, profileId]);

  useEffect(() => {
    if (loadingMessages) {
      return;
    }

    scrollToBottom(true);
  }, [messages, loadingMessages]);

  // Messages go over the WebSocket so the backend bills the
  // consultation and closes it when credits run out.
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [creditsExhausted, setCreditsExhausted] = useState(false);

  const addAssistantText = (text: string) => {
    setMessages((prev) => [
      ...prev,
      ...splitAssistantText(text).map(
        (part: string, index: number) => ({
          id: `${Date.now()}-assistant-${index}`,
          text: part,
          sender: "assistant" as const,
        })
      ),
    ]);

    scrollToBottom(true);
  };

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;

    const connect = async () => {
      try {
        const headers =
          (await authHeaders()) as Record<string, string>;

        const token = (
          headers.Authorization ||
          headers.authorization ||
          ""
        ).replace(/^Bearer\s+/i, "");

        if (!token || cancelled) {
          return;
        }

        socket = new WebSocket(
          `${API_URL.replace(/^http/, "ws")}/chat/session/${sessionId}/ws` +
            `?token=${encodeURIComponent(token)}`
        );

        socketRef.current = socket;

        socket.onopen = () => {
          if (!cancelled) {
            setConnected(true);
            track("chat_started", { chat_type: "ai", reading_type: "numerology", astrologer_id: astrologerId });
          }
        };

        socket.onmessage = (event) => {
          let payload: any;

          try {
            payload = JSON.parse(event.data);
          } catch {
            // Heartbeat "pong" and other plain text.
            return;
          }

          if (applyWalletUpdate(payload)) return;

          if (
            payload?.type === "insufficient_credits" ||
            payload?.type === "credits_exhausted"
          ) {
            setCreditsExhausted(true);
            setTimeLeft(0);
            setLoading(false);
            addAssistantText(
              payload.message ||
                "Your credits have been exhausted. Please add credits to continue."
            );
            return;
          }

          // The reply arrives message by message while it's written.
          if (payload?.type === "message_part") {
            if (typeof payload.text === "string" && payload.text.trim()) {
              addAssistantText(payload.text);
            }
            return;
          }

          if (payload?.success === false) {
            setLoading(false);
            addAssistantText(
              "Sorry, I couldn't connect to the astrology service. Please try again."
            );
            return;
          }

          // Already shown message by message: just stop the typing indicator.
          if (payload?.streamed) {
            setLoading(false);
            return;
          }

          const responseText =
            payload?.assistant_message ??
            payload?.response ??
            payload?.message;

          if (
            typeof responseText === "string" &&
            payload?.sender !== "user"
          ) {
            setLoading(false);
            addAssistantText(responseText);
          }
        };

        socket.onerror = () => {
          console.error("Numerology chat connection error");
        };

        socket.onclose = () => {
          socketRef.current = null;

          // The server makes the chat's last charge after the disconnect.
          setTimeout(refreshWalletCredits, 1500);

          if (!cancelled) {
            setConnected(false);
            setLoading(false);
          }
        };
      } catch (error) {
        console.error(
          "Could not connect to numerology chat:",
          error
        );
      }
    };

    connect();

    return () => {
      cancelled = true;
      socket?.close();
      socketRef.current = null;
    };
  }, [sessionId]);

  const canSend =
    connected &&
    !creditsExhausted &&
    !loading &&
    !loadingMessages;

  const handleSend = () => {
    const question = message.trim();

    if (!question || !canSend) {
      return;
    }

    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      addAssistantText(
        "The consultation is not connected. Please reopen the chat."
      );
      return;
    }

    setLoading(true);

    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-user`,
        text: question,
        sender: "user",
      },
    ]);

    setMessage("");
    scrollToBottom(true);

    socket.send(
      JSON.stringify({
        type: "message",
        message: question,
      })
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F5F1FA]"
      style={{ flex: 1, paddingBottom: keyboard.padding }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      onLayout={keyboard.onLayout}
    >
      <View className="flex-1 bg-[#F5F1FA]">
        {/* HEADER */}
        <View
          className="border-b border-[#D9CEC1] bg-[#FFFDFC]"
          style={{
            paddingTop: 52,
            paddingBottom: 16,
            paddingHorizontal: 20,
          }}
        >
          <View className="flex-row items-center">
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
      {/* SESSION TIMER — same UI as Vedic Chat */}
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
        {/* CHAT AREA */}
        <ImageBackground
          source={NUMEROLOGY_CHAT_BACKGROUND}
          className="flex-1"
          resizeMode="cover"
          imageStyle={{
            width: "100%",
            height: "100%",
          }}
        >
          {loadingMessages ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator
                size="small"
                color="#6D4C8D"
              />

              <Text className="mt-3 text-[14px] text-[#756B7D]">
                Loading your conversation...
              </Text>
            </View>
          ) : (
            <ScrollView
              ref={listRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 18,
                paddingBottom: 120,
              }}
              keyboardShouldPersistTaps="handled"
            >
              {/* WELCOME */}
              <ChatWelcome
                type="numerology"
                astrologerName={astrologerName}
                bubbleColor="#FFFEFF"
                borderColor="#DDD3E5"
              />

              {/* MESSAGES */}
              {messages.map((item) => (
                <View
                  key={item.id}
                  className={`mb-4 ${
                    item.sender === "user"
                      ? "items-end"
                      : "items-start"
                  }`}
                >
                  <View
                    className={`max-w-[86%] px-5 py-4 ${
                      item.sender === "user"
                        ? "rounded-[22px] rounded-br-[7px] bg-[#6D4C8D]"
                        : "rounded-[22px] rounded-bl-[7px] border border-[#DDD3E5] bg-[#FFFEFF]"
                    }`}
                  >
                    {item.sender === "user" ? (
                      <Text className="text-[16px] leading-6 text-[#FFFFFF]">
                        {item.text}
                      </Text>
                    ) : (
                      <FormattedAssistantMessage
                        text={item.text}
                      />
                    )}
                  </View>
                </View>
              ))}

              {/* THINKING */}
              {loading && (
                <View className="mb-4 items-start">
                  <View className="rounded-[22px] rounded-bl-[7px] border border-[#DDD3E5] bg-[#FFFEFF] px-5 py-4">
                    <View className="flex-row items-center">
                      <ActivityIndicator
                        size="small"
                        color="#6D4C8D"
                      />

                      <Text className="ml-3 text-[14px] text-[#756B7D]">
                        Typing...
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </ImageBackground>

        {/* INPUT */}
        <View className="border-t border-[#DDD3E5] bg-[#FFFEFF] px-4 pb-5 pt-3"
            // Keep the input above Android's navigation bar (edge-to-edge).
            style={{ paddingBottom: keyboard.open ? 12 : 20 + insets.bottom }}>
          <View className="flex-row items-center rounded-[26px] border border-[#DDD3E5] bg-[#FFFEFF] px-4 py-1">
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={
                creditsExhausted
                  ? "Add credits to continue"
                  : connected
                    ? "Ask your question..."
                    : "Connecting..."
              }
              placeholderTextColor="#756B7D"
              multiline
              editable={canSend}
              textAlignVertical="center"
              className="max-h-[120px] min-h-[52px] flex-1 py-4 text-[16px] text-[#2D2633]"
            />

            <Pressable
              onPress={handleSend}
              disabled={
                !canSend ||
                !message.trim()
              }
              className="ml-2 h-11 w-11 items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  !canSend ||
                  !message.trim()
                    ? "#DDD3E5"
                    : "#6D4C8D",
              }}
            >
              <MaterialCommunityIcons
                name="arrow-up"
                size={22}
                color={
                  !canSend ||
                  !message.trim()
                    ? "#756B7D"
                    : "#FFFFFF"
                }
              />
            </Pressable>
          </View>

          <Text className="mt-2 text-center text-[11px] text-[#756B7D]">
            Astrology guidance is for informational purposes.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}