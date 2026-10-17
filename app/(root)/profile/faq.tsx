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
import { useT } from "../../../lib/i18n";

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

// Text = translation keys (lib/locales/en.json), translated at render.
const CATEGORIES: Category[] = [
  {
    id: "start",
    title: "faq.cat.start",
    icon: "star-four-points-outline",
    items: [
      { q: "faq.start.1.q", a: "faq.start.1.a" },
      { q: "faq.start.2.q", a: "faq.start.2.a" },
      { q: "faq.start.3.q", a: "faq.start.3.a" },
      { q: "faq.start.4.q", a: "faq.start.4.a" },
    ],
  },
  {
    id: "chats",
    title: "faq.cat.chats",
    icon: "chat-processing-outline",
    items: [
      { q: "faq.chats.1.q", a: "faq.chats.1.a" },
      { q: "faq.chats.2.q", a: "faq.chats.2.a" },
      { q: "faq.chats.3.q", a: "faq.chats.3.a" },
      { q: "faq.chats.4.q", a: "faq.chats.4.a" },
    ],
  },
  {
    id: "reports",
    title: "faq.cat.reports",
    icon: "file-document-outline",
    items: [
      { q: "faq.reports.1.q", a: "faq.reports.1.a" },
      { q: "faq.reports.2.q", a: "faq.reports.2.a" },
      { q: "faq.reports.3.q", a: "faq.reports.3.a" },
      { q: "faq.reports.4.q", a: "faq.reports.4.a" },
      { q: "faq.reports.5.q", a: "faq.reports.5.a" },
      { q: "faq.reports.6.q", a: "faq.reports.6.a" },
    ],
  },
  {
    id: "wallet",
    title: "faq.cat.wallet",
    icon: "wallet-outline",
    items: [
      { q: "faq.wallet.1.q", a: "faq.wallet.1.a" },
      { q: "faq.wallet.2.q", a: "faq.wallet.2.a" },
      { q: "faq.wallet.3.q", a: "faq.wallet.3.a" },
    ],
  },
  {
    id: "profiles",
    title: "faq.cat.profiles",
    icon: "account-heart-outline",
    items: [
      { q: "faq.profiles.1.q", a: "faq.profiles.1.a" },
      { q: "faq.profiles.2.q", a: "faq.profiles.2.a" },
    ],
  },
  {
    id: "privacy",
    title: "faq.cat.privacy",
    icon: "shield-check-outline",
    items: [
      { q: "faq.privacy.1.q", a: "faq.privacy.1.a" },
      { q: "faq.privacy.2.q", a: "faq.privacy.2.a" },
    ],
  },
];

const ALL = "all";

export default function FaqScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  // Open question, as "<category>:<index>".
  const [open, setOpen] = useState<string | null>("start:0");

  const toggle = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((current) => (current === key ? null : key));
  };

  // Translated at render so switching language updates the questions.
  const categories = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        title: t(c.title),
        items: c.items.map((item) => ({ q: t(item.q), a: t(item.a) })),
      })),
    [t]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories.filter((c) => category === ALL || c.id === category)
      .map((c) => ({
        ...c,
        items: c.items
          .map((item, index) => ({ ...item, key: `${c.id}:${index}` }))
          .filter((item) => !q || `${item.q} ${item.a}`.toLowerCase().includes(q)),
      }))
      .filter((c) => c.items.length > 0);
  }, [query, category, categories]);

  const total = CATEGORIES.reduce((n, c) => n + c.items.length, 0);

  const contact = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Help with Vritta")}`).catch(() =>
      Alert.alert(t("faq.alertTitle"), t("faq.alertBody", { email: SUPPORT_EMAIL }))
    );
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backButton} accessibilityLabel={t("common.back")}>
          <Icon name="chevron-left" size={24} color={C.INK} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t("faq.title")}</Text>
          <Text style={s.subtitle}>{t("faq.subtitle", { count: total })}</Text>
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
            placeholder={t("faq.search")}
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
          {[{ id: ALL, title: t("faq.all"), icon: "apps" as const }, ...categories].map((c) => {
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
            <Text style={s.emptyTitle}>{t("faq.emptyTitle")}</Text>
            <Text style={s.emptyText}>{t("faq.emptyText")}</Text>
          </View>
        )}

        {/* Still need help */}
        <View style={s.help}>
          <View style={s.helpRing} />
          <View style={s.helpIcon}>
            <Icon name="lifebuoy" size={22} color={C.CARD} />
          </View>
          <Text style={s.helpTitle}>{t("faq.helpTitle")}</Text>
          <Text style={s.helpText}>{t("faq.helpText")}</Text>
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
