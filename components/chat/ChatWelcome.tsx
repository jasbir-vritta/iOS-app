import { Text, View } from "react-native";

import {
  CHAT_WELCOME,
  ChatWelcomeType,
} from "../constants/chatWelcome";

export default function ChatWelcome({
  type,
  astrologerName,
  bubbleColor = "#FFFDFC",
  borderColor = "#D9CEC1",
}: {
  type: ChatWelcomeType;
  astrologerName?: string;
  bubbleColor?: string;
  borderColor?: string;
}) {
  const { messages, note } = CHAT_WELCOME[type](
    astrologerName?.trim() || "Your astrologer"
  );

  return (
    <View className="mb-4">
      {messages.map((message, index) => (
        <View key={index} className="mb-2 items-start">
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
        </View>
      ))}

      <View className="mx-6 mt-3 rounded-[16px] bg-[#DCE5CF]/90 px-4 py-3">
        <Text className="text-center text-[13px] leading-[18px] text-[#3D4A35]">
          {note}
        </Text>
      </View>
    </View>
  );
}
