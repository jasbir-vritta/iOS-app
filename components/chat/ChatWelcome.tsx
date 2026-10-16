import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Reanimated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import {
  CHAT_WELCOME,
  ChatWelcomeType,
} from "../constants/chatWelcome";

// A fresh chat waits this long ("typing…") before the welcome appears.
const FRESH_DELAY_MS = 2000;

export default function ChatWelcome({
  type,
  astrologerName,
  bubbleColor = "#FFFDFC",
  borderColor = "#D9CEC1",
  fresh = false,
}: {
  type: ChatWelcomeType;
  astrologerName?: string;
  bubbleColor?: string;
  borderColor?: string;
  // No messages yet: show "typing…" first, then the welcome one by one.
  // Old chats show it straight away.
  fresh?: boolean;
}) {
  const name = astrologerName?.trim() || "Your astrologer";
  const { messages, note } = CHAT_WELCOME[type](name);

  const [waited, setWaited] = useState(false);

  useEffect(() => {
    if (!fresh) return;
    const timer = setTimeout(() => setWaited(true), FRESH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [fresh]);

  // Old chat (or history arrived meanwhile): no wait.
  const show = !fresh || waited;
  // Animate in only after the wait on a fresh chat.
  const animate = fresh && waited;

  if (!show) {
    return (
      <View className="mb-4 items-start">
        <Reanimated.View
          entering={FadeIn.duration(250)}
          className="flex-row items-center rounded-[18px] px-4 py-3"
          style={{ backgroundColor: bubbleColor, borderColor, borderWidth: 1 }}
        >
          <TypingDots />
          <Text className="ml-2 text-[13px] text-[#68616A]">{name} is typing…</Text>
        </Reanimated.View>
      </View>
    );
  }

  return (
    <View className="mb-4">
      {messages.map((message, index) => (
        <Reanimated.View
          key={index}
          entering={animate ? FadeInDown.delay(index * 450).duration(350) : undefined}
          className="mb-2 items-start"
        >
          <View
            className="max-w-[78%] rounded-[18px] px-4 py-3"
            style={{
              backgroundColor: bubbleColor,
              borderColor,
              borderWidth: 1,
            }}
          >
            <Text className="text-[15px] leading-5 text-[#1C1820]">
              {message}
            </Text>
          </View>
        </Reanimated.View>
      ))}

      <Reanimated.View
        entering={animate ? FadeIn.delay(messages.length * 450).duration(400) : undefined}
        className="mx-6 mt-3 rounded-[16px] bg-[#DCE5CF]/90 px-4 py-3"
      >
        <Text className="text-center text-[13px] leading-[18px] text-[#3D4A35]">
          {note}
        </Text>
      </Reanimated.View>
    </View>
  );
}

/* Three dots bouncing one after another. */
function TypingDots() {
  return (
    <View className="flex-row items-center" style={{ gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 160} />
      ))}
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(-4, { duration: 260 }), withTiming(0, { duration: 260 })),
        -1
      )
    );
  }, [delay, lift]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));

  return (
    <Reanimated.View
      style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#2B1A3D", opacity: 0.6 }, style]}
    />
  );
}
