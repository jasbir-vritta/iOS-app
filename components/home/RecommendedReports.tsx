
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Dimensions,
  ImageBackground,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import reportsData from "../constants/reports.json";

// Reports that have their own page (others open the Reports tab).
const REPORT_IDS = new Set((reportsData as { id: string }[]).map((r) => r.id));

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  MUTED: "#6B6470",
  WHITE: "#FFFFFF",
};

const px = (value: number) =>
  Math.round(value * (Math.min(Dimensions.get("window").width, 430) / 430));

const GAP = 8;
const H_PAD = 16;
const VISIBLE = 3;
const CARD_RATIO = 0.72;

const reports = [
  {
    id: "kundli-milan",
    title: "Kundli Matching",
    subtitle: "Report",
    background: require("../../assets/backgrounds/homepage_kundli_milan_report.png"),
  },
  {
    id: "career",
    title: "Career",
    subtitle: "Report",
    background: require("../../assets/backgrounds/homepage_career_report.png"),
  },
  {
    id: "finance",
    title: "Finance",
    subtitle: "Report",
    background: require("../../assets/backgrounds/homepage_finanance_report.png"),
  },
];

export default function RecommendedReports() {
  const [rowWidth, setRowWidth] = useState(
    Dimensions.get("window").width - H_PAD * 2
  );

  const onLayout = (event: LayoutChangeEvent) => {
    setRowWidth(event.nativeEvent.layout.width);
  };

  const openReports = (reportId?: string) => {
    if (reportId && REPORT_IDS.has(reportId)) {
      // Straight to that report's page.
      router.push({
        pathname: "/(root)/report/[report_id]",
        params: { report_id: reportId },
      } as any);
    } else {
      router.push("/(root)/(tabs)/reports" as any);
    }
  };

  const cardW = Math.floor((rowWidth - GAP * (VISIBLE - 1)) / VISIBLE);
  const cardH = Math.round(cardW * CARD_RATIO);
  const pad = Math.round(cardW * 0.09);
  const arrowSize = Math.round(cardW * 0.22);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>
            Recommended reports for you
          </Text>
          <Text style={styles.subtitle}>
            In-depth analysis for every stage of your life
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all reports"
          onPress={() => openReports()}
          style={styles.viewAll}
          hitSlop={8}
        >
          <Text style={styles.viewAllText}>View all</Text>
          <Icon name="arrow-right" size={px(18)} color={C.PLUM} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -H_PAD }}
        contentContainerStyle={[
          styles.cards,
          {
            paddingHorizontal: H_PAD,
            paddingVertical: 4,
          },
        ]}
      >
        {reports.map((report) => (
          <Pressable
            key={report.id}
            accessibilityRole="button"
            accessibilityLabel={`View ${report.title} ${report.subtitle}`}
            onPress={() => openReports(report.id)}
            style={({ pressed }) => [
              styles.cardPressable,
              pressed && styles.pressed,
            ]}
          >
            <ImageBackground
              source={report.background}
              resizeMode="cover"
              imageStyle={{
                borderRadius: Math.round(cardW * 0.14),
              }}
              style={[
                styles.card,
                {
                  width: cardW,
                  height: cardH,
                  borderRadius: Math.round(cardW * 0.14),
                  padding: pad,
                },
              ]}
            >
              <View style={styles.footer}>
                <View
                  style={{
                    flex: 1,
                    paddingRight: Math.round(cardW * 0.04),
                  }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    allowFontScaling={false}
                    style={[
                      styles.cardTitle,
                      {
                        fontSize: Math.round(cardW * 0.098),
                        lineHeight: Math.round(cardW * 0.125),
                      },
                    ]}
                  >
                    {report.title}
                  </Text>

                  <Text
                    numberOfLines={1}
                    allowFontScaling={false}
                    style={[
                      styles.cardSubtitle,
                      {
                        fontSize: Math.round(cardW * 0.098),
                        lineHeight: Math.round(cardW * 0.125),
                      },
                    ]}
                  >
                    {report.subtitle}
                  </Text>
                </View>

                <View
                  style={[
                    styles.arrowButton,
                    {
                      width: arrowSize,
                      height: arrowSize,
                      borderRadius: arrowSize / 2,
                    },
                  ]}
                >
                  <Icon
                    name="arrow-right"
                    size={Math.round(cardW * 0.12)}
                    color={C.INK}
                  />
                </View>
              </View>
            </ImageBackground>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: px(20),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: px(12),
  },
  headerText: {
    flex: 1,
    paddingRight: px(6),
  },
  heading: {
    fontSize: px(19),
    lineHeight: px(24),
    fontWeight: "700",
    color: C.INK,
  },
  subtitle: {
    fontSize: px(12),
    lineHeight: px(16),
    color: C.MUTED,
    marginTop: px(2),
  },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: px(6),
  },
  viewAllText: {
    color: C.PLUM,
    fontSize: px(14),
    fontWeight: "600",
  },
  cards: {
    gap: GAP,
  },
  cardPressable: {
    flexShrink: 0,
  },
  card: {
    overflow: "hidden",
    justifyContent: "flex-end",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  footer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  cardTitle: {
    color: C.INK,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: C.INK,
  },
  arrowButton: {
    backgroundColor: C.WHITE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2B1A3D",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
  },
});
