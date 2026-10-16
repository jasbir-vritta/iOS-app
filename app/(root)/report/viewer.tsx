import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CosmicLoader from "../../../components/CosmicLoader";
import { C, F, HOME_PAD } from "../../../components/home/homeUi";
import { hasInAppViewer } from "../../../components/utils/reportViewer";
import { useScreenTime } from "../../../lib/analytics";

// Loaded only when the build has it (older builds open reports in the browser).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebView = hasInAppViewer() ? require("react-native-webview").WebView : null;

/* A bought report inside the app: no address bar, no browser download/share. */
export default function ReportViewer() {
  const insets = useSafeAreaInsets();
  const { url, title, report_id, sample } = useLocalSearchParams<{
    url?: string;
    title?: string;
    report_id?: string;
    sample?: string;
  }>();

  // Analytics: visited_report_pdf + report_pdf_time_spent while reading.
  useScreenTime("report_pdf", {
    report_id: String(report_id || ""),
    is_sample: String(sample === "1"),
    viewer: "in_app",
  });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(root)/report/my-reports"));

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={goBack} style={s.back} hitSlop={8} accessibilityLabel="Go back">
          <Icon name="chevron-left" size={24} color={C.INK} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>
          {title || "Your report"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.body}>
        {WebView && url && !failed ? (
          <WebView
            source={{ uri: String(url) }}
            style={s.web}
            originWhitelist={["https://*"]}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
            // Stay on the report: links to other sites aren't followed.
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures={false}
          />
        ) : (
          <View style={s.center}>
            <Icon name="file-alert-outline" size={36} color={C.PLUM} />
            <Text style={s.failTitle}>Couldn’t open the report</Text>
            <Text style={s.failText}>Please check your connection and try again.</Text>
            <TouchableOpacity onPress={goBack} style={s.failBtn}>
              <Text style={s.failBtnText}>Go back</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && WebView && url && !failed && (
          <View style={[StyleSheet.absoluteFill, s.center, { backgroundColor: C.LAVENDER }]} pointerEvents="none">
            <CosmicLoader size={120} />
            <Text style={s.loadingText}>Opening your report…</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.LAVENDER },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: HOME_PAD,
    paddingTop: 6,
    paddingBottom: 10,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  title: { flex: 1, textAlign: "center", color: C.INK, fontSize: 16, fontFamily: F.bold },
  body: { flex: 1, overflow: "hidden", borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: C.CARD },
  web: { flex: 1, backgroundColor: C.CARD },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 8 },
  loadingText: { marginTop: 8, color: C.MUTED, fontSize: 13.5, fontFamily: F.medium },
  failTitle: { marginTop: 6, color: C.INK, fontSize: 17, fontFamily: F.bold },
  failText: { color: C.MUTED, fontSize: 13.5, fontFamily: F.regular, textAlign: "center" },
  failBtn: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: C.PLUM },
  failBtnText: { color: C.CARD, fontSize: 13.5, fontFamily: F.semibold },
});
