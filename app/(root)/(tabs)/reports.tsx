// app/(root)/(tabs)/reports.tsx
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  Platform,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AUTH_FONTS, F } from "../../../components/auth/theme";
import reportsData from "../../../components/constants/reports.json";
import {
  C,
  CardArt,
  HOME_PAD,
  LIST_TOP,
  SectionHeader,
  softShadow,
} from "../../../components/home/homeUi";
import { loadProfileReports, loadReportHistory, useReportsStore } from "../../../components/stores/reportsStore";
import { useUserStore } from "../../../components/stores/userStore";
import TopBar from "../../../components/TopBar";
import { useTabBarSpace } from "../../../components/utils/tabBar";
import { track, useScreenTime } from "../../../lib/analytics";

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

const reports: Report[] = reportsData as Report[];

const byId = (id: string) => reports.find((r) => r.id === id);
const topReports = ["kundli-milan", "career", "marriage", "true-love"].map(byId).filter(Boolean) as Report[];

const tabs = [
  { id: "all", label: "All" },
  { id: "Monthly", label: "Monthly" },
  { id: "One time", label: "One time" },
] as const;

const SCREEN_W = Dimensions.get("window").width;
const CONTENT_W = SCREEN_W - HOME_PAD * 2;
const FEATURE_IMAGE_H = Math.round(CONTENT_W / 2.4); // covers are 1200 x 500

// Sections rise in one after another (as on Home).
const enter = (index: number) => FadeInDown.delay(70 * index).duration(420);

// Opens a report's page. Analytics: a report already bought for this
// profile is its own event (purchased_report_clicked), others report_clicked.
const open = (r: Report, section: "featured" | "all_reports", status: string) => {
  track(status === "purchased" ? "purchased_report_clicked" : "report_clicked", {
    report_id: r.id,
    report_title: r.title,
    price: r.price,
    section,
    status,
    platform: Platform.OS,
  });
  router.push({ pathname: "/report/[report_id]", params: { report_id: r.id } });
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
  const look =
    state === "purchased"
      ? { icon: "check-decagram", text: "Purchased", color: C.PLUM, bg: C.SOFT }
      : state === "preparing"
        ? { icon: "progress-clock", text: "Preparing", color: C.PLUM, bg: C.SOFT }
        : { icon: "clock-outline", text: "Coming soon", color: C.MUTED, bg: C.IVORY };
  return (
    <View style={[s.statusPill, { backgroundColor: look.bg }]}>
      <Icon name={look.icon as any} size={12} color={look.color} />
      <Text style={[s.statusText, { color: look.color }]} numberOfLines={1}>
        {look.text}
      </Text>
    </View>
  );
}

function Price({ report, big = false }: { report: Report; big?: boolean }) {
  return (
    <View style={s.priceRow}>
      <Text style={big ? s.priceBig : s.price}>₹{report.price}</Text>
      {report.oldPrice > report.price && <Text style={s.oldPrice}>₹{report.oldPrice}</Text>}
      {!!report.discount && (
        <View style={s.discount}>
          <Text style={s.discountText}>{report.discount}</Text>
        </View>
      )}
    </View>
  );
}

/* Entry to My Reports: only shown once the account has bought a report. */
function MyReportsCard() {
  const [count, setCount] = useState(0);
  const profileId = useUserStore((state) => state.user?.active_profile_id);

  // The selected profile's reports only.
  useFocusEffect(
    useCallback(() => {
      void loadReportHistory(profileId).then((rows) => setCount(rows.length));
    }, [profileId])
  );

  if (count === 0) return null;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => router.push("/report/my-reports")} style={s.myReports}>
      <View style={s.myReportsClip}>
        <CardArt width={130} height={90} color={C.CARD} />
        <View style={s.myReportsIcon}>
          <Icon name="book-open-page-variant-outline" size={20} color={C.CARD} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.myReportsTitle}>My Reports</Text>
          <Text style={s.myReportsSub}>
            {count} report{count === 1 ? "" : "s"} ready to read
          </Text>
        </View>
        <View style={s.myReportsArrow}>
          <Icon name="arrow-right" size={16} color={C.PLUM} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function Reports() {
  // Analytics: visited_reports + reports_time_spent.
  useScreenTime("reports");

  const tabSpace = useTabBarSpace();
  const stateOf = useReportState();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts(AUTH_FONTS);


  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("all");
  const list = useMemo(() => (tab === "all" ? reports : reports.filter((r) => r.frequency === tab)), [tab]);

  // Which featured card is showing (for the dots).
  const [page, setPage] = useState(0);
  const onFeatureScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / (CONTENT_W + 12));
    if (next !== page) setPage(next);
  };

  return (
    <View style={s.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: HOME_PAD, paddingTop: insets.top + 4, paddingBottom: tabSpace + 24 }}
      >
        <TopBar />

        {/* Brand fonts first, so text doesn't jump from the system font. */}
        {fontsLoaded && (
          <>
            <Reanimated.View entering={enter(0)}>
              <Text style={s.title}>Reports</Text>
              <Text style={s.subtitle}>In-depth guidance for a more aligned tomorrow</Text>
              <MyReportsCard />
            </Reanimated.View>

            {/* Featured */}
            <Reanimated.View entering={enter(1)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={CONTENT_W + 12}
                snapToAlignment="start"
                onScroll={onFeatureScroll}
                scrollEventThrottle={32}
                style={{ marginHorizontal: -HOME_PAD }}
                contentContainerStyle={{ paddingHorizontal: HOME_PAD, paddingTop: LIST_TOP, paddingBottom: 10, gap: 12 }}
              >
                {topReports.map((r) => {
                  const state = stateOf(r.id);
                  return (
                    <TouchableOpacity key={r.id} activeOpacity={0.92} onPress={() => open(r, "featured", state)} style={s.feature}>
                      <View style={s.featureClip}>
                        <View style={{ height: FEATURE_IMAGE_H }}>
                          <Image source={{ uri: r.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                          <View style={s.featureTag}>
                            <Icon name="star-four-points" size={11} color={C.GOLD} />
                            <Text style={s.featureTagText}>Recommended for you</Text>
                          </View>
                        </View>
                        <View style={s.featureBody}>
                          <Text style={s.featureTitle} numberOfLines={1}>
                            {r.title}
                          </Text>
                          <Text style={s.featureDesc} numberOfLines={2}>
                            {r.description}
                          </Text>
                          <View style={s.featureFoot}>
                            {state === "buy" ? <Price report={r} big /> : <StatusPill state={state} />}
                            <View style={s.viewBtn}>
                              <Text style={s.viewBtnText}>View report</Text>
                              <Icon name="arrow-right" size={14} color={C.CARD} />
                            </View>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={s.dots}>
                {topReports.map((r, i) => (
                  <View key={r.id} style={[s.dot, i === page && s.dotActive]} />
                ))}
              </View>
            </Reanimated.View>

            {/* All reports */}
            <Reanimated.View entering={enter(2)}>
              <SectionHeader title="All reports" />
              <View style={s.segment}>
                {tabs.map((t) => {
                  const active = t.id === tab;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      activeOpacity={0.85}
                      onPress={() => setTab(t.id)}
                      style={[s.segmentItem, active && s.segmentItemActive]}
                    >
                      <Text style={[s.segmentText, active && { color: C.CARD }]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ gap: 10 }}>
                {list.map((r) => {
                  const state = stateOf(r.id);
                  return (
                    <TouchableOpacity key={r.id} activeOpacity={0.92} onPress={() => open(r, "all_reports", state)} style={s.row}>
                      <Image source={{ uri: r.image }} style={s.thumb} resizeMode="cover" />
                      <View style={s.rowBody}>
                        <Text style={s.rowTitle} numberOfLines={1}>
                          {r.title}
                        </Text>
                        <Text style={s.rowDesc} numberOfLines={2}>
                          {r.description}
                        </Text>
                        <View style={s.rowFoot}>
                          <View style={s.freq}>
                            <Icon name={(r.icon || "calendar-outline") as any} size={11} color={C.PLUM} />
                            <Text style={s.freqText}>{r.frequency}</Text>
                          </View>
                          {state === "buy" ? (
                            <View style={s.rowPrice}>
                              <Text style={s.price}>₹{r.price}</Text>
                              {r.oldPrice > r.price && <Text style={s.oldPrice}>₹{r.oldPrice}</Text>}
                            </View>
                          ) : (
                            <StatusPill state={state} />
                          )}
                        </View>
                      </View>
                      <Icon name="chevron-right" size={20} color={C.MUTED} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Reanimated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.LAVENDER },
  title: { marginTop: 14, color: C.INK, fontSize: 26, fontFamily: F.bold, letterSpacing: -0.4 },
  subtitle: { marginTop: 2, marginBottom: 14, color: C.MUTED, fontSize: 13.5, fontFamily: F.regular },

  myReports: { marginBottom: 16, borderRadius: 20, backgroundColor: C.PLUM, ...softShadow, shadowOpacity: 0.2 },
  myReportsClip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: C.PLUM,
  },
  myReportsIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,253,252,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,253,252,0.24)",
  },
  myReportsTitle: { color: C.CARD, fontSize: 16, fontFamily: F.bold },
  myReportsSub: { marginTop: 2, color: "rgba(255,253,252,0.72)", fontSize: 12.5, fontFamily: F.regular },
  myReportsArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.CARD, alignItems: "center", justifyContent: "center" },

  feature: { width: CONTENT_W, borderRadius: 24, backgroundColor: C.CARD, ...softShadow },
  featureClip: { borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: C.LINE, backgroundColor: C.CARD },
  featureTag: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(255,253,252,0.94)",
  },
  featureTagText: { color: C.PLUM, fontSize: 11, fontFamily: F.semibold },
  featureBody: { padding: 16 },
  featureTitle: { color: C.INK, fontSize: 19, fontFamily: F.bold, letterSpacing: -0.2 },
  featureDesc: { marginTop: 4, color: C.MUTED, fontSize: 13.5, lineHeight: 19, fontFamily: F.regular },
  featureFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 14 },
  viewBtn: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: C.PLUM,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  viewBtnText: { color: C.CARD, fontSize: 13, fontFamily: F.bold },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(43,26,61,0.18)" },
  dotActive: { width: 18, backgroundColor: C.PLUM },

  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  priceBig: { color: C.INK, fontSize: 20, fontFamily: F.bold },
  price: { color: C.INK, fontSize: 16, fontFamily: F.bold },
  oldPrice: { color: C.MUTED, fontSize: 12, fontFamily: F.regular, textDecorationLine: "line-through" },
  discount: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: "#E6F2EA" },
  discountText: { color: "#2E7D4F", fontSize: 10, fontFamily: F.semibold },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11.5, fontFamily: F.semibold },

  segment: {
    flexDirection: "row",
    marginBottom: 12,
    padding: 4,
    borderRadius: 999,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.BORDER,
  },
  segmentItem: { flex: 1, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segmentItemActive: { backgroundColor: C.PLUM },
  segmentText: { color: C.MUTED, fontSize: 13, fontFamily: F.semibold },

  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 20,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    ...softShadow,
    shadowOpacity: 0.05,
  },
  thumb: { width: 96, height: 72, borderRadius: 14, backgroundColor: C.SOFT },
  rowBody: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
  rowTitle: { color: C.INK, fontSize: 15, fontFamily: F.bold },
  rowDesc: { marginTop: 2, color: C.MUTED, fontSize: 12, lineHeight: 16.5, fontFamily: F.regular },
  rowFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 },
  freq: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: C.SOFT,
  },
  freqText: { color: C.PLUM, fontSize: 11, fontFamily: F.semibold },
  rowPrice: { flexDirection: "row", alignItems: "baseline", gap: 5 },
});
