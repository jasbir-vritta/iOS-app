import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CosmicLoader from "../../../components/CosmicLoader";
import reportsData from "../../../components/constants/reports.json";
import useProfilesStore from "../../../components/stores/profilesStore";
import {
  loadReportHistory,
  openReport,
  ReportOrder,
} from "../../../components/stores/reportsStore";
import { useUserStore } from "../../../components/stores/userStore";
import { Text } from "../../../components/ui/BrandText";

// App palette.
const C = {
  ink: "#1C1820",
  muted: "#68616A",
  bg: "#F4F0F8",
  card: "#FFFDFC",
  line: "rgba(217,206,193,0.7)",
  accent: "#2B1A3D",
  gold: "#C49A4A",
  soft: "#EFE8F7",
  green: "#2E7D4F",
  greenSoft: "#E6F2EA",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "15 Oct 2026, 6:13 PM" in IST.
const formatWhen = (value?: string) => {
  const ms = Date.parse(value?.endsWith("Z") || value?.includes("+") ? value : `${value}Z`);
  if (!Number.isFinite(ms)) return "";
  const ist = new Date(ms + 330 * 60 * 1000);
  const h = ist.getUTCHours();
  const m = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} ${ist.getUTCFullYear()}, ${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`;
};

const reportInfo = (id: string) =>
  (reportsData as { id: string; title: string; image: string }[]).find((r) => r.id === id);

export default function MyReports() {
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<ReportOrder[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Only the selected profile's reports.
  const profileId = useUserStore((state) => state.user?.active_profile_id);
  const profileName = useProfilesStore(
    (state) => state.profiles.find((p) => p.profile_id === profileId)?.name?.trim() || ""
  );

  const load = useCallback(async () => {
    setReports(await loadReportHistory(profileId));
  }, [profileId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const view = async (item: ReportOrder) => {
    try {
      await openReport(item);
    } catch {
      Alert.alert("Couldn't open the report", "Please try again.");
    }
  };

  const count = reports?.length ?? 0;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.back} accessibilityLabel="Go back">
          <Icon name="chevron-left" size={24} color={C.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>My reports</Text>
          <Text style={s.subtitle} numberOfLines={1}>
            {profileName ? `Reports for ${profileName}` : "Your reports"}
          </Text>
        </View>
      </View>

      {reports === null ? (
        <View style={s.center}>
          <CosmicLoader size={130} />
          <Text style={s.loadingText}>Gathering your reports…</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.order_id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.accent} />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponent={
            count > 0 ? <Text style={s.overline}>{`${count} REPORT${count === 1 ? "" : "S"}`}</Text> : null
          }
          ListEmptyComponent={
            <View style={s.center}>
              <View style={s.emptyIcon}>
                <Icon name="file-document-outline" size={28} color={C.accent} />
              </View>
              <Text style={s.emptyTitle}>No reports yet</Text>
              <Text style={s.emptyText}>
                {profileName ? `Reports you buy for ${profileName} will appear here.` : "Reports you buy will appear here."}
              </Text>
              <Pressable onPress={() => router.back()} style={s.emptyButton}>
                <Icon name="star-four-points-outline" size={16} color={C.card} />
                <Text style={s.viewText}>Browse reports</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item, index }) => {
            const info = reportInfo(item.report_id);
            const ready = item.status === "completed" && Boolean(item.html_url || item.pdf_url);
            const forWhom = [
              item.profile_name || "Profile",
              item.partner_name ? `& ${item.partner_name}` : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <Reanimated.View entering={FadeInDown.delay(Math.min(index, 6) * 60).duration(380)}>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: "/report/[report_id]", params: { report_id: item.report_id } })
                  }
                  style={s.row}
                >
                  <View style={s.cover}>
                    {!!info?.image && <Image source={{ uri: info.image }} style={s.coverImage} resizeMode="cover" />}
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={[s.status, ready ? s.statusReady : s.statusWriting]}>
                      <Icon
                        name={ready ? "check-circle" : "progress-clock"}
                        size={12}
                        color={ready ? C.green : C.accent}
                      />
                      <Text style={[s.statusText, { color: ready ? C.green : C.accent }]}>
                        {ready ? "Ready" : "Being written"}
                      </Text>
                    </View>

                    <Text style={s.name} numberOfLines={2}>
                      {item.report_name || info?.title || "Report"}
                    </Text>

                    <Text style={s.meta} numberOfLines={1}>
                      For <Text style={s.metaStrong}>{forWhom}</Text>
                      {item.child_name ? <Text style={s.metaStrong}>{` · Child: ${item.child_name}`}</Text> : null}
                    </Text>

                    <View style={s.chips}>
                      <View style={s.chip}>
                        <Icon name="translate" size={11} color={C.muted} />
                        <Text style={s.chipText}>{item.language || "English"}</Text>
                      </View>
                      <Text style={s.date} numberOfLines={1}>
                        {formatWhen(item.created_at)}
                      </Text>
                    </View>

                    {ready ? (
                      <Pressable onPress={() => view(item)} style={s.viewButton}>
                        <Icon name="book-open-page-variant-outline" size={15} color={C.card} />
                        <Text style={s.viewText}>Open report</Text>
                      </Pressable>
                    ) : (
                      <View style={s.preparing}>
                        <CosmicLoader size={36} />
                        <Text style={s.preparingText}>Usually ready in 2–5 minutes</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              </Reanimated.View>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  title: { color: C.ink, fontSize: 21, fontWeight: "700", letterSpacing: -0.3 },
  subtitle: { marginTop: 1, color: C.muted, fontSize: 12.5 },

  overline: { marginTop: 4, marginBottom: 10, fontSize: 11, fontWeight: "700", letterSpacing: 1.3, color: C.gold },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 24 },
  loadingText: { color: C.muted, fontSize: 13.5, marginTop: 14 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  emptyTitle: { color: C.ink, fontSize: 17, fontWeight: "700", marginTop: 14 },
  emptyText: { color: C.muted, fontSize: 13.5, marginTop: 6, textAlign: "center" },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: C.accent,
  },

  row: {
    flexDirection: "row",
    gap: 14,
    padding: 12,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: C.accent,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cover: {
    width: 92,
    height: 118,
    borderRadius: 14,
    backgroundColor: C.soft,
    overflow: "hidden",
  },
  coverImage: { width: "100%", height: "100%" },

  status: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusReady: { backgroundColor: C.greenSoft },
  statusWriting: { backgroundColor: C.soft },
  statusText: { fontSize: 10.5, fontWeight: "700" },

  name: { marginTop: 6, color: C.ink, fontSize: 16, lineHeight: 21, fontWeight: "700" },
  meta: { marginTop: 3, color: C.muted, fontSize: 12.5 },
  metaStrong: { color: C.ink, fontWeight: "600" },

  chips: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.bg,
  },
  chipText: { color: C.muted, fontSize: 11, fontWeight: "600" },
  date: { flex: 1, color: C.muted, fontSize: 11 },

  viewButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: C.accent,
  },
  viewText: { color: C.card, fontSize: 13.5, fontWeight: "700" },
  preparing: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  preparingText: { color: C.accent, fontSize: 12, fontWeight: "600" },
});
