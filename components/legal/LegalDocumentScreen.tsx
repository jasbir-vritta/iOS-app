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
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { LegalDocument } from "../constants/legal";

// Shared layout for Privacy Policy and Terms & Conditions:
// header with share, "Last updated" card, numbered expandable sections.

type Props = {
  document: LegalDocument;
  // Top card heading; defaults to "Last updated" (card text = document.lastUpdated).
  cardTitle?: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  // Accent for the icon circle and section numbers.
  accent: { tint: string; color: string };
};

const C = {
  bg: "#F7F3FA",
  card: "#FFFDFC",
  ink: "#1C1820",
  plum: "#2B1A3D",
  muted: "#68616A",
  line: "#EEE7F4",
  cardTint: "#F1EBF7",
};

export function LegalDocumentScreen({ document, icon, accent, cardTitle = "Last updated" }: Props) {
  // First section starts open, like the design.
  const [open, setOpen] = useState<number | null>(0);

  const toggle = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((current) => (current === index ? null : index));
  };

  const share = () => {
    const text = [
      `${document.title} — Vritta`,
      `${cardTitle} ${document.lastUpdated}`,
      ...document.sections.map(
        (section, i) => `\n${i + 1}. ${section.title}\n${section.paragraphs.join("\n\n")}`
      ),
    ].join("\n");

    Share.share({ title: document.title, message: text }).catch(() => {});
  };

  return (
    <View style={[styles.flex, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={styles.flex} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel="Back"
            style={styles.headerButton}
          >
            <Icon name="chevron-left" size={30} color={C.ink} />
          </Pressable>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {document.title}
          </Text>

          <Pressable
            onPress={share}
            hitSlop={12}
            accessibilityLabel={`Share ${document.title}`}
            style={styles.headerButton}
          >
            <Icon name="export-variant" size={24} color={C.ink} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Top card (Last updated / FAQ summary) */}
          <View style={styles.infoCard}>
            <View style={[styles.infoIcon, { backgroundColor: accent.tint }]}>
              <Icon name={icon} size={24} color={accent.color} />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>{cardTitle}</Text>
              <Text style={styles.infoValue}>{document.lastUpdated}</Text>
            </View>
          </View>

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

                    <Icon name={expanded ? "chevron-up" : "chevron-down"} size={22} color={C.ink} />
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
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: C.plum,
  },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  infoCard: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: C.cardTint,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: { marginLeft: 14, flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: "500", color: C.ink },
  infoValue: { marginTop: 2, fontSize: 14, color: C.muted },
  list: {
    marginTop: 16,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: C.card,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: C.line },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  number: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { fontSize: 15, fontWeight: "600", color: C.ink },
  rowTitle: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
    color: C.ink,
  },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
  paragraph: { fontSize: 14, lineHeight: 21, color: C.muted },
});
