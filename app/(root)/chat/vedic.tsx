
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
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardInset } from "../../../components/utils/useKeyboardInset";

import ChatWelcome from "../../../components/chat/ChatWelcome";
import { track, useChatTracking } from "../../../lib/analytics";
import { useAstrologersStore } from "../../../components/stores/astrologersStore";
import {
  applyWalletUpdate,
  refreshWalletCredits,
} from "../../../components/stores/userStore";
import { API_URL, authHeaders } from "../../../lib/auth";

type Message = {
  id: string;
  text: string;
  sender: "user" | "assistant";
};

const VEDIC_CHAT_BACKGROUND = require(
  "../../../assets/backgrounds/vedic_chat_background.png"
);

const C = {
  ink: "#1C1820",
  plum: "#2B1A3D",
  gold: "#C49A4A",
  ivory: "#F7F1E8",
  secondary: "#68616A",
  online: "#5C8A4A",
  border: "#D9CEC1",
  green: "#26784B",
} as const;

const splitAssistantText = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);


const formatRemainingTime = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.floor(totalSeconds));

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(
      minutes
    ).padStart(2, "0")}:${String(remainingSeconds).padStart(
      2,
      "0"
    )}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
};

export default function VedicChat() {
  const insets = useSafeAreaInsets();
  // Keeps the input above the keyboard on Android (edge-to-edge).
  const keyboard = useKeyboardInset();
  const {
    sessionId,
    astrologerId,
    readingType,
    profileId,
    astrologerName,
    chatMode,
    walletBalance,
    ratePerMinute,
    remainingTimeSeconds,
  } = useLocalSearchParams<{
    sessionId: string;
    astrologerId: string;
    readingType: string;
    profileId: string;
    astrologerName: string;
    chatMode?: string;
    walletBalance?: string;
    ratePerMinute?: string;
    remainingTimeSeconds?: string;
  }>();

  // Analytics: chat_started_<astrologer> + chat_<astrologer>_time_spent.
  useChatTracking({ astrologerName, astrologerId, readingType: readingType || "vedic", sessionId, chatType: "ai" });


  
  const walletAmount = Math.max(0, Number(walletBalance) || 0);
  const astrologerRate = Math.max(0, Number(ratePerMinute) || 0);

  
const parsedRemainingSeconds = Number(remainingTimeSeconds);

const hasValidRemainingTime =
  remainingTimeSeconds != null &&
  remainingTimeSeconds.trim() !== "" &&
  Number.isFinite(parsedRemainingSeconds) &&
  parsedRemainingSeconds > 0;

const initialSeconds = hasValidRemainingTime
  ? Math.floor(parsedRemainingSeconds)
  : astrologerRate > 0
    ? Math.floor((walletAmount / astrologerRate) * 60)
    : 0;

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);

  // Active only while the WebSocket is open.
  const [chatActive, setChatActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [walletExhausted, setWalletExhausted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);

  const listRef = useRef<ScrollView>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const endedRef = useRef(false);

  const { astrologers } = useAstrologersStore();

  const astrologer = astrologers.find(
    (item) => item.astrologer_id === astrologerId
  );

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated });
      }, 100);
    });
  }, []);

  // Load existing messages over HTTP. This does not open a WebSocket.
  useEffect(() => {
    if (!sessionId || !profileId) {
      setLoadingMessages(false);
      return;
    }

    let mounted = true;

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);

        const response = await fetch(
          `${API_URL}/chat/session/${sessionId}/messages?profile_id=${encodeURIComponent(profileId)}`,
          {
            method: "GET",
            headers: await authHeaders(),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail || "Failed to load chat messages"
          );
        }

        if (!mounted) return;

        const loadedMessages: Message[] = (
          data?.messages || []
        ).flatMap((item: any, index: number) => {
          const sender =
            item.sender_type === "user" || item.sender === "user"
              ? "user"
              : "assistant";

          const originalText = item.message || "";
          const parts =
            sender === "assistant"
              ? splitAssistantText(originalText)
              : [originalText];

          return parts.map((part: string, partIndex: number) => ({
            id: `${item.message_id || item.created_at || index}-${partIndex}`,
            text: part,
            sender,
          }));
        });

        setMessages(loadedMessages);

        requestAnimationFrame(() => {
          setTimeout(() => {
            if (mounted) {
              listRef.current?.scrollToEnd({ animated: false });
            }
          }, 100);
        });
      } catch (error) {
        console.error("Failed to load Vedic chat history:", error);

        if (mounted) {
          Alert.alert(
            "Unable to load conversation",
            "Please try reopening this conversation."
          );
        }
      } finally {
        if (mounted) setLoadingMessages(false);
      }
    };

    loadMessages();

    return () => {
      mounted = false;
    };
  }, [sessionId, profileId]);

  useEffect(() => {
    if (!loadingMessages) scrollToBottom(true);
  }, [messages, loadingMessages, scrollToBottom]);

  // The countdown runs only during an active consultation.
  useEffect(() => {
    if (!chatActive || walletExhausted || !sessionId) return;

    const timer = setInterval(() => {
      setRemainingSeconds((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [chatActive, walletExhausted, sessionId]);

  useEffect(() => {
    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  const handleEndConsultation = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(root)/(tabs)/home" as never);
    }
  }, []);

  const addAssistantText = useCallback(
    (text: string) => {
      setMessages((previous) => [
        ...previous,
        ...splitAssistantText(text).map((part, index) => ({
          id: `${Date.now()}-assistant-${index}`,
          text: part,
          sender: "assistant" as const,
        })),
      ]);
    },
    []
  );

  // Every consultation (new or resumed) runs over the WebSocket, so the
  // backend bills it and closes it when credits run out.
  const handleContinueChat = async () => {
    if (!sessionId || connecting || chatActive || walletExhausted) {
      return;
    }

    try {
      setConnecting(true);

      const headers = await authHeaders();
      const auth = headers as Record<string, string>;
      const authorization =
        auth.Authorization || auth.authorization || "";

      const token = authorization.replace(/^Bearer\s+/i, "");

      if (!token) {
        throw new Error("Access token unavailable for WebSocket.");
      }

      const socketUrl =
        `${API_URL.replace(/^http/, "ws")}/chat/session/${sessionId}/ws` +
        `?token=${encodeURIComponent(token)}`;

      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnecting(false);
        setChatActive(true);
        track("chat_started", { chat_type: "ai", reading_type: readingType || "vedic", astrologer_id: astrologerId });
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

        // Vedic: the reply arrives message by message while it's written.
        // "typing…" stays on until the final reply below.
        if (payload?.type === "message_part") {
          if (typeof payload.text === "string" && payload.text.trim()) {
            addAssistantText(payload.text);
          }
          return;
        }

        if (
          payload?.type === "insufficient_credits" ||
          payload?.type === "credits_exhausted" ||
          (payload?.type === "session_ended" &&
            payload?.reason === "insufficient_balance")
        ) {
          endedRef.current = true;
          setWalletExhausted(true);
          setChatActive(false);
          setRemainingSeconds(0);
          setLoading(false);

          socket.close();
          socketRef.current = null;
          return;
        }

        if (payload?.type === "session_ended") {
          endedRef.current = true;
          setChatActive(false);
          setLoading(false);

          socket.close();
          socketRef.current = null;
          return;
        }

        if (payload?.success === false || payload?.type === "error") {
          setLoading(false);
          addAssistantText("I couldn't get a response right now.");
          return;
        }

        // Already shown message by message: just end "typing…".
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
        setConnecting(false);
        setLoading(false);
        Alert.alert(
          "Connection error",
          "Could not connect to the consultation. Please try again."
        );
      };

      socket.onclose = () => {
        socketRef.current = null;
        setConnecting(false);
        setLoading(false);

        // The server makes the chat's last charge after the disconnect.
        setTimeout(refreshWalletCredits, 1500);

        // A disconnect alone does not mean the wallet is exhausted.
        if (!endedRef.current) {
          setChatActive(false);
        }
      };
    } catch (error) {
      console.error("Could not connect to Vedic chat:", error);
      setConnecting(false);

      Alert.alert(
        "Unable to continue",
        error instanceof Error ? error.message : "Please try again."
      );
    }
  };

  // Connect once the conversation history has loaded.
  const autoConnectedRef = useRef(false);

  useEffect(() => {
    if (loadingMessages || autoConnectedRef.current) return;

    autoConnectedRef.current = true;
    handleContinueChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMessages]);

  const handleSend = () => {
    const question = message.trim();

    if (
      !question ||
      loading ||
      loadingMessages ||
      !chatActive ||
      walletExhausted
    ) {
      return;
    }

    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      Alert.alert(
        "Not connected",
        "The consultation connection is not active."
      );
      return;
    }

    setLoading(true);

    setMessages((previous) => [
      ...previous,
      {
        id: `${Date.now()}-user`,
        text: question,
        sender: "user",
      },
    ]);

    setMessage("");
    scrollToBottom(true);

    // The reply arrives in socket.onmessage, which clears `loading`.
    socket.send(
      JSON.stringify({
        type: "message",
        message: question,
      })
    );
  };

  // FIX: Do not show time for an old chat until it is active.
  const showRemainingTime = chatActive && !walletExhausted;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F5F1FA]"
      style={{ flex: 1, paddingBottom: keyboard.padding }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      onLayout={keyboard.onLayout}
    >
      <View className="flex-1 bg-[#F5F1FA]">
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
              onPress={handleEndConsultation}
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
                  style={{ width: "100%", height: "100%" }}
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
                    color: astrologer?.online ? C.online : C.secondary,
                    fontWeight: "500",
                  }}
                >
                  {astrologer?.online ? "Online" : "Offline"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {showRemainingTime && (
          <View className="flex-row items-center justify-center bg-[#2B1A3D] px-4 py-2">
            <MaterialCommunityIcons
              name="clock-outline"
              size={18}
              color="#FFFFFF"
            />
            <Text className="ml-2 text-[15px] font-semibold text-white">
              Remaining time: {formatRemainingTime(remainingSeconds)}
            </Text>
          </View>
        )}

        <ImageBackground
          source={VEDIC_CHAT_BACKGROUND}
          className="flex-1"
          imageStyle={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        >
          {loadingMessages ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="small" color={C.plum} />
              <Text className="mt-3 text-[14px] text-[#68616A]">
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
                paddingBottom: 24,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <ChatWelcome type="vedic" astrologerName={astrologerName} fresh={messages.length === 0} />

              {messages.map((item) => (
                <View
                  key={item.id}
                  className={`mb-4 ${
                    item.sender === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <View
                    className={`max-w-[86%] px-5 py-4 ${
                      item.sender === "user"
                        ? "rounded-[22px] rounded-br-[7px] bg-[#2B1A3D]"
                        : "rounded-[22px] rounded-bl-[7px] border border-[#D9CEC1] bg-[#FFFDFC]"
                    }`}
                  >
                    <Text
                      className={`text-[16px] leading-6 ${
                        item.sender === "user"
                          ? "text-[#FFFDFC]"
                          : "text-[#1C1820]"
                      }`}
                    >
                      {item.text}
                    </Text>
                  </View>
                </View>
              ))}

              {loading && (
                <View className="mb-4 items-start">
                  <View className="rounded-[22px] rounded-bl-[7px] border border-[#D9CEC1] bg-[#FFFDFC] px-5 py-4">
                    <View className="flex-row items-center">
                      <ActivityIndicator size="small" color={C.plum} />
                      <Text className="ml-3 text-[14px] text-[#68616A]">
                        Typing...
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </ImageBackground>

        {walletExhausted ? (
          <View className="border-t border-[#D9CEC1] bg-[#FFFDFC] px-5 pb-7 pt-5">
            <View className="items-center">
              <MaterialCommunityIcons
                name="wallet-outline"
                size={34}
                color={C.gold}
              />

              <Text className="mt-3 text-center text-[21px] font-bold text-[#1C1820]">
                Consultation time ended
              </Text>

              <Text className="mt-2 text-center text-[14px] leading-5 text-[#68616A]">
                Your available consultation time has run out. Recharge your wallet to start another consultation.
              </Text>

              <Pressable
                onPress={() =>
                  router.push("/profile/wallet")
                }
                className="mt-5 w-full items-center rounded-2xl bg-[#26784B] px-4 py-4"
              >
                <Text className="text-[16px] font-bold text-white">
                  Recharge Wallet
                </Text>
              </Pressable>

              <Pressable
                onPress={handleEndConsultation}
                className="mt-3 w-full items-center rounded-2xl border border-[#D9CEC1] px-4 py-3"
              >
                <Text className="text-[15px] font-semibold text-[#2B1A3D]">
                  End Consultation
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="border-t border-[#DDD3E5] bg-[#FFFEFF] px-4 pb-5 pt-3"
            // Keep the input above Android's navigation bar (edge-to-edge).
            style={{ paddingBottom: keyboard.open ? 12 : 20 + insets.bottom }}>
            <View className="flex-row items-center rounded-[26px] border border-[#DDD3E5] bg-[#FFFEFF] px-4 py-1">
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder={chatActive ? "Ask your question..." : "Connecting..."}
                placeholderTextColor="#756B7D"
                multiline
                editable={
                  chatActive &&
                  !loading &&
                  !loadingMessages &&
                  !walletExhausted
                }
                textAlignVertical="center"
                className="max-h-[120px] min-h-[52px] flex-1 py-4 text-[16px] text-[#2D2633]"
              />

              <Pressable
                onPress={handleSend}
                disabled={
                  !chatActive ||
                  loading ||
                  loadingMessages ||
                  !message.trim() ||
                  walletExhausted
                }
                className="ml-2 h-11 w-11 items-center justify-center rounded-full"
                style={{
                  backgroundColor:
                    !chatActive ||
                    loading ||
                    loadingMessages ||
                    !message.trim() ||
                    walletExhausted
                      ? "#DDD3E5"
                      : "#6D4C8D",
                }}
              >
                <MaterialCommunityIcons
                  name="arrow-up"
                  size={22}
                  color={
                    !chatActive ||
                    loading ||
                    loadingMessages ||
                    !message.trim() ||
                    walletExhausted
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
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
