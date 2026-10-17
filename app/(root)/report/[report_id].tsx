import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Dimensions,
    Image,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
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
import {
    emptyPartner,
    PartnerDraft,
    partnerDetails,
} from "../../../components/reports/PartnerForm";
import {
    discountLabel,
    featureLabel,
    frequencyLabel,
    reportDescription,
    reportDiscovery,
    reportQuestion,
    reportTitle,
    testimonialText,
} from "../../../components/reports/reportText";
import WritingReportSheet from "../../../components/reports/WritingReportSheet";
import useProfilesStore from "../../../components/stores/profilesStore";
import {
    loadProfileReports,
    openReport as openReportPage,
    PartnerDetails,
    purchaseKey,
    purchaseReport,
    ReportOptions,
    ReportOrder,
    ReportPurchaseError,
    useReportsStore,
} from "../../../components/stores/reportsStore";
import { refreshWalletCredits, useUserStore } from "../../../components/stores/userStore";
import { metaEvents, track, useScreenTime } from "../../../lib/analytics";
import { translate, useLanguage, useT } from "../../../lib/i18n";
import {
    addIncompleteReport,
    removeIncompleteReport,
} from "../../../components/utils/reportJourneyStorage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const C = {
  ink: "#1C1820",
  plum: "#2B1A3D",
  soft: "#EFE8F7",
  goldSoft: "#F6EEDD",
  green: "#2E7D4F",
  greenSoft: "#E6F2EA",
  line: "rgba(217,206,193,0.7)",
  gold: "#C49A4A",
  card: "#FFFDFC",
  ivory: "#F7F1E8",
  secondary: "#68616A",
  border: "#D9CEC1",
  peach: "#EFE8F7",
  white: "#FFFFFF",
};

const PAGE_BG = "#F4F0F8";
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
const NO_LANGUAGES: Record<string, string> = {};
const NO_OPTIONS: ReportOptions = { languages: [], variants: [], needsPartner: false, needsChild: false };

function SectionTitle({
  title,
  icon,
}: {
  title: string;
  icon: string;
}) {
  return (
    <View style={s.sectionHeading}>
      <View style={s.sectionIcon}>
        <Icon name={icon as any} size={16} color={C.plum} />
      </View>
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
      <Icon name={name as any} size={size} color={C.plum} />
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
  onFinished: () => void = () => {},
  variant: string | null = null,
  partner: PartnerDetails | null = null,
  child: PartnerDetails | null = null,
  onReady: (order: ReportOrder) => void = () => {}
) {
  if (!profileId) return;
  setLoading(true);

  try {
    const result = await purchaseReport(profileId, report.id, lan, variant, partner, child);

    // Analytics: the purchase API answered.
    const details = {
      report_id: report.id,
      report_title: report.title,
      price: report.price,
      language: lan,
      ...(variant ? { duration: variant } : {}),
      for_partner: Boolean(partner),
      for_child: Boolean(child),
      platform: Platform.OS,
    };
    if (result.status === "failed") {
      track("report_purchase_failed", { ...details, reason: "not_prepared_refunded" });
    } else {
      track("report_purchased", { ...details, status: result.status });
      metaEvents.spentCredits(report.id, Number(report.price) || 0);
    }

    // Bought: no longer an unfinished journey.
    await removeIncompleteReport(profileId, report.id).catch(() => {});

    if (result.status === "completed") {
      // The writing sheet turns into "Your report is ready" (one sheet, no extra pop-up).
      onReady(result);
    } else if (result.status === "failed") {
      onFinished();
      Alert.alert(translate("reports.alert.prepareFailedTitle"), translate("reports.alert.prepareFailedText"));
    }
  } catch (error) {
    onFinished();
    if (error instanceof ReportPurchaseError && error.status === 402) {
      track("report_low_balance", { report_id: report.id, price: report.price, platform: Platform.OS });
      await refreshWalletCredits();
      onLowBalance();
    } else {
      track("report_purchase_failed", {
        report_id: report.id,
        price: report.price,
        reason: (error as Error)?.message || "unknown",
        platform: Platform.OS,
      });
      Alert.alert(
        translate("reports.alert.buyFailedTitle"),
        (error as Error)?.message || translate("reports.alert.tryAgainText")
      );
    }
  } finally {
    setLoading(false);
  }
}

export default function ReportDetailScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  // App language (not the report language below).
  const appLanguage = useLanguage();
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

  // What buying needs: languages, durations (Future), partner (Matching), child (Baby).
  const options = useReportsStore((state) =>
    activeProfileId && report_id
      ? state.byProfile[String(activeProfileId)]?.options?.[report_id] || NO_OPTIONS
      : NO_OPTIONS
  );
  const [chosenVariant, setChosenVariant] = useState<string | null>(null);
  const variant = options.variants.length
    ? chosenVariant && options.variants.some((v) => v.id === chosenVariant)
      ? chosenVariant
      : options.variants[0].id
    : null;
  // Second person's form: the partner (Matching) or the child (Baby report).
  const personRole = options.needsPartner ? "partner" : options.needsChild ? "child" : null;
  const [partner, setPartner] = useState<PartnerDraft>(emptyPartner);
  const partnerReady = !personRole || partnerDetails(partner) !== null;
  const person = personRole ? partnerDetails(partner) : null;

  // This profile's purchase of this report (for the chosen duration).
  const order = useReportsStore((state) =>
    activeProfileId && report_id
      ? state.byProfile[String(activeProfileId)]?.purchases?.[purchaseKey(report_id, variant)]
      : undefined
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
  // The report finished while the writing sheet is up: it then offers to open it.
  const [readyOrder, setReadyOrder] = useState<ReportOrder | null>(null);
  const showReady = (order: ReportOrder) => {
    setReadyOrder(order);
    setWritingOpen(true);
  };
  const closeWriting = () => {
    setWritingOpen(false);
    setReadyOrder(null);
  };
  const openReady = () => {
    const order = readyOrder;
    if (order) track("report_opened", { report_id: order.report_id, source: "ready_sheet", platform: Platform.OS });
    closeWriting();
    // Let the sheet close before the report opens.
    if (order) setTimeout(() => void openReportPage(order), 350);
  };
  // Preview: a sample report link set on the backend (none = no Preview).
  const sampleUrl = useReportsStore((state) =>
    activeProfileId && report_id
      ? state.byProfile[String(activeProfileId)]?.samples?.[report_id]
      : undefined
  );
  const [language, setLanguage] = useState("en");
  const pendingBuy = useRef<{
    reportId: string;
    lan: string;
    variant: string | null;
    partner: PartnerDetails | null;
    child: PartnerDetails | null;
  } | null>(null);

  const status = order?.status;
  const purchased = status === "completed" && Boolean(order?.pdf_url || order?.html_url);
  const preparing = status === "processing";

  // Analytics: a report already bought for this profile is its own pair
  // (visited_purchased_report + purchased_report_time_spent), otherwise
  // visited_report + report_time_spent.
  useScreenTime(purchased ? "purchased_report" : "report", { report_id: String(report_id || "") });

  // Meta: View content, once per report page opened.
  useEffect(() => {
    if (report_id) metaEvents.viewContent("report", String(report_id), Number(report?.price) || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report_id]);

  /**
   * Track the opened report for the active profile ("Continue your journey"
   * on Home). Bought reports are taken off, not added back when reopened.
   */
  useEffect(() => {
    if (!report?.id || !activeProfileId) return;

    const save = purchased || preparing ? removeIncompleteReport : addIncompleteReport;
    void save(String(activeProfileId), report.id).catch((error) => {
      console.error("Failed to save report journey:", error);
    });
  }, [report?.id, activeProfileId, purchased, preparing]);

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
            () => setWritingOpen(false),
            pending.variant,
            pending.partner,
            pending.child,
            showReady
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

        <Text style={s.notFoundTitle}>{t("reports.notFoundTitle")}</Text>

        <Text style={s.notFoundText}>
          {t("reports.notFoundText")}
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={s.primaryButton}
        >
          <Text style={s.primaryButtonText}>{t("reports.goBackButton")}</Text>
        </Pressable>
      </View>
    );
  }

  const features = report.features ?? [];
  // In the app's language (English text from reports.json when missing).
  const questions = (report.questions ?? []).map((q, i) => reportQuestion(t, report.id, i, q));
  const discoveries = (report.discoveries ?? []).map((d, i) => ({
    ...d,
    text: reportDiscovery(t, report.id, i, d.text),
  }));

  const testimonials = (report.testimonials ?? (report.testimonial ? [report.testimonial] : [])).map(
    (item, i) => ({ ...item, text: testimonialText(t, report.id, i, item.text) })
  );

  const onTestimonialScroll = (
    e: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    setTestimonialIndex(
      Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    );
  };

  const openReport = async () => {
    track("report_opened", { report_id: report.id, source: "report_page", platform: Platform.OS });
    try {
      await openReportPage(order);
    } catch {
      Alert.alert(t("reports.alert.openFailedTitle"), t("reports.alert.tryAgainText"));
    }
  };

  const shareReport = async () => {
    const link = order?.pdf_url || order?.html_url;
    if (!link) return;
    track("report_shared", { report_id: report.id, platform: Platform.OS });
    try {
      await Share.share({
        message: t("reports.shareMessage", { title: reportTitle(t, report), link }),
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
      () => setWritingOpen(false),
      variant,
      personRole === "partner" ? person : null,
      personRole === "child" ? person : null,
      showReady
    );

  /** Preview: opens the sample report inside the app. */
  const previewSample = async () => {
    if (!sampleUrl) return;
    track("report_sample_previewed", { report_id: report.id, platform: Platform.OS });
    try {
      await openReportPage({
        order_id: "sample",
        report_id: report.id,
        profile_id: "",
        status: "completed",
        html_url: sampleUrl,
      });
    } catch {
      Alert.alert(t("reports.alert.sampleFailedTitle"), t("reports.alert.tryAgainText"));
    }
  };

  /** Opens "Confirm Details" before paying from the wallet. */
  const handleBuyNow = () => {
    if (buyNowLoading || preparing || !report.id || !activeProfileId) return;
    track("buy_now_clicked", {
      report_id: report.id,
      report_title: report.title,
      price: report.price,
      platform: Platform.OS,
    });
    metaEvents.addToCart(report.id, Number(report.price) || 0);
    void refreshWalletCredits();
    setSheetOpen(true);
  };

  const confirmBuy = () => {
    track("report_purchase_confirmed", {
      report_id: report.id,
      report_title: report.title,
      price: report.price,
      language,
      ...(variant ? { duration: variant } : {}),
      platform: Platform.OS,
    });
    setSheetOpen(false);
    setReadyOrder(null);
    // Open the writing sheet once Confirm Details has closed (iOS shows one sheet at a time).
    setTimeout(() => setWritingOpen(true), 350);
    void buy(language);
  };

  // Not enough balance: recharge, then the purchase continues here.
  const addCashToBuy = () => {
    track("report_add_cash_clicked", { report_id: report.id, price: report.price, platform: Platform.OS });
    pendingBuy.current = {
      reportId: report.id,
      lan: language,
      variant,
      partner: personRole === "partner" ? person : null,
      child: personRole === "child" ? person : null,
    };
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
          hitSlop={10}
          style={s.backButton}
          accessibilityLabel={t("reports.goBack")}
        >
          <Icon name="chevron-left" size={24} color={C.ink} />
        </Pressable>

        <View style={s.headerText}>
          <Text style={s.headerTitle} numberOfLines={1}>{t("reports.header")}</Text>
          <Text style={s.headerSubtitle} numberOfLines={1}>
            {t("reports.basedOnKundli")}
          </Text>
        </View>

        {sampleUrl ? (
          <Pressable onPress={() => void previewSample()} style={s.previewButton}>
            <Icon name="eye-outline" size={15} color={C.plum} />
            <Text style={s.previewText} numberOfLines={1}>{t("reports.sample")}</Text>
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

          <Text style={s.reportTitle}>{reportTitle(t, report)}</Text>

          <Text style={s.reportDescription}>
            {reportDescription(t, report)}
          </Text>
        </View>

        {/* Future Report: how many years */}
        {options.variants.length > 0 && (
          <View style={s.variantBlock}>
            <Text style={s.variantTitle}>{t("reports.chooseForecast")}</Text>
            <View style={s.variantRow}>
              {options.variants.map((v) => {
                const on = v.id === variant;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => setChosenVariant(v.id)}
                    style={[s.variantCard, on && s.variantCardOn]}
                  >
                    <Text style={[s.variantLabel, on && s.variantLabelOn]}>{v.label}</Text>
                    <Text style={[s.variantPrice, on && s.variantLabelOn]}>₹{report.price}</Text>
                  </Pressable>
                );
              })}
            </View>
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
                  {featureLabel(t, report.id, index, feature.label)}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Questions */}
        {questions.length > 0 && (
          <View style={s.sectionCard}>
            <SectionTitle
              title={t("reports.questionsTitle")}
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
                    size={14}
                    color={C.plum}
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
              title={t("reports.discoverTitle")}
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
              {t("reports.youMayAlsoLike")}
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
                      {reportTitle(t, item)}
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

      <WritingReportSheet
        visible={writingOpen}
        onClose={closeWriting}
        readyTitle={readyOrder ? (appLanguage === "en" && readyOrder.report_name) || reportTitle(t, report) : null}
        onOpen={openReady}
      />


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
        allowedLanguages={options.languages}
        variants={options.variants}
        variant={variant}
        onVariantChange={setChosenVariant}
        partner={personRole ? partner : null}
        onPartnerChange={personRole ? setPartner : undefined}
        partnerReady={partnerReady}
        personRole={personRole || "partner"}
        ownedLanguage={purchased && !personRole ? order?.lan || "en" : null}
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
                <Text style={s.purchasedText} numberOfLines={1}>{t("reports.status.purchased")}</Text>
              </View>
              <Text style={s.frequency} numberOfLines={1}>
                {activeProfileName ? t("reports.forName", { name: activeProfileName }) : t("reports.readyToRead")}
              </Text>
              <Pressable onPress={handleBuyNow} hitSlop={8}>
                <Text style={s.buyAgain}>{t("reports.buyAgain")}</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={shareReport}
              hitSlop={8}
              style={s.shareButton}
              accessibilityLabel={t("reports.share")}
            >
              <Icon name="share-variant-outline" size={20} color={C.plum} />
            </Pressable>

            <Pressable onPress={openReport} style={s.buyButton}>
              <Text style={s.buyButtonText} numberOfLines={1} adjustsFontSizeToFit>
                {t("reports.openReportCta")}
              </Text>
              <Icon name="file-pdf-box" size={20} color={C.white} />
            </Pressable>
          </>
        ) : preparing || buyNowLoading ? (
          <View style={s.preparingRow}>
            <CosmicLoader size={52} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.preparingTitle}>{t("reports.preparingTitle")}</Text>
              <Text style={s.frequency}>{t("reports.preparingText")}</Text>
            </View>
          </View>
        ) : !available ? (
          <View style={s.preparingRow}>
            <Icon name="clock-outline" size={22} color={C.secondary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.preparingTitle}>{t("common.comingSoon")}</Text>
              <Text style={s.frequency}>{t("reports.availableShortly")}</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={s.priceColumn}>
              <View style={s.discountBadge}>
                <Text style={s.discountText} numberOfLines={1}>
                  {discountLabel(t, report.discount)}
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
                {status === "failed" ? t("reports.lastAttemptFailed") : frequencyLabel(t, report.frequency)}
              </Text>
            </View>

            <Pressable onPress={handleBuyNow} style={s.buyButton}>
              <Text style={s.buyButtonText} numberOfLines={1} adjustsFontSizeToFit>
                {status === "failed" ? t("reports.tryAgain") : t("reports.buyNow")}
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
  variantBlock: { marginHorizontal: 16, marginTop: 16 },
  variantTitle: { color: C.ink, fontSize: 15, fontWeight: "800", marginBottom: 10 },
  variantRow: { flexDirection: "row", gap: 10 },
  variantCard: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    alignItems: "center",
  },
  variantCardOn: { backgroundColor: C.plum, borderColor: C.plum },
  variantLabel: { color: C.ink, fontSize: 14, fontWeight: "700" },
  variantPrice: { color: C.secondary, fontSize: 13, marginTop: 2 },
  variantLabelOn: { color: C.white },
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
    borderColor: C.line,
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
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: PAGE_BG,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },

  headerText: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.3,
  },

  headerSubtitle: {
    marginTop: 1,
    fontSize: 12.5,
    color: C.secondary,
  },

  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },

  previewText: {
    color: C.plum,
    fontSize: 13,
    fontWeight: "700",
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
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: "#2B1A3D",
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
    gap: 10,
    marginBottom: 8,
  },

  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.soft,
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
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: "#2B1A3D",
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
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: "#2B1A3D",
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
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    color: C.gold,
  },

  relatedList: {
    paddingHorizontal: 16,
    gap: 10,
  },

  relatedCard: {
    width: RELATED_WIDTH,
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.greenSoft,
  },

  discountText: {
    color: C.green,
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.3,
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
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 999,
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
    borderRadius: 999,
    backgroundColor: C.plum,
  },

  primaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.white,
  },
});