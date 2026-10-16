import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Dimensions,
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import reportsData from "../constants/reports.json";
import { loadProfileReports, useReportsStore } from "../stores/reportsStore";
import { useUserStore } from "../stores/userStore";
import { C, F, HOME_PAD, LIST_BOTTOM, LIST_TOP, SectionHeader, softShadow } from "./homeUi";

type Report = {
  id: string;
  title: string;
  description: string;
  image: string;
  price: number;
  oldPrice?: number;
  discount?: string;
  frequency?: string;
};

// Picked for Home, in this order.
const RECOMMENDED = ["kundli-milan", "future", "career", "finance"];
const ALL = reportsData as Report[];
const REPORTS = RECOMMENDED.map((id) => ALL.find((r) => r.id === id)).filter(Boolean) as Report[];

const GAP = 12;
const CARD_WIDTH_FRACTION = 0.7; // one card and a peek of the next
const IMAGE_RATIO = 1200 / 500; // report covers are 1200 x 500

const openReport = (id: string) =>
  router.push({ pathname: "/(root)/report/[report_id]", params: { report_id: id } } as any);

export default function RecommendedReports() {
  const [rowWidth, setRowWidth] = useState(Dimensions.get("window").width - HOME_PAD * 2);
  const profileId = useUserStore((state) => state.user?.active_profile_id);
  const purchases = useReportsStore((state) =>
    profileId ? state.byProfile[String(profileId)]?.purchases : undefined
  );

  // Know what this profile already bought (shows "Purchased" instead of a price).
  useFocusEffect(
    useCallback(() => {
      if (profileId) void loadProfileReports(String(profileId)).catch(() => {});
    }, [profileId])
  );

  // Future Report is bought per duration ("future:10"): any of them counts.
  const stateOf = (id: string) => {
    const orders = Object.entries(purchases || {})
      .filter(([key]) => key === id || key.startsWith(`${id}:`))
      .map(([, order]) => order);
    if (orders.some((o) => o?.status === "completed")) return "purchased";
    if (orders.some((o) => o?.status === "processing")) return "preparing";
    return "buy";
  };

  const onLayout = (e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width);
  const cardW = Math.round(rowWidth * CARD_WIDTH_FRACTION);
  const imageH = Math.round(cardW / IMAGE_RATIO);

  return (
    <View onLayout={onLayout}>
      <SectionHeader
        overline="IN-DEPTH REPORTS"
        title="Recommended for you"
        onViewAll={() => router.push("/(root)/(tabs)/reports" as any)}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardW + GAP}
        snapToAlignment="start"
        style={{ marginHorizontal: -HOME_PAD }}
        contentContainerStyle={{ paddingHorizontal: HOME_PAD, paddingTop: LIST_TOP, paddingBottom: LIST_BOTTOM, gap: GAP }}
      >
        {REPORTS.map((report) => {
          const state = stateOf(report.id);

          return (
            <Pressable
              key={report.id}
              accessibilityRole="button"
              accessibilityLabel={`${report.title}, ₹${report.price}`}
              onPress={() => openReport(report.id)}
              style={[styles.card, { width: cardW }]}
            >
              <View style={styles.clip}>
                <View style={{ height: imageH }}>
                  <Image source={{ uri: report.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  {!!report.frequency && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{report.frequency}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.body}>
                  <Text style={styles.title} numberOfLines={1}>
                    {report.title}
                  </Text>
                  <Text style={styles.description} numberOfLines={1}>
                    {report.description}
                  </Text>

                  <View style={styles.footer}>
                    {state === "buy" ? (
                      <View style={styles.priceRow}>
                        <Text style={styles.price}>₹{report.price}</Text>
                        {!!report.oldPrice && <Text style={styles.oldPrice}>₹{report.oldPrice}</Text>}
                        {!!report.discount && (
                          <View style={styles.discount}>
                            <Text style={styles.discountText}>{report.discount}</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={styles.owned}>
                        <Icon
                          name={state === "purchased" ? "check-decagram" : "progress-clock"}
                          size={13}
                          color={C.PLUM}
                        />
                        <Text style={styles.ownedText}>{state === "purchased" ? "Purchased" : "Preparing"}</Text>
                      </View>
                    )}

                    <View style={styles.arrow}>
                      <Icon name="arrow-right" size={16} color={C.CARD} />
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, backgroundColor: C.CARD, ...softShadow },
  clip: { borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: C.LINE, backgroundColor: C.CARD },
  tag: {
    position: "absolute",
    top: 10,
    left: 10,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: "rgba(255,253,252,0.92)",
  },
  tagText: { color: C.PLUM, fontSize: 10.5, fontFamily: F.semibold },
  body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  title: { color: C.INK, fontSize: 16, fontFamily: F.bold },
  description: { color: C.MUTED, fontSize: 12.5, fontFamily: F.regular, marginTop: 3 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  price: { color: C.INK, fontSize: 18, fontFamily: F.bold },
  oldPrice: { color: C.MUTED, fontSize: 12.5, fontFamily: F.regular, textDecorationLine: "line-through" },
  discount: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: "#E6F2EA" },
  discountText: { color: "#2E7D4F", fontSize: 10, fontFamily: F.semibold },
  owned: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: C.SOFT,
  },
  ownedText: { color: C.PLUM, fontSize: 12, fontFamily: F.semibold },
  arrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.PLUM, alignItems: "center", justifyContent: "center" },
});
