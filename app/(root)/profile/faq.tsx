import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "../../../components/ui/BrandText";

const SUPPORT_EMAIL = "support@vritta.app";

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  GOLD: "#C49A4A",
  LAVENDER: "#F4F0F8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  LINE: "rgba(217,206,193,0.7)",
  SOFT: "#EFE8F7",
};

type Faq = { q: string; a: string };
type Category = { id: string; title: string; icon: React.ComponentProps<typeof Icon>["name"]; items: Faq[] };

const CATEGORIES: Category[] = [
  {
    id: "start",
    title: "Getting started",
    icon: "star-four-points-outline",
    items: [
      {
        q: "What is Vritta?",
        a: "Vritta is an astrology and spiritual guidance app. You can chat with astrologers about love, marriage, career, money and personal growth, read your daily guidance, chant mantras, and buy detailed reports, all based on your birth details.",
      },
      {
        q: "Which kinds of readings are available?",
        a: "Vedic astrology, KP (Krishnamurti Paddhati), Lal Kitab, Tarot and Numerology. Each astrologer's card shows what they offer. When an astrologer offers more than one, you choose the reading when you start the chat.",
      },
      {
        q: "Are the astrologers AI or real people?",
        a: "Both. Most astrologers on Vritta are AI astrologers, each with their own style, available any time. Verified human astrologers are also available when they are online; their cards are marked and they reply to you live.",
      },
      {
        q: "Do I need my exact birth time?",
        a: "Yes, for Vedic, KP and Lal Kitab readings the exact time matters, because it decides the ascendant (lagna) and houses. If you don't know it, give the closest time you can. Tarot and Numerology need less detail.",
      },
    ],
  },
  {
    id: "chats",
    title: "Chats",
    icon: "chat-processing-outline",
    items: [
      {
        q: "How much does a chat cost?",
        a: "Each astrologer has a price per minute, shown on their card. The amount is taken from your wallet while you chat, and you can end the chat at any time. Your very first chat minute on Vritta is free.",
      },
      {
        q: "Can I chat in my own language?",
        a: "Yes. Write in English, Hindi or any language you're comfortable with, and the astrologer replies in the same language.",
      },
      {
        q: "Where can I see my old chats?",
        a: "Go to Profile → Chat history. Chats are saved per profile, so switch profiles to see chats about a loved one. Tap any chat to continue it.",
      },
      {
        q: "How accurate are the readings?",
        a: "Readings follow traditional astrology, Tarot and Numerology methods applied to your details. They are meant to help you reflect and consider your options, not to guarantee what will happen. For health, legal or financial decisions, please also consult a qualified professional.",
      },
    ],
  },
  {
    id: "reports",
    title: "Kundli & reports",
    icon: "file-document-outline",
    items: [
      {
        q: "What reports can I buy?",
        a: "The Reports tab has detailed PDF reports: True Love, Marriage, Career, Finance, Health, Future, Past Life, Baby (Bal Jyotish), Foreign Travel & Settlement, and Kundli Matching for couples. Each report page shows its price, what's inside and a sample.",
      },
      {
        q: "Which languages are reports available in?",
        a: "English, Hindi, Bengali, Marathi, Tamil, Telugu, Malayalam and Kannada. You choose the language before buying.",
      },
      {
        q: "Where do I find a report I bought?",
        a: "In the Reports tab under My Reports. Reports belong to the profile they were bought for, so switch profiles to see a loved one's reports.",
      },
      {
        q: "What if a report can't be prepared?",
        a: "If we can't prepare your report, the full amount is returned to your wallet automatically.",
      },
      {
        q: "What is Kundli matching?",
        a: "A traditional Vedic method of checking compatibility between two birth charts, mostly before marriage. The Ashtakoota system scores eight factors out of 36 gunas, and astrologers also look at doshas such as Mangal Dosha. It's one traditional view and can't decide whether a relationship will succeed.",
      },
      {
        q: "What are Mangal Dosha and Sade Sati?",
        a: "Mangal (Manglik) Dosha relates to Mars sitting in certain houses of the birth chart. Sade Sati is the roughly seven-and-a-half-year period when Saturn passes through the sign before your Moon sign, your Moon sign and the sign after it. How much either matters depends on the rest of the chart.",
      },
    ],
  },
  {
    id: "wallet",
    title: "Wallet & rewards",
    icon: "wallet-outline",
    items: [
      {
        q: "How do I add money?",
        a: "Go to Profile → Wallet, pick an amount and pay with UPI. Every pack adds extra credit on top, for example ₹50 gives you ₹75 in your wallet.",
      },
      {
        q: "Money was deducted but not added to my wallet",
        a: "Your balance usually updates within a few minutes. If it still hasn't after some time, write to us with the payment details and we'll sort it out.",
      },
      {
        q: "How do daily rewards work?",
        a: "You earn wallet credit every day: ₹5 for a chat, ₹2 for reading your daily insight, and ₹3 for every completed mantra session of 108 chants. Rewards are per account and reset each day.",
      },
    ],
  },
  {
    id: "profiles",
    title: "Profiles",
    icon: "account-heart-outline",
    items: [
      {
        q: "Can I add family members or friends?",
        a: "Yes. Go to Profile → Manage profiles → Add a loved one and enter their birth details. Your first loved one's profile is free; each one after that costs a one-time amount shown on the screen.",
      },
      {
        q: "How do I switch profiles?",
        a: "Tap your name at the top of the Home, Chat or Reports screen and pick a profile. Guidance, chats and reports then show for that person.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & account",
    icon: "shield-check-outline",
    items: [
      {
        q: "Is my information private?",
        a: "Your birth details and chats are used to give you readings and are linked to your account. Read the Privacy Policy in Profile for how your data is collected, used and protected.",
      },
      {
        q: "How do I delete my account?",
        a: "Go to Profile → Account settings → Delete account. This removes your account and its profiles.",
      },
    ],
  },
];

const ALL = "all";

export default function FaqScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  // Open question, as "<category>:<index>".
  const [open, setOpen] = useState<string | null>("start:0");

  const toggle = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((current) => (current === key ? null : key));
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORIES.filter((c) => category === ALL || c.id === category)
      .map((c) => ({
        ...c,
        items: c.items
          .map((item, index) => ({ ...item, key: `${c.id}:${index}` }))
          .filter((item) => !q || `${item.q} ${item.a}`.toLowerCase().includes(q)),
      }))
      .filter((c) => c.items.length > 0);
  }, [query, category]);

  const total = CATEGORIES.reduce((n, c) => n + c.items.length, 0);

  const contact = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Help with Vritta")}`).catch(() =>
      Alert.alert("Need help?", `Write to us at ${SUPPORT_EMAIL} and we'll get back to you.`)
    );
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backButton} accessibilityLabel="Go back">
          <Icon name="chevron-left" size={24} color={C.INK} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Help & FAQ</Text>
          <Text style={s.subtitle}>{`${total} answers about Vritta`}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Search */}
        <View style={s.search}>
          <Icon name="magnify" size={19} color={C.MUTED} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search questions"
            placeholderTextColor={C.MUTED}
            style={s.searchInput}
            returnKeyType="search"
          />
          {!!query && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Icon name="close-circle" size={17} color={C.MUTED} />
            </Pressable>
          )}
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
          style={s.chipsScroll}
        >
          {[{ id: ALL, title: "All", icon: "apps" as const }, ...CATEGORIES].map((c) => {
            const active = category === c.id;
            return (
              <Pressable key={c.id} onPress={() => setCategory(c.id)} style={[s.chip, active && s.chipActive]}>
                <Icon name={c.icon} size={15} color={active ? C.CARD : C.PLUM} />
                <Text style={[s.chipText, active && s.chipTextActive]}>{c.title}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Questions */}
        {visible.map((c, groupIndex) => (
          <Reanimated.View key={c.id} entering={FadeInDown.delay(50 * groupIndex).duration(380)}>
            <Text style={s.overline}>{c.title.toUpperCase()}</Text>
            <View style={s.group}>
              {c.items.map((item, index) => {
                const expanded = open === item.key || !!query.trim();
                return (
                  <View key={item.key} style={index > 0 ? s.divider : undefined}>
                    <Pressable
                      onPress={() => toggle(item.key)}
                      style={s.row}
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                    >
                      <View style={[s.qIcon, expanded && s.qIconOpen]}>
                        <Icon name={expanded ? "minus" : "plus"} size={15} color={expanded ? C.CARD : C.PLUM} />
                      </View>
                      <Text style={s.question}>{item.q}</Text>
                    </Pressable>
                    {expanded && <Text style={s.answer}>{item.a}</Text>}
                  </View>
                );
              })}
            </View>
          </Reanimated.View>
        ))}

        {visible.length === 0 && (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Icon name="text-search" size={26} color={C.PLUM} />
            </View>
            <Text style={s.emptyTitle}>No answers found</Text>
            <Text style={s.emptyText}>Try another word, or ask us directly below.</Text>
          </View>
        )}

        {/* Still need help */}
        <View style={s.help}>
          <View style={s.helpRing} />
          <View style={s.helpIcon}>
            <Icon name="lifebuoy" size={22} color={C.CARD} />
          </View>
          <Text style={s.helpTitle}>Still need help?</Text>
          <Text style={s.helpText}>Write to us and we&apos;ll get back to you.</Text>
          <Pressable onPress={contact} style={s.helpButton}>
            <Icon name="email-outline" size={17} color={C.PLUM} />
            <Text style={s.helpButtonText}>{SUPPORT_EMAIL}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const shadow = {
  shadowColor: "#2B1A3D",
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.LAVENDER },

  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  title: { fontSize: 21, fontWeight: "700", color: C.INK, letterSpacing: -0.3 },
  subtitle: { marginTop: 1, fontSize: 12.5, color: C.MUTED },

  content: { paddingHorizontal: 16 },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.INK, paddingVertical: 0 },

  chipsScroll: { marginTop: 12, marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  chipActive: { backgroundColor: C.PLUM, borderColor: C.PLUM },
  chipText: { fontSize: 13, fontWeight: "600", color: C.INK },
  chipTextActive: { color: C.CARD },

  overline: { marginTop: 20, marginBottom: 8, fontSize: 11, fontWeight: "700", letterSpacing: 1.3, color: C.GOLD },
  group: {
    borderRadius: 20,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    overflow: "hidden",
    ...shadow,
  },
  divider: { borderTopWidth: 1, borderTopColor: "#EFE9F2" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  qIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.SOFT,
  },
  qIconOpen: { backgroundColor: C.PLUM },
  question: { flex: 1, fontSize: 14.5, lineHeight: 20, fontWeight: "600", color: C.INK },
  answer: { paddingLeft: 54, paddingRight: 16, paddingBottom: 16, fontSize: 13.5, lineHeight: 20, color: C.MUTED },

  empty: { alignItems: "center", paddingTop: 40, gap: 8 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.INK },
  emptyText: { fontSize: 13, color: C.MUTED, textAlign: "center" },

  help: {
    marginTop: 24,
    padding: 18,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: C.PLUM,
    ...shadow,
    shadowOpacity: 0.2,
  },
  helpRing: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
    borderColor: "rgba(255,253,252,0.12)",
  },
  helpIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,253,252,0.12)",
    borderWidth: 1,
    borderColor: "rgba(196,154,74,0.5)",
  },
  helpTitle: { marginTop: 12, fontSize: 16, fontWeight: "700", color: C.CARD },
  helpText: { marginTop: 3, fontSize: 12.5, color: "rgba(255,253,252,0.75)" },
  helpButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: C.CARD,
  },
  helpButtonText: { fontSize: 13.5, fontWeight: "700", color: C.PLUM },
});
