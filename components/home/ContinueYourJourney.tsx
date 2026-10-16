
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    Dimensions,
    Image,
    LayoutChangeEvent,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import mantrasData from "../../components/constants/mantra.json";
import reportsData from "../../components/constants/reports.json";
import { useUserStore } from "../../components/stores/userStore";
import { ChatHistoryItem, openChatSession, withAstrologerPhotos } from "../../components/utils/openChat";
import { getIncompleteReportIds } from "../../components/utils/reportJourneyStorage";
import { parseServerDate } from "../../components/utils/serverDate";
import { API_URL, authHeaders } from "../../lib/auth";
import { C as HOME, F, HOME_PAD, LIST_BOTTOM, LIST_TOP, SectionHeader, softShadow } from "./homeUi";

// Home palette (plum for the app, terracotta only for human astrologers).
const C = {
  INK: HOME.INK,
  PLUM: HOME.PLUM,
  MUTED: HOME.MUTED,
  WHITE: HOME.CARD,
  ORANGE: HOME.PLUM,
  TRACK: HOME.SOFT,
  PROGRESS_MANTRA: HOME.PLUM,
  PROGRESS_REPORT: HOME.PLUM,
  BORDER: HOME.LINE,
  TERRACOTTA: HOME.TERRACOTTA,
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCALE = Math.min(SCREEN_WIDTH / 430, 1);
const px = (value: number) => Math.round(value * SCALE);

// Match the horizontal padding of the Home screen.
const H_PAD = HOME_PAD;

const GAP = 10;
const MANTRA_FRACTION = 0.52;
const REPORT_FRACTION = 0.45;

const CHANTS_PER_MILESTONE = 108;
// Most recent chats shown here.
const RECENT_CHATS = 2;
// Same keys as the mantra screen: chants are counted per profile, across mantras.
const PENDING_PREFIX = "@mantra_pending_";
const TOTAL_PREFIX = "@mantra_total_";
const LAST_PREFIX = "@mantra_last_";

const FALLBACK_MANTRA_IMAGE = require("../../assets/images/sadhana_mars_mantra.png");
const CAREER_IMAGE = require("../../assets/backgrounds/homepage_career_report.png");

type MantraItem = {
  id: string;
  title: string;
  subtitle: string;
  chants: number;
  image?: string;
};

type RawMantra = {
  id?: string | number;
  _id?: string | number;
  mantra_id?: string | number;
  title?: string;
  name?: string;
  mantra_name?: string;
  subtitle?: string;
  description?: string;
  image?: string;
  image_url?: string;
  imageUrl?: string;
  image_uri?: string;
  imageUri?: string;
  thumbnail?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
};

type JourneyReport = {
  id: string;
  title?: string;
  name?: string;
  image?: string;
  image_url?: string;
  description?: string;
  price?: number;
};

function getMantraList(): RawMantra[] {
  const data: any = mantrasData;

  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.mantras)
      ? data.mantras
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return list.filter(
    (item: unknown): item is RawMantra =>
      typeof item === "object" && item !== null
  );
}

function getReportList(): JourneyReport[] {
  const data: any = reportsData;

  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.reports)
      ? data.reports
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return list.filter(
    (item: unknown): item is JourneyReport =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as JourneyReport).id === "string"
  );
}

function getMantraImage(item: RawMantra): string | undefined {
  return (
    item.image ??
    item.image_url ??
    item.imageUrl ??
    item.image_uri ??
    item.imageUri ??
    item.thumbnail ??
    item.thumbnail_url ??
    item.thumbnailUrl
  );
}

const chatTime = (chat: ChatHistoryItem) => {
  const value = chat.last_message_at || chat.created_at;
  const time = value ? parseServerDate(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

// "Just now", "3h ago", "Yesterday", "12 Oct".
function chatWhen(chat: ChatHistoryItem): string {
  const time = chatTime(chat);
  if (!time) return "";
  const mins = Math.floor((Date.now() - time) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h ago`;
  if (mins < 48 * 60) return "Yesterday";
  return new Date(time).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const READING_LABEL: Record<string, string> = {
  vedic: "Vedic chat",
  tarot: "Tarot chat",
  numerology: "Numerology chat",
};

export default function ContinueYourJourney() {
  const activeProfileId = useUserStore(
    (state) => state.user?.active_profile_id
  );
  const user = useUserStore((state) => state.user);
  const [chats, setChats] = useState<ChatHistoryItem[]>([]);

  const [mantras, setMantras] = useState<MantraItem[]>([]);
  const [incompleteReports, setIncompleteReports] = useState<
    JourneyReport[]
  >([]);
  const [rowWidth, setRowWidth] = useState(SCREEN_WIDTH - H_PAD * 2);

  const loadJourney = useCallback(async () => {
    try {
      // Load mantra progress for the active profile.
      if (!activeProfileId) {
        setMantras([]);
      } else {
        const definitions = getMantraList();
        const [[, pending], [, total], [, lastId]] = await AsyncStorage.multiGet([
          `${PENDING_PREFIX}${activeProfileId}`,
          `${TOTAL_PREFIX}${activeProfileId}`,
          `${LAST_PREFIX}${activeProfileId}`,
        ]);

        // Current round of 108 (saved total + chants not sent yet).
        const chanted =
          Math.max(0, Math.floor(Number(total) || 0)) +
          Math.max(0, Math.floor(Number(pending) || 0));
        const chantsInCycle = chanted % CHANTS_PER_MILESTONE;

        const idOf = (item: RawMantra) => String(item.id ?? item._id ?? item.mantra_id ?? "");
        const item =
          definitions.find((m) => lastId && idOf(m) === lastId) ?? definitions[0];

        // Hide when nothing is chanted yet or the round of 108 is complete.
        if (chantsInCycle === 0 || !item || !idOf(item)) {
          setMantras([]);
        } else {
          setMantras([
            {
              id: idOf(item),
              title: item.title ?? item.name ?? item.mantra_name ?? "Mantra",
              subtitle: item.subtitle ?? item.description ?? "Continue chanting",
              chants: chantsInCycle,
              image: getMantraImage(item),
            },
          ]);
        }
      }

      // Load incomplete reports for the active profile only.
      const incompleteReportIds = activeProfileId
        ? await getIncompleteReportIds(String(activeProfileId))
        : [];

      const reportCatalogue = getReportList();

      const reports = incompleteReportIds
        .map((id) =>
          reportCatalogue.find((report) => report.id === id)
        )
        .filter(
          (report): report is JourneyReport => Boolean(report)
        );

      setIncompleteReports(reports);
    } catch (error) {
      console.error("Failed to load Continue Your Journey:", error);
      setMantras([]);
      setIncompleteReports([]);
    }

    // Last chats of this profile (newest first).
    try {
      if (!activeProfileId) {
        setChats([]);
        return;
      }
      const response = await fetch(
        `${API_URL}/chat/history?profile_id=${encodeURIComponent(String(activeProfileId))}`,
        { headers: await authHeaders() }
      );
      const data = await response.json().catch(() => ({}));
      const sessions: ChatHistoryItem[] =
        response.ok && Array.isArray(data?.sessions) ? data.sessions : [];
      setChats(
        await withAstrologerPhotos(
          sessions
            .filter((chat) => chat?.session_id && chat.last_message)
            .sort((a, b) => chatTime(b) - chatTime(a))
            .slice(0, RECENT_CHATS)
        )
      );
    } catch (error) {
      console.warn("Could not load recent chats:", error);
      setChats([]);
    }
  }, [activeProfileId]);

  useFocusEffect(
    useCallback(() => {
      void loadJourney();
    }, [loadJourney])
  );

  const openMantra = (mantraId: string) => {
    router.push({
      pathname: "/(root)/mantra/[mantra_id]",
      params: { mantra_id: mantraId },
    } as any);
  };

  const openMantraList = () => {
    router.push("/(root)/(tabs)/mantra" as any);
  };

  const openReport = (reportId: string) => {
    router.push({
      pathname: "/(root)/report/[report_id]",
      params: { report_id: reportId },
    } as any);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    setRowWidth(e.nativeEvent.layout.width);
  };

  // Hide the whole section if this profile has no unfinished activity.
  if (mantras.length === 0 && incompleteReports.length === 0 && chats.length === 0) {
    return null;
  }

  const mantraW = Math.round(rowWidth * MANTRA_FRACTION);
  const reportW = Math.round(rowWidth * REPORT_FRACTION);
  const u = mantraW;

  const cardPad = Math.round(u * 0.055);
  const cardGap = Math.round(u * 0.05);
  const cardRadius = Math.round(u * 0.08);
  const cardMinH = Math.round(u * 0.4);

  const textSize = Math.round(u * 0.056);
  const textLH = Math.round(u * 0.074);
  const barH = Math.max(4, Math.round(u * 0.022));

  const mantraImg = Math.round(u * 0.27);
  const playSize = Math.round(u * 0.18);
  const reportImgW = Math.round(u * 0.2);
  const reportImgH = Math.round(u * 0.26);
  const arrowSize = Math.round(u * 0.14);

  const cardStyle = {
    minHeight: cardMinH,
    borderRadius: Math.max(cardRadius, 20),
    padding: cardPad,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: C.WHITE,
    borderWidth: 1,
    borderColor: C.BORDER,
    ...softShadow,
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      <SectionHeader overline="PICK UP WHERE YOU LEFT OFF" title="Continue your journey" />
      <View style={styles.header}>

        {/* <TouchableOpacity
          accessibilityRole="button"
          onPress={openMantraList}
          style={styles.viewAll}
          activeOpacity={0.8}
        >
          <Text style={styles.viewAllText}>View all</Text>
          <Icon name="arrow-right" size={px(18)} color={C.PLUM} />
        </TouchableOpacity> */}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -H_PAD }}
        contentContainerStyle={[
          styles.cards,
          { paddingHorizontal: H_PAD, gap: GAP },
        ]}
      >
        {mantras.map((mantra) => {
          const progress = Math.min(
            100,
            (mantra.chants / CHANTS_PER_MILESTONE) * 100
          );

          return (
            <TouchableOpacity
              key={mantra.id}
              accessibilityRole="button"
              accessibilityLabel={`${mantra.title}, ${mantra.chants} of 108 chants`}
              activeOpacity={0.85}
              onPress={() => openMantra(mantra.id)}
              style={{ ...cardStyle, width: mantraW }}
            >
              <Image
                source={
                  mantra.image
                    ? { uri: mantra.image }
                    : FALLBACK_MANTRA_IMAGE
                }
                resizeMode="cover"
                style={{
                  width: mantraImg,
                  height: mantraImg,
                  borderRadius: mantraImg / 2,
                  backgroundColor: "#F5F0F9",
                  marginRight: cardGap,
                }}
              />

              <View style={styles.content}>
                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={[
                    styles.label,
                    { fontSize: textSize, lineHeight: textLH },
                  ]}
                >
                  Sadhana
                </Text>

                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={[
                    styles.title,
                    { fontSize: textSize, lineHeight: textLH },
                  ]}
                >
                  {mantra.title}
                </Text>

                <View
                  style={[
                    styles.progressTrack,
                    {
                      height: barH,
                      borderRadius: barH,
                      marginTop: Math.round(u * 0.03),
                    },
                  ]}
                >
                  <View
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      borderRadius: barH,
                      backgroundColor: C.PROGRESS_MANTRA,
                    }}
                  />
                </View>

                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={[
                    styles.meta,
                    {
                      fontSize: Math.round(u * 0.052),
                      lineHeight: textLH,
                      marginTop: Math.round(u * 0.025),
                    },
                  ]}
                >
                  Chants {mantra.chants}/{CHANTS_PER_MILESTONE}
                </Text>
              </View>

              <View
                style={{
                  width: playSize,
                  height: playSize,
                  borderRadius: playSize / 2,
                  backgroundColor: C.ORANGE,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginLeft: cardGap,
                  shadowColor: C.ORANGE,
                  shadowOpacity: 0.25,
                  shadowRadius: 5,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 3,
                }}
              >
                <Icon
                  name="play"
                  size={Math.round(playSize * 0.55)}
                  color={C.WHITE}
                />
              </View>
            </TouchableOpacity>
          );
        })}

        {chats.map((chat) => {
          const name = chat.astrologer_name?.trim() || "Astrologer";
          const photo = chat.astrologer_image_url || chat.astrologer_image || undefined;
          const kind =
            chat.participant_type === "human"
              ? "Astrologer chat"
              : READING_LABEL[chat.reading_type || ""] || "Chat";
          const when = chatWhen(chat);

          return (
            <TouchableOpacity
              key={chat.session_id}
              accessibilityRole="button"
              accessibilityLabel={`Continue chat with ${name}`}
              activeOpacity={0.85}
              onPress={() => openChatSession(chat, user)}
              style={{ ...cardStyle, width: mantraW }}
            >
              {photo ? (
                <Image
                  source={{ uri: photo }}
                  resizeMode="cover"
                  style={{
                    width: mantraImg,
                    height: mantraImg,
                    borderRadius: mantraImg / 2,
                    backgroundColor: "#F5F0F9",
                    marginRight: cardGap,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: mantraImg,
                    height: mantraImg,
                    borderRadius: mantraImg / 2,
                    backgroundColor: "#F1EAF7",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: cardGap,
                  }}
                >
                  <Text style={{ color: C.PLUM, fontFamily: F.bold, fontSize: Math.round(mantraImg * 0.4) }}>
                    {name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.content}>
                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={[styles.label, { fontSize: textSize, lineHeight: textLH }]}
                >
                  {kind}
                </Text>

                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={[styles.title, { fontSize: textSize, lineHeight: textLH }]}
                >
                  {name}
                </Text>

                {!!when && (
                  <Text
                    numberOfLines={1}
                    allowFontScaling={false}
                    style={[
                      styles.meta,
                      { fontSize: Math.round(u * 0.05), lineHeight: textLH, marginTop: Math.round(u * 0.02) },
                    ]}
                  >
                    {when}
                  </Text>
                )}
              </View>

              <View
                style={{
                  width: playSize,
                  height: playSize,
                  borderRadius: playSize / 2,
                  backgroundColor: chat.participant_type === "human" ? C.TERRACOTTA : C.PLUM,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginLeft: cardGap,
                }}
              >
                <Icon name="chat-processing-outline" size={Math.round(playSize * 0.5)} color={C.WHITE} />
              </View>
            </TouchableOpacity>
          );
        })}

        {incompleteReports.map((report) => {
          const reportImage = report.image ?? report.image_url;

          return (
            <TouchableOpacity
              key={report.id}
              accessibilityRole="button"
              accessibilityLabel={`Continue ${
                report.title ?? report.name ?? "report"
              }`}
              activeOpacity={0.85}
              onPress={() => openReport(report.id)}
              style={{ ...cardStyle, width: reportW }}
            >
              {reportImage ? (
                <Image
                  source={{ uri: reportImage }}
                  resizeMode="cover"
                  style={{
                    width: reportImgW,
                    height: reportImgH,
                    borderRadius: Math.round(u * 0.03),
                    backgroundColor: "#F5F0F9",
                    marginRight: cardGap,
                  }}
                />
              ) : (
                <Image
                  source={CAREER_IMAGE}
                  resizeMode="contain"
                  style={{
                    width: reportImgW,
                    height: reportImgH,
                    marginRight: cardGap,
                  }}
                />
              )}

              <View style={styles.content}>
                <Text
                  numberOfLines={2}
                  allowFontScaling={false}
                  style={[
                    styles.title,
                    { fontSize: textSize, lineHeight: textLH },
                  ]}
                >
                  {report.title ?? report.name ?? "Report"}
                </Text>

                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={[
                    styles.meta,
                    {
                      fontSize: Math.round(u * 0.052),
                      lineHeight: textLH,
                      marginTop: Math.round(u * 0.01),
                    },
                  ]}
                >
                  Continue your report
                </Text>

                <View
                  style={[
                    styles.progressTrack,
                    {
                      height: barH,
                      borderRadius: barH,
                      marginTop: Math.round(u * 0.03),
                    },
                  ]}
                >
                  <View
                    style={{
                      width: "60%",
                      height: "100%",
                      borderRadius: barH,
                      backgroundColor: C.PROGRESS_REPORT,
                    }}
                  />
                </View>
              </View>

              <View
                style={{
                  width: arrowSize,
                  height: arrowSize,
                  borderRadius: arrowSize / 2,
                  backgroundColor: C.WHITE,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginLeft: cardGap,
                  borderWidth: 1,
                  borderColor: "rgba(229,220,235,0.9)",
                  shadowColor: "#2B1A3D",
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
              >
                <Icon
                  name="chevron-right"
                  size={Math.round(arrowSize * 0.7)}
                  color={C.INK}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerText: {
    flex: 1,
    minWidth: 0,
    paddingRight: px(6),
  },

  heading: {
    fontSize: px(19),
    lineHeight: px(25),
    fontFamily: F.bold,
    color: C.INK,
  },

  subtitle: {
    fontSize: px(13),
    lineHeight: px(18),
    color: C.MUTED,
    marginTop: px(2),
  },

  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: px(6),
    paddingLeft: px(4),
  },

  viewAllText: {
    fontSize: px(14),
    fontFamily: F.semibold,
    color: C.PLUM,
  },

  cards: {
    alignItems: "stretch",
    paddingTop: LIST_TOP,
    paddingBottom: LIST_BOTTOM,
  },

  content: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },

  label: {
    fontFamily: F.semibold,
    color: C.MUTED,
    letterSpacing: 0.2,
  },

  title: {
    fontFamily: F.bold,
    color: C.INK,
  },

  meta: {
    fontFamily: F.regular,
    color: C.MUTED,
  },

  progressTrack: {
    width: "100%",
    backgroundColor: C.TRACK,
    overflow: "hidden",
  },
});
