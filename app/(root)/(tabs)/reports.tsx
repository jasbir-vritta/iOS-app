// app/(root)/(tabs)/reports.tsx
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import {
  Dimensions, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { router, useFocusEffect } from "expo-router";
import TopBar from "../../../components/TopBar";
import reportsData from "../../../components/constants/reports.json";
import { loadProfileReports, loadReportHistory, useReportsStore } from "../../../components/stores/reportsStore";
import { useUserStore } from "../../../components/stores/userStore";
import { useTabBarSpace } from "../../../components/utils/tabBar";


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

// Each life focus and the reports that answer it (best match first).
const focusItems = [
  { label: "Love", icon: "heart", reports: ["true-love", "kundli-milan", "marriage"] },
  { label: "Marriage", icon: "ring", reports: ["marriage", "kundli-milan", "true-love"] },
  { label: "Career", icon: "briefcase-outline", reports: ["career", "travel", "future"] },
  { label: "Money", icon: "cash-multiple", reports: ["finance", "career", "future"] },
  { label: "Wellness", icon: "flower-lotus", reports: ["health", "future"] },
  { label: "Baby", icon: "baby-face-outline", reports: ["baby-name"] },
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

/* Bought for the active profile: no price, just a badge. Otherwise the price. */
function useReportState() {
  const profileId = useUserStore((state) => state.user?.active_profile_id);
  const mine = useReportsStore((state) => (profileId ? state.byProfile[String(profileId)] : undefined));

  // Refresh whenever the tab is opened (after a purchase, or another profile).
  useFocusEffect(
    useCallback(() => {
      if (profileId) void loadProfileReports(String(profileId));
    }, [profileId])
  );

  return (id: string) => {
    // Future Report is bought per duration ("future:10"): any of them counts.
    const orders = Object.entries(mine?.purchases || {})
      .filter(([key]) => key === id || key.startsWith(`${id}:`))
      .map(([, order]) => order);
    if (orders.some((o) => o?.status === "completed")) return "purchased";
    if (orders.some((o) => o?.status === "processing")) return "preparing";
    if (mine?.available?.[id] === false) return "soon";
    return "buy";
  };
}

function StatusPill({ state }: { state: string }) {
  if (state === "purchased") {
    return (
      <View style={s.ownedPill}>
        <Icon name="check-decagram" size={px(12)} color={C.PLUM} />
        <Text style={s.ownedText} numberOfLines={1}>Purchased</Text>
      </View>
    );
  }
  if (state === "preparing") {
    return (
      <View style={s.ownedPill}>
        <Icon name="progress-clock" size={px(12)} color={C.PLUM} />
        <Text style={s.ownedText} numberOfLines={1}>Preparing</Text>
      </View>
    );
  }
  return (
    <View style={[s.ownedPill, { backgroundColor: C.IVORY }]}>
      <Icon name="clock-outline" size={px(12)} color={C.MUTED} />
      <Text style={[s.ownedText, { color: C.MUTED }]} numberOfLines={1}>Coming soon</Text>
    </View>
  );
}

/* Entry to My Reports: only shown once the account has bought a report. */
function MyReportsCard() {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void loadReportHistory().then((rows) => setCount(rows.length));
    }, [])
  );

  if (count === 0) return null;

  return (
    <Pressable onPress={() => router.push("/report/my-reports")} style={s.myReports}>
      <View style={s.myReportsIcon}>
        <Icon name="book-open-page-variant-outline" size={px(26)} color={C.TERRACOTTA} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: px(8) }}>
          <Text style={s.myReportsTitle}>My Reports</Text>
          <View style={s.boughtTag}>
            <Text style={s.boughtText}>BOUGHT</Text>
          </View>
        </View>
        <Text style={s.myReportsSub}>
          See your purchased reports
        </Text>
      </View>
      <Icon name="chevron-right" size={px(24)} color={C.INK} />
    </Pressable>
  );
}

export default function Reports() {
  const tabSpace = useTabBarSpace();
  const stateOf = useReportState();
  const insets = useSafeAreaInsets();
  // Picked life focus (null = Popular Reports).
  const [focus, setFocus] = useState<number | null>(null);
  const focusPicked = focus === null ? null : focusItems[focus];
  const shelf = focusPicked
    ? (focusPicked.reports.map(byId).filter(Boolean) as Report[])
    : popularReports;
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("all");

  const list = useMemo(() => (tab === "all" ? reports : reports.filter((r) => r.frequency === tab)), [tab]);

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: insets.top + 4, paddingBottom: tabSpace + 40 }}
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

        <MyReportsCard />

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
              <Pressable
                key={f.label}
                onPress={() => setFocus(active ? null : i)}
                style={[s.focusTile, active && s.focusTileActive]}
              >
                <Icon name={f.icon as any} size={px(27)} color={active ? "#F4C9A8" : C.TERRACOTTA} />
                <Text style={[s.focusLabel, active && { color: "#fff" }]} numberOfLines={1}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Popular Reports, or the picked life focus's reports */}
        <View style={[s.sectionHeader, { marginTop: px(14) }]}>
          <Text style={s.sectionTitle}>{focusPicked ? `${focusPicked.label} Reports` : "Popular Reports"}</Text>
          {focusPicked ? (
            <Pressable onPress={() => setFocus(null)} hitSlop={8} style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={s.seeAll}>Clear</Text>
              <Icon name="close" size={px(13)} color={C.INK} style={{ marginLeft: px(4) }} />
            </Pressable>
          ) : (
            <SeeAll />
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: px(10) }} style={{ marginHorizontal: -PAD }}>
          <View style={{ width: PAD - px(10) }} />
          {shelf.map((r) => (
            <Pressable key={r.id} onPress={() => open(r)} style={s.popularCard}>
              <View>
                <Image source={{ uri: r.image }} style={s.popularImage} resizeMode="cover" />
                {stateOf(r.id) === "buy" && (
                  <View style={[s.pill, s.popularPill]}><Text style={s.pillText}>{r.discount}</Text></View>
                )}
              </View>
              <View style={s.popularBody}>
                <Text style={s.popularTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={s.popularDesc} numberOfLines={2}>{r.description}</Text>
                <View style={s.popularPriceRow}>
                  {stateOf(r.id) === "buy" ? (
                    <>
                      <Text style={s.price}>₹{r.price}</Text>
                      <Text style={s.oldPrice} numberOfLines={1}>₹{r.oldPrice}</Text>
                    </>
                  ) : (
                    <StatusPill state={stateOf(r.id)} />
                  )}
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

              <View style={[s.rowPrice, stateOf(r.id) !== "buy" && s.rowPriceWide]}>
                {stateOf(r.id) === "buy" ? (
                  <>
                    <Text style={s.rowPriceText}>₹{r.price}</Text>
                    <Text style={s.rowOld}>₹{r.oldPrice}</Text>
                    <View style={[s.pill, { marginTop: px(3), marginLeft: 0 }]}><Text style={s.pillText}>{r.discount}</Text></View>
                  </>
                ) : (
                  <StatusPill state={stateOf(r.id)} />
                )}
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
  myReports: {
    flexDirection: "row",
    alignItems: "center",
    gap: px(12),
    marginBottom: px(14),
    padding: px(14),
    borderRadius: px(18),
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.BORDER,
  },
  myReportsIcon: {
    width: px(48),
    height: px(48),
    borderRadius: px(14),
    backgroundColor: C.PEACH,
    alignItems: "center",
    justifyContent: "center",
  },
  myReportsTitle: { fontSize: fs(17), fontWeight: "800", color: C.INK },
  myReportsSub: { fontSize: fs(12.5), color: C.MUTED, marginTop: px(3) },
  boughtTag: { paddingHorizontal: px(7), paddingVertical: px(2), borderRadius: px(8), backgroundColor: "#E3F4E7" },
  boughtText: { fontSize: fs(9.5), fontWeight: "800", color: "#278447", letterSpacing: 0.5 },
  ownedPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    flexShrink: 0,
    gap: px(4),
    paddingHorizontal: px(8),
    paddingVertical: px(4),
    borderRadius: px(12),
    backgroundColor: "#EFE8F7",
  },
  ownedText: { fontSize: fs(10.5), fontWeight: "800", color: C.PLUM, flexShrink: 0 },
  rowPriceWide: { width: undefined, minWidth: px(62) },
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