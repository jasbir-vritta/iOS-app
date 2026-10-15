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
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CosmicLoader from "../../../components/CosmicLoader";
import reportsData from "../../../components/constants/reports.json";
import {
  loadReportHistory,
  openReport,
  ReportOrder,
} from "../../../components/stores/reportsStore";

// App palette.
const C = {
  ink: "#1C1820",
  muted: "#68616A",
  bg: "#F4F0F8",
  card: "#FFFDFC",
  line: "#D9CEC1",
  accent: "#2B1A3D",
  gold: "#C49A4A",
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

  const load = useCallback(async () => {
    setReports(await loadReportHistory());
  }, []);

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

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          <Icon name="arrow-left" size={24} color={C.ink} />
        </Pressable>
        <Text style={s.title}>My Reports</Text>
        <View style={s.back} />
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
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.accent} />}
          ItemSeparatorComponent={() => <View style={{ height: 22 }} />}
          ListEmptyComponent={
            <View style={s.center}>
              <Icon name="file-document-outline" size={46} color={C.muted} />
              <Text style={s.emptyTitle}>No reports yet</Text>
              <Text style={s.emptyText}>Reports you buy will appear here.</Text>
              <Pressable onPress={() => router.back()} style={s.viewButton}>
                <Text style={s.viewText}>Browse reports</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const info = reportInfo(item.report_id);
            const ready = item.status === "completed" && Boolean(item.html_url || item.pdf_url);

            return (
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/report/[report_id]", params: { report_id: item.report_id } })
                }
                style={s.row}
              >
                <View style={s.cover}>
                  {!!info?.image && <Image source={{ uri: info.image }} style={s.coverImage} resizeMode="cover" />}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={2}>
                    {item.report_name || info?.title || "Report"}
                  </Text>
                  <Text style={s.meta}>
                    For: <Text style={{ color: C.ink }}>{item.profile_name || "Profile"}</Text>
                    {!!item.partner_name && (
                      <Text style={{ color: C.ink }}>{` & ${item.partner_name}`}</Text>
                    )}
                    {!!item.child_name && (
                      <Text style={{ color: C.ink }}>{` · Child: ${item.child_name}`}</Text>
                    )}
                  </Text>
                  <Text style={s.meta}>
                    {item.language || "English"}  •  {formatWhen(item.created_at)}
                  </Text>

                  {ready ? (
                    <Pressable onPress={() => view(item)} style={s.viewButton}>
                      <Text style={s.viewText}>View</Text>
                    </Pressable>
                  ) : (
                    <View style={s.preparing}>
                      <CosmicLoader size={40} />
                      <Text style={s.preparingText}>Writing your report…</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: C.ink, fontSize: 22, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyTitle: { color: C.ink, fontSize: 18, fontWeight: "800", marginTop: 14 },
  emptyText: { color: C.muted, fontSize: 14, marginTop: 6 },

  loadingText: { color: C.muted, fontSize: 14, marginTop: 14 },
  row: {
    flexDirection: "row",
    gap: 16,
    padding: 14,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: C.accent,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cover: {
    width: 96,
    height: 120,
    borderRadius: 10,
    backgroundColor: C.bg,
    overflow: "hidden",
    shadowColor: C.accent,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 2, height: 6 },
    elevation: 4,
  },
  coverImage: { width: "100%", height: "100%" },
  name: { color: C.ink, fontSize: 18, fontWeight: "800" },
  meta: { color: C.muted, fontSize: 14, marginTop: 6 },
  viewButton: {
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 24,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: C.accent,
  },
  viewText: { color: C.card, fontSize: 15, fontWeight: "700" },
  preparing: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  preparingText: { color: C.accent, fontSize: 14, fontWeight: "600" },
});
