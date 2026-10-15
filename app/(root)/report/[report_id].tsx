import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Dimensions,
    Image,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import reportsData from "../../../components/constants/reports.json";
import CosmicLoader from "../../../components/CosmicLoader";
import ConfirmReportSheet from "../../../components/reports/ConfirmReportSheet";
import WritingReportSheet from "../../../components/reports/WritingReportSheet";
import useProfilesStore from "../../../components/stores/profilesStore";
import {
    loadProfileReports,
    openReport as openReportPage,
    purchaseReport,
    ReportPurchaseError,
    useReportsStore,
} from "../../../components/stores/reportsStore";
import { refreshWalletCredits, useUserStore } from "../../../components/stores/userStore";
import {
    addIncompleteReport,
    removeIncompleteReport,
} from "../../../components/utils/reportJourneyStorage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const C = {
  ink: "#1C1820",
  plum: "#2B1A3D",
  terracotta: "#A94C36",
  gold: "#C49A4A",
  card: "#FFFDFC",
  ivory: "#F7F1E8",
  secondary: "#68616A",
  border: "#D9CEC1",
  peach: "#FCE4D6",
  white: "#FFFFFF",
};

const PAGE_BG = "#FCF1E9";
const FEATURE_WIDTH = (SCREEN_WIDTH - 24) / 4;
const RELATED_WIDTH = (SCREEN_WIDTH - 32 - 10) / 2;
const HERO_HEIGHT = SCREEN_WIDTH * 0.8;
const HERO_SHIFT = 165;

type ReportFeature = {
  label: string;
  icon: string;
};

type ReportDiscovery = {
  icon: string;
  text: string;
};

type Testimonial = {
  name: string;
  city: string;
  avatar?: string;
  text: string;
};

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
  features?: ReportFeature[];
  questions?: string[];
  discoveries?: ReportDiscovery[];
  testimonial?: Testimonial;
  testimonials?: Testimonial[];
  relatedReports?: string[];
};

const reports = reportsData as Report[];

// Shared empty values: store selectors must return the same object each
// time, or React re-renders forever.
const NO_NAMES: string[] = [];
const NO_LANGUAGES: Record<string, string> = {};

function SectionTitle({
  title,
  icon,
}: {
  title: string;
  icon: string;
}) {
  return (
    <View style={s.sectionHeading}>
      <Icon name={icon as any} size={19} color={C.ink} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function CircleIcon({
  name,
  size = 22,
  diameter = 40,
}: {
  name: string;
  size?: number;
  diameter?: number;
}) {
  return (
    <View
      style={[
        s.iconCircle,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
        },
      ]}
    >
      <Icon name={name as any} size={size} color={C.terracotta} />
    </View>
  );
}

function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <View style={s.testimonialCard}>
      <View style={s.testimonialTop}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={s.avatar} />
        ) : (
          <View style={s.avatarFallback}>
            <Icon name="account" size={27} color={C.plum} />
          </View>
        )}

        <View style={s.testimonialIdentity}>
          <Text style={s.testimonialName}>{item.name}</Text>
          <Text style={s.testimonialCity}>{item.city}</Text>
        </View>

        <Icon name="format-quote-close" size={30} color={C.border} />
      </View>

      <Text style={s.testimonialText}>{item.text}</Text>
    </View>
  );
}

/**
 * Pays from the wallet and makes the report, then tells the user the result.
 * `onLowBalance` reopens the Confirm Details sheet.
 */
async function runPurchase(
  profileId: string,
  report: Report,
  lan: string,
  setLoading: (value: boolean) => void,
  onLowBalance: () => void,
  onFinished: () => void = () => {}
) {
  if (!profileId) return;
  setLoading(true);

  try {
    const result = await purchaseReport(profileId, report.id, lan);

    // Bought: no longer an unfinished journey.
    await removeIncompleteReport(profileId, report.id).catch(() => {});

    if (result.status === "completed") {
      onFinished();
      Alert.alert("Your report is ready", `${report.title} has been added to your reports.`, [
        { text: "Later", style: "cancel" },
        { text: "Open", onPress: () => void openReportPage(result) },
      ]);
    } else if (result.status === "failed") {
      onFinished();
      Alert.alert(
        "Couldn't prepare your report",
        "We couldn't prepare your report right now. The amount has been refunded to your wallet."
      );
    }
  } catch (error) {
    onFinished();
    if (error instanceof ReportPurchaseError && error.status === 402) {
      await refreshWalletCredits();
      onLowBalance();
    } else {
      Alert.alert("Couldn't buy the report", (error as Error)?.message || "Please try again.");
    }
  } finally {
    setLoading(false);
  }
}

export default function ReportDetailScreen() {
  const insets = useSafeAreaInsets();
  const { report_id } = useLocalSearchParams<{ report_id: string }>();

  // Current active profile.
  const activeProfileId = useUserStore(
    (state) => state.user?.active_profile_id
  );

  const report = useMemo(
    () => reports.find((item) => item.id === report_id),
    [report_id]
  );

  const relatedReports = useMemo(() => {
    if (!report?.relatedReports) return [];

    return report.relatedReports
      .map((id) => reports.find((item) => item.id === id))
      .filter((item): item is Report => Boolean(item));
  }, [report]);

  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [buyNowLoading, setBuyNowLoading] = useState(false);

  useEffect(() => {
    setTestimonialIndex(0);
    setBuyNowLoading(false);
  }, [report_id]);

  /**
   * Track the opened report for the active profile.
   * Each profile has its own report journey storage.
   */
  useEffect(() => {
    if (!report?.id || !activeProfileId) return;

    void addIncompleteReport(
      String(activeProfileId),
      report.id
    ).catch((error) => {
      console.error("Failed to save report journey:", error);
    });
  }, [report?.id, activeProfileId]);

  // This profile's purchase of this report (null = not bought).
  const order = useReportsStore((state) =>
    activeProfileId && report_id
      ? state.byProfile[String(activeProfileId)]?.purchases?.[report_id]
      : undefined
  );
  const boughtForOthers = useReportsStore((state) =>
    activeProfileId && report_id
      ? state.byProfile[String(activeProfileId)]?.boughtForOthers?.[report_id] || NO_NAMES
      : NO_NAMES
  );
  const available = useReportsStore((state) =>
    activeProfileId && report_id
      ? state.byProfile[String(activeProfileId)]?.available?.[report_id] !== false
      : true
  );
  const activeProfile = useProfilesStore((state) =>
    state.profiles.find((p) => p.profile_id === activeProfileId)
  );
  const activeProfileName = activeProfile?.name || "";
  const walletBalance = Number(useUserStore((state) => state.user?.credits) ?? 0);
  const languages = useReportsStore((state) =>
    activeProfileId ? state.byProfile[String(activeProfileId)]?.languages || NO_LANGUAGES : NO_LANGUAGES
  );

  // Confirm Details sheet, and a purchase waiting for a wallet recharge.
  const [sheetOpen, setSheetOpen] = useState(false);
  // "Writing your report…" after paying (the user may close it and leave).
  const [writingOpen, setWritingOpen] = useState(false);
  // Preview: a sample report link set on the backend (none = no Preview).
  const sampleUrl = useReportsStore((state) =>
    activeProfileId && report_id
      ? state.byProfile[String(activeProfileId)]?.samples?.[report_id]
      : undefined
  );
  const [language, setLanguage] = useState("en");
  const pendingBuy = useRef<{ reportId: string; lan: string } | null>(null);

  const status = order?.status;
  const purchased = status === "completed" && Boolean(order?.pdf_url || order?.html_url);
  const preparing = status === "processing";

  useEffect(() => {
    if (activeProfileId) void loadProfileReports(String(activeProfileId));
  }, [activeProfileId]);

  // Back from the wallet after "Add Cash to Buy": buy if the balance is
  // now enough, otherwise show the sheet again.
  useFocusEffect(
    useCallback(() => {
      const pending = pendingBuy.current;
      if (!pending || pending.reportId !== report_id || !report) return;

      void (async () => {
        await refreshWalletCredits();
        const credits = Number(useUserStore.getState().user?.credits ?? 0);
        pendingBuy.current = null;

        if (credits >= report.price) {
          setLanguage(pending.lan);
          setSheetOpen(false);
          setWritingOpen(true);
          await runPurchase(
            String(activeProfileId),
            report,
            pending.lan,
            setBuyNowLoading,
            () => setSheetOpen(true),
            () => setWritingOpen(false)
          );
        } else {
          setLanguage(pending.lan);
          setSheetOpen(true);
        }
      })();
    }, [report_id, report, activeProfileId])
  );

  // A report still being made finishes on the server; check back until ready.
  useEffect(() => {
    if (!preparing || !activeProfileId || buyNowLoading) return;
    const timer = setInterval(() => {
      void loadProfileReports(String(activeProfileId));
    }, 6000);
    return () => clearInterval(timer);
  }, [preparing, activeProfileId, buyNowLoading]);

  if (!report) {
    return (
      <View style={s.notFound}>
        <Icon
          name="file-search-outline"
          size={44}
          color={C.secondary}
        />

        <Text style={s.notFoundTitle}>Report not found</Text>

        <Text style={s.notFoundText}>
          We couldn't find this report.
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={s.primaryButton}
        >
          <Text style={s.primaryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const features = report.features ?? [];
  const questions = report.questions ?? [];
  const discoveries = report.discoveries ?? [];

  const testimonials =
    report.testimonials ??
    (report.testimonial ? [report.testimonial] : []);

  const onTestimonialScroll = (
    e: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    setTestimonialIndex(
      Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    );
  };

  const openReport = async () => {
    try {
      await openReportPage(order);
    } catch {
      Alert.alert("Couldn't open the report", "Please try again.");
    }
  };

  const shareReport = async () => {
    const link = order?.pdf_url || order?.html_url;
    if (!link) return;
    try {
      await Share.share({
        message: `My ${report.title}: ${link}`,
        url: link,
      });
    } catch (error) {
      console.log("Share report error:", error);
    }
  };

  const buy = (lan: string) =>
    runPurchase(
      String(activeProfileId),
      report,
      lan,
      setBuyNowLoading,
      () => setSheetOpen(true),
      () => setWritingOpen(false)
    );

  /** Preview: opens the sample report inside the app. */
  const previewSample = async () => {
    if (!sampleUrl) return;
    try {
      await openReportPage({
        order_id: "sample",
        report_id: report.id,
        profile_id: "",
        status: "completed",
        html_url: sampleUrl,
      });
    } catch {
      Alert.alert("Couldn't open the sample", "Please try again.");
    }
  };

  /** Opens "Confirm Details" before paying from the wallet. */
  const handleBuyNow = () => {
    if (buyNowLoading || preparing || !report.id || !activeProfileId) return;
    void refreshWalletCredits();
    setSheetOpen(true);
  };

  const confirmBuy = () => {
    setSheetOpen(false);
    setWritingOpen(true);
    void buy(language);
  };

  // Not enough balance: recharge, then the purchase continues here.
  const addCashToBuy = () => {
    pendingBuy.current = { reportId: report.id, lan: language };
    setSheetOpen(false);
    router.push("/(root)/profile/wallet");
  };

  return (
    <View style={s.screen}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={PAGE_BG}
      />

      {/* Header */}
      <View
        style={[
          s.header,
          { paddingTop: Math.max(insets.top, 10) },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={s.backButton}
        >
          <Icon name="arrow-left" size={23} color={C.ink} />
        </Pressable>

        <View style={s.headerText}>
          <Text style={s.headerTitle}>Reports</Text>
          <Text style={s.headerSubtitle}>
            Based on your kundli
          </Text>
        </View>

        {sampleUrl ? (
          <Pressable onPress={() => void previewSample()} style={s.previewButton}>
            <Text style={s.previewText}>Preview</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroFrame}>
            <Image
              source={{ uri: report.image }}
              style={s.heroImage}
              resizeMode="cover"
            />
          </View>

          <Text style={s.reportTitle}>{report.title}</Text>

          <Text style={s.reportDescription}>
            {report.description}
          </Text>
        </View>

        {/* Bought for another profile, not this one */}
        {!purchased && !preparing && boughtForOthers.length > 0 && (
          <View style={s.otherHint}>
            <Icon name="account-multiple-outline" size={20} color={C.plum} />
            <Text style={s.otherHintText}>
              You bought this for {boughtForOthers.join(", ")}.{" "}
              {activeProfileName
                ? `Get it for ${activeProfileName} too?`
                : "Get it for this profile too?"}
            </Text>
          </View>
        )}

        {/* Features */}
        {features.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.featureList}
          >
            {features.map((feature, index) => (
              <View
                key={`${feature.label}-${index}`}
                style={s.feature}
              >
                <CircleIcon name={feature.icon} />

                <Text style={s.featureLabel}>
                  {feature.label}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Questions */}
        {questions.length > 0 && (
          <View style={s.sectionCard}>
            <SectionTitle
              title="What will this report answer?"
              icon="book-open-outline"
            />

            {questions.map((question, index) => (
              <View
                key={`${question}-${index}`}
                style={[
                  s.questionRow,
                  index > 0 && s.rowDivider,
                ]}
              >
                <View style={s.questionIcon}>
                  <Icon
                    name="help"
                    size={15}
                    color={C.terracotta}
                  />
                </View>

                <Text style={s.questionText}>
                  {question}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Discoveries */}
        {discoveries.length > 0 && (
          <View style={s.section}>
            <SectionTitle
              title="What you'll discover"
              icon="text-box-check-outline"
            />

            <View style={s.discoveryCard}>
              {discoveries.map((item, index) => (
                <View
                  key={`${item.text}-${index}`}
                  style={[
                    s.discoveryRow,
                    index > 0 && s.rowDivider,
                  ]}
                >
                  <CircleIcon
                    name={item.icon}
                    size={18}
                    diameter={32}
                  />

                  <Text style={s.discoveryText}>
                    {item.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Testimonials */}
        {testimonials.length > 0 && (
          <View style={s.testimonialSection}>
            <ScrollView
              key={report.id}
              horizontal
              pagingEnabled
              scrollEnabled={testimonials.length > 1}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onTestimonialScroll}
            >
              {testimonials.map((item, index) => (
                <View
                  key={`${item.name}-${index}`}
                  style={s.testimonialPage}
                >
                  <TestimonialCard item={item} />
                </View>
              ))}
            </ScrollView>

            {testimonials.length > 1 && (
              <View style={s.dots}>
                {testimonials.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      s.dot,
                      index === testimonialIndex &&
                        s.dotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Related reports */}
        {relatedReports.length > 0 && (
          <View style={s.relatedSection}>
            <Text style={s.relatedTitle}>
              You may also like
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.relatedList}
            >
              {relatedReports.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.replace({
                      pathname: "/(root)/report/[report_id]",
                      params: { report_id: item.id },
                    })
                  }
                  style={s.relatedCard}
                >
                  <Image
                    source={{ uri: item.image }}
                    style={s.relatedImage}
                    resizeMode="cover"
                  />

                  <View style={s.relatedCardFooter}>
                    <Text
                      style={s.relatedCardTitle}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>

                    <Icon
                      name="chevron-right"
                      size={19}
                      color={C.ink}
                    />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <WritingReportSheet visible={writingOpen} onClose={() => setWritingOpen(false)} />



      <ConfirmReportSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        profile={activeProfile}
        price={report.price}
        oldPrice={report.oldPrice}
        walletBalance={walletBalance}
        languages={languages}
        language={language}
        onLanguageChange={setLanguage}
        onBuy={confirmBuy}
        onAddCash={addCashToBuy}
        ownedLanguage={purchased ? order?.lan || "en" : null}
        onOpenOwned={() => {
          setSheetOpen(false);
          void openReport();
        }}
      />

      {/* Fixed purchase bar */}
      <View
        style={[
          s.purchaseBar,
          { paddingBottom: Math.max(insets.bottom, 10) },
        ]}
      >
        {purchased ? (
          <>
            <View style={s.priceColumn}>
              <View style={s.purchasedBadge}>
                <Icon name="check-decagram" size={14} color={C.plum} />
                <Text style={s.purchasedText}>Purchased</Text>
              </View>
              <Text style={s.frequency}>
                {activeProfileName ? `For ${activeProfileName}` : "Ready to read"}
              </Text>
              <Pressable onPress={handleBuyNow} hitSlop={8}>
                <Text style={s.buyAgain}>Buy again ›</Text>
              </Pressable>
            </View>

            <Pressable onPress={shareReport} hitSlop={8} style={s.shareButton}>
              <Icon name="share-variant-outline" size={20} color={C.plum} />
            </Pressable>

            <Pressable onPress={openReport} style={s.buyButton}>
              <Text style={s.buyButtonText}>Open Report</Text>
              <Icon name="file-pdf-box" size={20} color={C.white} />
            </Pressable>
          </>
        ) : preparing || buyNowLoading ? (
          <View style={s.preparingRow}>
            <CosmicLoader size={52} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.preparingTitle}>Preparing your report…</Text>
              <Text style={s.frequency}>Usually ready in 2 - 5 minutes. You can leave this page.</Text>
            </View>
          </View>
        ) : !available ? (
          <View style={s.preparingRow}>
            <Icon name="clock-outline" size={22} color={C.secondary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.preparingTitle}>Coming soon</Text>
              <Text style={s.frequency}>This report will be available shortly.</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={s.priceColumn}>
              <View style={s.discountBadge}>
                <Text style={s.discountText}>
                  {report.discount}
                </Text>
              </View>

              <View style={s.priceRow}>
                <Text style={s.price}>
                  ₹{report.price}
                </Text>

                <Text style={s.oldPrice}>
                  ₹{report.oldPrice}
                </Text>
              </View>

              <Text style={s.frequency}>
                {status === "failed" ? "Last attempt failed · refunded" : report.frequency}
              </Text>
            </View>

            <Pressable onPress={handleBuyNow} style={s.buyButton}>
              <Text style={s.buyButtonText}>
                {status === "failed" ? "Try Again" : "Buy Now"}
              </Text>
              <Icon name="arrow-right" size={20} color={C.white} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  otherHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#EFE8F7",
  },
  otherHintText: { flex: 1, color: C.ink, fontSize: 13.5, lineHeight: 19, fontWeight: "600" },
  purchasedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EFE8F7",
  },
  purchasedText: { color: C.plum, fontSize: 12, fontWeight: "800" },
  shareButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  preparingRow: { flex: 1, flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  preparingTitle: { color: C.ink, fontSize: 15, fontWeight: "800" },
  samplePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "center",
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#EFE8F7",
    borderWidth: 1,
    borderColor: "#DCCFEA",
  },
  samplePillText: { color: C.plum, fontSize: 14, fontWeight: "700" },
  buyAgain: { color: C.plum, fontSize: 13, fontWeight: "700", marginTop: 4, textDecorationLine: "underline" },
  screen: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  header: {
    minHeight: 66,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PAGE_BG,
  },

  backButton: {
    width: 34,
    height: 40,
    justifyContent: "center",
  },

  headerText: {
    flex: 1,
    paddingLeft: 4,
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.ink,
  },

  headerSubtitle: {
    marginTop: 1,
    fontSize: 11.5,
    color: C.secondary,
  },

  previewButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.terracotta,
    backgroundColor: C.card,
  },

  previewText: {
    color: C.terracotta,
    fontSize: 12.5,
    fontWeight: "600",
  },

  hero: {
    alignItems: "center",
    paddingBottom: 10,
  },

  heroFrame: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    overflow: "hidden",
  },

  heroImage: {
    position: "absolute",
    top: 0,
    left: -HERO_SHIFT * 2,
    width: SCREEN_WIDTH + HERO_SHIFT * 2,
    height: HERO_HEIGHT,
  },

  reportTitle: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "700",
    color: C.ink,
  },

  reportDescription: {
    marginTop: 4,
    maxWidth: 300,
    textAlign: "center",
    fontSize: 13.5,
    lineHeight: 19,
    color: C.secondary,
  },

  featureList: {
    paddingHorizontal: 12,
    paddingBottom: 18,
  },

  feature: {
    width: FEATURE_WIDTH,
    paddingHorizontal: 3,
    alignItems: "center",
  },

  iconCircle: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.peach,
  },

  featureLabel: {
    marginTop: 6,
    fontSize: 10.5,
    lineHeight: 14,
    textAlign: "center",
    color: C.secondary,
  },

  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
    borderRadius: 18,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "rgba(217,206,193,0.45)",
    shadowColor: "#A94C36",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  section: {
    marginHorizontal: 16,
    marginBottom: 18,
  },

  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  sectionTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: C.ink,
  },

  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: "rgba(217,206,193,0.45)",
  },

  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 10,
  },

  questionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.peach,
  },

  questionText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    color: C.ink,
  },

  discoveryCard: {
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "rgba(217,206,193,0.45)",
    shadowColor: "#A94C36",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  discoveryRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 7,
  },

  discoveryText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    color: C.ink,
  },

  testimonialSection: {
    marginBottom: 20,
  },

  testimonialPage: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 16,
  },

  testimonialCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "rgba(217,206,193,0.45)",
    shadowColor: "#A94C36",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  testimonialTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.ivory,
  },

  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.ivory,
  },

  testimonialIdentity: {
    flex: 1,
    marginLeft: 12,
  },

  testimonialName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: C.ink,
  },

  testimonialCity: {
    marginTop: 2,
    fontSize: 12,
    color: C.secondary,
  },

  testimonialText: {
    marginTop: 8,
    marginLeft: 58,
    fontSize: 12,
    lineHeight: 17,
    color: C.secondary,
  },

  dots: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },

  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.border,
  },

  dotActive: {
    width: 14,
    backgroundColor: C.plum,
  },

  relatedSection: {
    marginBottom: 14,
  },

  relatedTitle: {
    marginHorizontal: 16,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: "700",
    color: C.ink,
  },

  relatedList: {
    paddingHorizontal: 16,
    gap: 10,
  },

  relatedCard: {
    width: RELATED_WIDTH,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "rgba(217,206,193,0.6)",
  },

  relatedImage: {
    width: "100%",
    height: 76,
  },

  relatedCardFooter: {
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  relatedCardTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: C.ink,
  },

  purchaseBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: "rgba(217,206,193,0.7)",
  },

  priceColumn: {
    minWidth: 96,
  },

  discountBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: C.peach,
  },

  discountText: {
    color: C.terracotta,
    fontSize: 10.5,
    fontWeight: "700",
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 7,
    marginTop: 3,
  },

  price: {
    fontSize: 24,
    fontWeight: "800",
    color: C.ink,
  },

  oldPrice: {
    fontSize: 12.5,
    color: C.secondary,
    textDecorationLine: "line-through",
  },

  frequency: {
    marginTop: 1,
    fontSize: 10,
    color: C.secondary,
  },

  buyButton: {
    flex: 1,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: C.plum,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  buyButtonDisabled: {
    opacity: 0.6,
  },

  buyButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.white,
  },

  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: PAGE_BG,
  },

  notFoundTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: "700",
    color: C.ink,
  },

  notFoundText: {
    marginTop: 6,
    marginBottom: 20,
    fontSize: 14,
    color: C.secondary,
  },

  primaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C.plum,
  },

  primaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.white,
  },
});