import { translate } from "../../lib/i18n";
import { APP_NAME } from "./app";

export type ChatWelcomeType = "vedic" | "numerology" | "tarot";

interface ChatWelcomeContent {
  messages: string[];
  note: string;
}

// Shown at the top of every chat, before the conversation.
// `name` is the astrologer's name. Built on each call so the text follows
// the app language.
export const CHAT_WELCOME: Record<
  ChatWelcomeType,
  (name: string) => ChatWelcomeContent
> = {
  vedic: (name) => ({
    messages: [
      translate("chat.welcome.title", { app: APP_NAME }),
      translate("chat.welcome.looking", { name }),
      translate("chat.welcome.language"),
      translate("chat.welcome.vedicTip"),
    ],
    note: translate("chat.welcome.vedicNote", { name }),
  }),

  numerology: (name) => ({
    messages: [
      translate("chat.welcome.title", { app: APP_NAME }),
      translate("chat.welcome.looking", { name }),
      translate("chat.welcome.language"),
      translate("chat.welcome.numerologyTip"),
    ],
    note: translate("chat.welcome.numerologyNote", { name }),
  }),

  tarot: (name) => ({
    messages: [
      translate("chat.welcome.title", { app: APP_NAME }),
      translate("chat.welcome.looking", { name }),
      translate("chat.welcome.language"),
      translate("chat.welcome.tarotTip"),
    ],
    note: translate("chat.welcome.tarotNote", { name }),
  }),
};
