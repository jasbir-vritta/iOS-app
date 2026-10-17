import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";

import { Text } from "../ui/BrandText";
import { SafeAreaView } from "react-native-safe-area-context";

import type { LegalDocument } from "../constants/legal";
import { useLanguage, useT } from "../../lib/i18n";

// Shared layout for Privacy Policy and Terms & Conditions:
// header with share, "Last updated" card, numbered expandable sections.
// Same header and colours as the other profile screens.

type Props = {
  document: LegalDocument;
  // Translated document name for the header/share (body text stays English).
  title?: string;
  // Top card heading; defaults to "Last updated" (card text = document.lastUpdated).
  cardTitle?: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  // Accent for the icon circle and section numbers.
  accent: { tint: string; color: string };
};

const C = {
  bg: "#F4F0F8",
  card: "#FFFDFC",
  ink: "#1C1820",
  plum: "#2B1A3D",
  gold: "#C49A4A",
  muted: "#68616A",
  line: "#EFE9F2",
  border: "rgba(217,206,193,0.7)",
};

const shadow = {
  shadowColor: "#2B1A3D",
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

export function LegalDocumentScreen({ document, title, icon, accent, cardTitle }: Props) {
  const t = useT();
  const language = useLanguage();
  const docTitle = title ?? document.title;
  const lastUpdatedLabel = cardTitle ?? t("legal.lastUpdated");
  // First section starts open, like the design.
  const [open, setOpen] = useState<number | null>(0);

  const toggle = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((current) => (current === index ? null : index));
  };

  const share = () => {
    const text = [
      t("legal.shareHeading", { title: docTitle }),
      t("legal.shareUpdated", { label: lastUpdatedLabel, date: document.lastUpdated }),
      ...document.sections.map(
        (section, i) => `\n${i + 1}. ${section.title}\n${section.paragraphs.join("\n\n")}`
      ),
    ].join("\n");

    Share.share({ title: docTitle, message: text }).catch(() => {});
  };

  return (
    <View style={[styles.flex, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={styles.flex} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityLabel={t("common.back")}
            style={styles.headerButton}
          >
            <Icon name="chevron-left" size={24} color={C.ink} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {docTitle}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {t("legal.subtitle", { count: document.sections.length })}
            </Text>
          </View>

          <Pressable
            onPress={share}
            hitSlop={10}
            accessibilityLabel={t("legal.share", { title: docTitle })}
            style={styles.headerButton}
          >
            <Icon name="export-variant" size={19} color={C.plum} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Top card (Last updated / FAQ summary) */}
          <View style={styles.infoCard}>
            <View style={[styles.infoIcon, { backgroundColor: accent.tint }]}>
              <Icon name={icon} size={24} color={accent.color} />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>{lastUpdatedLabel}</Text>
              <Text style={styles.infoValue}>{document.lastUpdated}</Text>
            </View>
          </View>

          {/* Legal text is kept in English (not machine-translated). */}
          {language !== "en" && <Text style={styles.englishNote}>{t("legal.englishOnly")}</Text>}

          <Text style={styles.overline}>{t("legal.sectionCount", { count: document.sections.length })}</Text>

          {/* Sections */}
          <View style={styles.list}>
            {document.sections.map((section, index) => {
              const expanded = open === index;

              return (
                <View key={section.title} style={index > 0 ? styles.rowDivider : undefined}>
                  <Pressable
                    onPress={() => toggle(index)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    style={styles.row}
                  >
                    {/* Number in a round tinted badge */}
                    <View style={[styles.number, { backgroundColor: accent.tint }]}>
                      <Text style={styles.numberText}>{index + 1}</Text>
                    </View>

                    <Text style={styles.rowTitle}>{section.title}</Text>

                    <Icon name={expanded ? "chevron-up" : "chevron-down"} size={22} color={C.muted} />
                  </Pressable>

                  {expanded && (
                    <View style={styles.body}>
                      {section.paragraphs.map((paragraph, p) => {
                        // Bullet lines ("•  …") sit closer together and indented.
                        const bullet = paragraph.startsWith("•");

                        return (
                          <Text
                            key={p}
                            style={[
                              styles.paragraph,
                              {
                                marginTop: p === 0 ? 0 : bullet ? 6 : 12,
                                paddingLeft: bullet ? 6 : 0,
                              },
                            ]}
                          >
                            {paragraph}
                          </Text>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// Plain StyleSheet styles so sizes apply exactly on every device.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  headerTitle: { fontSize: 21, fontWeight: "700", color: C.ink, letterSpacing: -0.3 },
  headerSub: { marginTop: 1, fontSize: 12.5, color: C.muted },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  infoCard: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    ...shadow,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: { marginLeft: 14, flex: 1 },
  infoTitle: { fontSize: 14.5, fontWeight: "700", color: C.ink },
  infoValue: { marginTop: 2, fontSize: 13, color: C.muted },
  englishNote: { marginTop: 12, fontSize: 12.5, lineHeight: 18, color: C.muted },
  overline: { marginTop: 20, marginBottom: 8, fontSize: 11, fontWeight: "700", letterSpacing: 1.3, color: C.gold },
  list: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: C.line },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  number: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { fontSize: 14, fontWeight: "700", color: C.plum },
  rowTitle: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: "600",
    color: C.ink,
  },
  body: { paddingHorizontal: 16, paddingBottom: 16, paddingLeft: 58 },
  paragraph: { fontSize: 13.5, lineHeight: 20, color: C.muted },
});
