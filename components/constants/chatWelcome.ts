import { APP_NAME } from "./app";

export type ChatWelcomeType = "vedic" | "numerology" | "tarot";

interface ChatWelcomeContent {
  messages: string[];
  note: string;
}

const LANGUAGE_MESSAGE =
  "You can ask your question in English, Hindi, or any language you're comfortable with.";

// Shown at the top of every chat, before the conversation.
// `name` is the astrologer's name.
export const CHAT_WELCOME: Record<
  ChatWelcomeType,
  (name: string) => ChatWelcomeContent
> = {
  vedic: (name) => ({
    messages: [
      `Welcome to ${APP_NAME}.`,
      `${name} is looking at your details.`,
      LANGUAGE_MESSAGE,
      "For a better answer, please share a few details with your question, like what's happening and since when.",
    ],
    note: `Welcome! Your chat has started. ${name} is checking your details. You can ask your question now.`,
  }),

  numerology: (name) => ({
    messages: [
      `Welcome to ${APP_NAME}.`,
      `${name} is looking at your details.`,
      LANGUAGE_MESSAGE,
      "For a better answer, please share a few details with your question. You can ask about your career, relationships, a lucky date, or a name change.",
    ],
    note: `Welcome! Your chat has started. ${name} is checking your numbers. You can ask your question now.`,
  }),

  tarot: (name) => ({
    messages: [
      `Welcome to ${APP_NAME}.`,
      `${name} is looking at your details.`,
      LANGUAGE_MESSAGE,
      "Focus on one clear question. When asked, pick a card and your reading will begin.",
    ],
    note: `Welcome! Your chat has started. ${name} is preparing your reading. You can ask your question now.`,
  }),
};
