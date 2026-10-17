import { router } from "expo-router";
import { Alert } from "react-native";

import { translate } from "../../lib/i18n";

// Minimum wallet balance to start a chat, in minutes of the
// astrologer's per-minute price.
export const MIN_CHAT_MINUTES = 1;

export const minChatCredits = (pricePerMinute: number) =>
  Math.ceil(Math.max(0, Number(pricePerMinute) || 0) * MIN_CHAT_MINUTES);

/**
 * Returns true when the wallet covers the minimum for this astrologer.
 * Otherwise explains the minimum and offers to open the wallet.
 */
export const ensureChatCredits = (
  walletCredits: number,
  pricePerMinute: number,
  freeMinuteAvailable = false
): boolean => {
  // First-ever chat: the first minute is free, so no minimum applies.
  if (freeMinuteAvailable) {
    return true;
  }

  const required = minChatCredits(pricePerMinute);
  const balance = Math.floor(Number(walletCredits) || 0);

  if (balance >= required) {
    return true;
  }

  Alert.alert(
    translate("chat.credits.title"),
    translate(MIN_CHAT_MINUTES === 1 ? "chat.credits.messageOne" : "chat.credits.messageMany", {
      required,
      minutes: MIN_CHAT_MINUTES,
      balance,
    }),
    [
      { text: translate("common.cancel"), style: "cancel" },
      {
        text: translate("chat.credits.add"),
        onPress: () => router.push("/profile/wallet"),
      },
    ]
  );

  return false;
};
