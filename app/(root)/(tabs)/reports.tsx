// app/(root)/(tabs)/reports.tsx
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Dimensions, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { router } from "expo-router";
import TopBar from "../../../components/TopBar";
import reportsData from "../../../components/constants/reports.json";


/* Sizes are measured in pixels of the reference design (477px wide) and scaled to the device. */
const W = Dimensions.get("window").width;
const K = Math.min(W, 430) / 477;
const px = (n: number) => Math.round(n * K * 100) / 100;
const fs = (n: number) => Math.max(8, px(n));

const PAD = px(27);
const CARD_W = W - PAD * 2;

// Life focus tiles fill the content width exactly, like the cards around them.
const FOCUS_GAP = px(9);
const FOCUS_W = (CARD_W - FOCUS_GAP * 5) / 6;

const C = {
  INK: "#1C1820", PLUM: "#2B1A3D", TERRACOTTA: "#A94C36", BG: "#F4F0F8", CARD: "#FFFDFC",
  MUTED: "#68616A", BORDER: "#D9CEC1", IVORY: "#F7F1E8", PEACH: "#FBE4D5", SOFT: "#EFE8F2",
};



const IMG = "https://storage.googleapis.com/vritta/astrology/report/";

// Order matches the design: the first five rows of "All Reports" are Kundli, True Love, Marriage, Past Life, Finance.
type Report = {
  id: string;
  title: string;
  description: string;
  image: string;
  price: number;
  oldPrice: number;
  discount: string;
  frequency: "One time" | "Monthly";
  icon: string;
};

const reports: Report[] = reportsData;

const byId = (id: string) => reports.find((r) => r.id === id);
const topReports = ["kundli-milan", "career", "marriage", "true-love"].map(byId).filter(Boolean) as Report[];
const popularReports = ["true-love", "marriage", "career", "kundli-milan"].map(byId).filter(Boolean) as Report[];

const focusItems = [
  { label: "Love", icon: "heart" },
  { label: "Marriage", icon: "ring" },
  { label: "Career", icon: "briefcase-outline" },
  { label: "Money", icon: "cash-multiple" },
  { label: "Wellness", icon: "flower-lotus" },
  { label: "Baby", icon: "baby-face-outline" },
];

const tabs = [
  { id: "all", label: "All" },
  { id: "Monthly", label: "Monthly" },
  { id: "One time", label: "One Time" },
] as const;

const open = (r: Report) => {
  router.push({
    pathname: "/report/[report_id]",
    params: {
      report_id: r.id,
    },
  });
};

export default function Reports() {
  const insets = useSafeAreaInsets();
  const [focus, setFocus] = useState(0);
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("all");

  const list = useMemo(() => (tab === "all" ? reports : reports.filter((r) => r.frequency === tab)), [tab]);

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: insets.top + 4, paddingBottom: px(260) }}
      >
        <TopBar />

        {/* Header */}
        <ImageBackground
          source={require("../../../assets/images/report/report_top_background.png")}
          resizeMode="cover"
          style={s.header}
        >
          <Text style={s.title}>Reports</Text>
          <Text style={s.subtitle}>Guidance for a more aligned tomorrow</Text>
        </ImageBackground>

        {/* Top carousel */}
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} decelerationRate="fast">
          {topReports.map((r, i) => (
            <View key={r.id} style={s.carouselCard}>
              <Image source={{ uri: r.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />

              <View style={s.carouselContent}>
                <View style={s.badge}>
                  <Icon name="star-four-points" size={px(12)} color={C.TERRACOTTA} />
                  <Text style={s.badgeText}>Recommended for you</Text>
                </View>
                <Text style={s.carouselTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={s.carouselDesc} numberOfLines={2}>{r.description}</Text>
                <Pressable onPress={() => open(r)} style={s.viewBtn}>
                  <Text style={s.viewBtnText}>View Report</Text>
                  <Icon name="arrow-right" size={px(16)} color="#fff" style={{ marginLeft: px(10) }} />
                </Pressable>
              </View>

              <View style={s.indicator}>
                <Icon name="chevron-left" size={px(15)} color={C.MUTED} />
                <Text style={s.indicatorText}>{i + 1} / {topReports.length}</Text>
                <Icon name="chevron-right" size={px(15)} color={C.INK} />
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Explore by Life Focus */}
        <View style={[s.sectionHeader, { marginTop: px(8) }]}>
          <Text style={s.sectionTitle}>Explore by Life Focus</Text>
          <SeeAll />
        </View>
        <View style={s.focusRow}>
          {focusItems.map((f, i) => {
            const active = i === focus;
            return (
              <Pressable key={f.label} onPress={() => setFocus(i)} style={[s.focusTile, active && s.focusTileActive]}>
                <Icon name={f.icon as any} size={px(27)} color={active ? "#F4C9A8" : C.TERRACOTTA} />
                <Text style={[s.focusLabel, active && { color: "#fff" }]} numberOfLines={1}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Popular Reports */}
        <View style={[s.sectionHeader, { marginTop: px(14) }]}>
          <Text style={s.sectionTitle}>Popular Reports</Text>
          <SeeAll />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: px(10) }} style={{ marginHorizontal: -PAD }}>
          <View style={{ width: PAD - px(10) }} />
          {popularReports.map((r) => (
            <Pressable key={r.id} onPress={() => open(r)} style={s.popularCard}>
              <View>
                <Image source={{ uri: r.image }} style={s.popularImage} resizeMode="cover" />
                <View style={[s.pill, s.popularPill]}><Text style={s.pillText}>{r.discount}</Text></View>
              </View>
              <View style={s.popularBody}>
                <Text style={s.popularTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={s.popularDesc} numberOfLines={2}>{r.description}</Text>
                <View style={s.popularPriceRow}>
                  <Text style={s.price}>₹{r.price}</Text>
                  <Text style={s.oldPrice} numberOfLines={1}>₹{r.oldPrice}</Text>
                  <View style={{ flex: 1 }} />
                  <View style={[s.circleArrow, { flexShrink: 0, marginRight: -px(5) }]}>
                    <Icon name="chevron-right" size={px(15)} color={C.MUTED} />
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
          <View style={{ width: PAD - px(10) }} />
        </ScrollView>

        {/* All Reports */}
        <View style={[s.sectionHeader, { marginTop: px(16) }]}>
          <Text style={s.sectionTitle}>All Reports</Text>
          <View style={{ flexDirection: "row", gap: px(6) }}>
            {tabs.map((t) => {
              const active = t.id === tab;
              return (
                <Pressable key={t.id} onPress={() => setTab(t.id)} style={[s.tab, active && s.tabActive]}>
                  <Text style={[s.tabText, active && { color: "#fff" }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: px(9), marginHorizontal: -px(12) }}>
          {list.map((r) => (
            <Pressable key={r.id} onPress={() => open(r)} style={s.row}>
              <Image source={{ uri: r.image }} style={s.thumb} resizeMode="cover" />

              <View style={s.rowBody}>
                <Text style={s.rowTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={s.rowDesc} numberOfLines={2}>{r.description}</Text>
                <View style={s.typeRow}>
                  <Icon name={r.icon as any} size={px(15)} color={C.TERRACOTTA} />
                  <View style={s.typeChip}><Text style={s.typeText}>{r.frequency}</Text></View>
                </View>
              </View>

              <View style={s.rowPrice}>
                <Text style={s.rowPriceText}>₹{r.price}</Text>
                <Text style={s.rowOld}>₹{r.oldPrice}</Text>
                <View style={[s.pill, { marginTop: px(3), marginLeft: 0 }]}><Text style={s.pillText}>{r.discount}</Text></View>
              </View>

              <View style={[s.circleArrow, { width: px(28), height: px(28), borderRadius: px(14), marginLeft: px(6) }]}>
                <Icon name="chevron-right" size={px(19)} color={C.MUTED} />
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function SeeAll() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Text style={s.seeAll}>See all</Text>
      <Icon name="arrow-right" size={px(13)} color={C.INK} style={{ marginLeft: px(4) }} />
    </View>
  );
}

const s = StyleSheet.create({
  header: { height: px(60), marginTop: px(2), justifyContent: "flex-start" },
  title: { fontSize: fs(29), lineHeight: px(33), fontWeight: "700", color: C.INK },
  subtitle: { marginTop: px(1), fontSize: fs(13.5), lineHeight: px(18), color: C.MUTED },

  carouselCard: { width: CARD_W, height: px(163), borderRadius: px(16), overflow: "hidden", backgroundColor: "#FBEBDD" },
  carouselContent: { position: "absolute", left: px(13), top: px(12) },
  badge: { alignSelf: "flex-start", height: px(21), paddingHorizontal: px(10), flexDirection: "row", alignItems: "center", gap: px(5), borderRadius: px(11), backgroundColor: "#FBE6D1" },
  badgeText: { fontSize: fs(10.5), fontWeight: "600", color: C.INK },
  carouselTitle: { marginTop: px(8), maxWidth: px(230), fontSize: fs(19), lineHeight: px(24), fontWeight: "700", color: C.PLUM },
  carouselDesc: { marginTop: px(2), maxWidth: px(200), fontSize: fs(11.5), lineHeight: px(14.5), color: C.MUTED },
  viewBtn: { marginTop: px(12), alignSelf: "flex-start", width: px(162), height: px(34), borderRadius: px(8), backgroundColor: C.PLUM, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  viewBtnText: { fontSize: fs(12.5), fontWeight: "600", color: "#fff" },
  indicator: { position: "absolute", right: px(8), bottom: px(8), height: px(22), paddingHorizontal: px(6), borderRadius: px(11), backgroundColor: "rgba(255,253,252,0.92)", flexDirection: "row", alignItems: "center", gap: px(5) },
  indicatorText: { fontSize: fs(11), fontWeight: "600", color: C.INK },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: px(8) },
  sectionTitle: { fontSize: fs(15), lineHeight: px(20), fontWeight: "700", color: C.INK },
  seeAll: { fontSize: fs(10.5), fontWeight: "500", color: C.INK },

  focusRow: { flexDirection: "row", gap: FOCUS_GAP },
  focusTile: { width: FOCUS_W, height: px(64), borderRadius: px(11), backgroundColor: C.CARD, borderWidth: 1, borderColor: "rgba(217,206,193,0.45)", alignItems: "center", justifyContent: "center" },
  focusTileActive: { backgroundColor: C.PLUM, borderColor: C.PLUM },
  focusLabel: { marginTop: px(4), fontSize: fs(10), fontWeight: "500", color: C.INK },

  popularCard: { width: px(139.5), height: px(153), padding: px(4), borderRadius: px(12), backgroundColor: C.CARD, borderWidth: 1, borderColor: "rgba(217,206,193,0.5)" },
  popularImage: { width: "100%", height: px(69), borderRadius: px(9) },
  popularBody: { flex: 1, paddingHorizontal: px(5), paddingTop: px(6), paddingBottom: px(3) },
  popularTitle: { fontSize: fs(11.5), lineHeight: px(14), fontWeight: "700", color: C.INK },
  popularDesc: { marginTop: px(2), fontSize: fs(9.5), lineHeight: px(13), color: C.MUTED },
  popularPill: { position: "absolute", top: px(5), left: px(5), marginLeft: 0, backgroundColor: "rgba(251,228,213,0.95)" },
  popularPriceRow: { marginTop: "auto", flexDirection: "row", alignItems: "center" },

  price: { fontSize: fs(13.5), fontWeight: "800", color: C.INK },
  oldPrice: { marginLeft: px(5), fontSize: fs(8.5), color: C.MUTED, textDecorationLine: "line-through" },
  pill: { marginLeft: px(5), paddingHorizontal: px(5), paddingVertical: px(2), borderRadius: px(7), backgroundColor: C.PEACH },
  pillText: { fontSize: fs(8.5), fontWeight: "600", color: C.TERRACOTTA },
  circleArrow: { width: px(20), height: px(20), borderRadius: px(10), backgroundColor: C.IVORY, alignItems: "center", justifyContent: "center" },

  tab: { height: px(22), paddingHorizontal: px(12), borderRadius: px(11), alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,253,252,0.9)", borderWidth: 1, borderColor: "rgba(217,206,193,0.5)" },
  tabActive: { backgroundColor: C.PLUM, borderColor: C.PLUM },
  tabText: { fontSize: fs(10.5), fontWeight: "500", color: C.INK },

  row: { minHeight: px(92), paddingHorizontal: px(9), paddingVertical: px(9), borderRadius: px(14), backgroundColor: C.CARD, borderWidth: 1, borderColor: "rgba(217,206,193,0.4)", flexDirection: "row", alignItems: "center" },
  thumb: { width: px(108), height: px(72), borderRadius: px(10) },
  rowBody: { flex: 1, paddingLeft: px(11), paddingRight: px(6), justifyContent: "center" },
  rowTitle: { fontSize: fs(13.5), lineHeight: px(17), fontWeight: "700", color: C.INK },
  rowDesc: { marginTop: px(2), fontSize: fs(10.5), lineHeight: px(14), color: C.MUTED },
  typeRow: { marginTop: px(5), flexDirection: "row", alignItems: "center", gap: px(7) },
  typeChip: { height: px(18), paddingHorizontal: px(8), borderRadius: px(9), backgroundColor: "#FBEFE6", justifyContent: "center" },
  typeText: { fontSize: fs(9.5), color: C.INK },
  rowPrice: { width: px(62), alignItems: "flex-start", justifyContent: "center" },
  rowPriceText: { fontSize: fs(16), fontWeight: "800", color: C.INK },
  rowOld: { marginTop: px(1), fontSize: fs(10), color: C.MUTED, textDecorationLine: "line-through" },
});