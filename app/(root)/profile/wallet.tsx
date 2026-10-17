import {
    Ionicons,
    MaterialCommunityIcons,
} from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import {
    ActivityIndicator,
    AppState,
    Image,
    KeyboardAvoidingView,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from "react-native";

import { Text } from "../../../components/ui/BrandText";
import { SafeAreaView } from "react-native-safe-area-context";

import { metaEvents, track } from "../../../lib/analytics";
import { useUserStore } from "../../../components/stores/userStore";
import { API_URL, authHeaders } from "../../../lib/auth";
import { translate, useT } from "../../../lib/i18n";
import {
    getUpiApps,
    isRazorpayAvailable,
    payWithUpiApp,
    payWithUpiId,
    type UpiApp,
} from "../../../lib/razorpay";

// UPI apps always shown in the dropdown, in this order. Ones that aren't
// installed are listed too, with an "Install" link to the store.
// Logos are bundled (official marks) so they show even when not installed.
// iPhone: Razorpay names the app by `razorpayApp` (not the Android package
// name); `iosScheme` (in app.json LSApplicationQueriesSchemes) detects it.
const ALLOWED_UPI_APPS = [
  {
    packageName: "com.phonepe.app",
    appName: "PhonePe",
    logo: require("../../../assets/images/upi/phonepe.png"),
    iosScheme: "phonepe://",
    razorpayApp: "phonepe",
    appStoreUrl: "https://apps.apple.com/in/app/phonepe-secure-payments-app/id1170055821",
  },
  {
    packageName: "com.google.android.apps.nbu.paisa.user",
    appName: "Google Pay",
    logo: require("../../../assets/images/upi/googlepay.png"),
    iosScheme: "tez://",
    razorpayApp: "google_pay",
    appStoreUrl: "https://apps.apple.com/in/app/google-pay-save-pay-manage/id1193357041",
  },
];

// The PhonePe / Google Pay picker and UPI ID option need the Razorpay SDK
// (both platforms); without it (Expo Go) the wallet pays on Razorpay's page.
const showUpiPicker = isRazorpayAvailable;

// The id Razorpay uses for an app on this platform: what the dropdown
// selects and what's sent as `upi_app_package_name`.
type AllowedUpiApp = (typeof ALLOWED_UPI_APPS)[number];
const upiAppKey = (app: AllowedUpiApp) =>
  Platform.OS === "ios" ? app.razorpayApp : app.packageName;

/**
 * Installed allowed UPI apps, keyed by `upiAppKey`. iPhone checks each
 * app's URL scheme, so it works whatever the SDK's list returns.
 */
async function installedUpiApps(keyId: string): Promise<UpiApp[]> {
  if (Platform.OS !== "ios") {
    const apps = await getUpiApps(keyId);
    return apps.filter((a) => ALLOWED_UPI_APPS.some((allowed) => allowed.packageName === a.packageName));
  }

  // Lets the SDK start up; its list on iPhone isn't needed.
  await getUpiApps(keyId).catch(() => []);

  const checks = await Promise.all(
    ALLOWED_UPI_APPS.map((app) => Linking.canOpenURL(app.iosScheme).catch(() => false))
  );

  return ALLOWED_UPI_APPS.filter((_, i) => checks[i]).map((app) => ({
    appName: app.appName,
    packageName: app.razorpayApp,
  }));
}

// Pseudo "app" for paying by UPI ID (UPI collect) instead of a UPI app.
const UPI_ID_OPTION = "__upi_id__";

// name@bank, e.g. gaurav@okicici (the backend checks it with Razorpay).
const UPI_ID_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,63}$/;

type UpiCheck =
  | { status: "idle" }
  | { status: "checking" }
  // confirmed: false when Razorpay can't validate UPI IDs on this account
  // (the ID's format is fine, but its holder couldn't be checked).
  | { status: "valid"; vpa: string; name: string | null; confirmed: boolean }
  | { status: "invalid"; message: string };

const COLORS = {
  background: "#F4F0F8",
  card: "#FFFDFC",
  border: "#D9CEC1",
  line: "rgba(217,206,193,0.6)",
  ink: "#1C1820",
  plum: "#2B1A3D",
  soft: "#EFE8F7",
  terracotta: "#A94C36",
  gold: "#C49A4A",
  secondary: "#68616A",
  success: "#2E7D4F",
  successBg: "#E6F2EA",
};

const softShadow = {
  shadowColor: "#2B1A3D",
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};

/*
 * Plans come from the backend (GET /wallet/topup/packs) so the price
 * shown here is always the price charged.
 */
type Pack = {
  id: string;
  price_inr: number;
  // Extra credits on every recharge.
  bonus: number;
  credits: number;
  popular: boolean;
};

type Notice = {
  kind: "error" | "success";
  text: string;
};

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/*
 * Browser checkout (no native SDK, e.g. Expo Go).
 *
 * Opens the backend's Razorpay page in an in-app browser. That page
 * confirms the payment with the backend itself, so the app only watches
 * the order: it returns the new balance once the order is paid, or null
 * if the user comes back to the app without paying.
 */
async function payInBrowser(
  orderId: string,
  headers: HeadersInit,
  // iPhone: pay with this UPI app ("phonepe", "google_pay") or UPI ID.
  upi?: { app?: string; vpa?: string }
): Promise<number | null> {
  const checkStatus = async () => {
    const response = await fetch(
      `${API_URL}/wallet/topup/order/${orderId}`,
      { headers }
    );
    const data = await response.json();
    return response.ok && data.status === "paid"
      ? Number(data.credits ?? 0)
      : null;
  };

  // The app goes to the background while the browser is open; once it is
  // active again, check a few more times (verify can lag a moment) then stop.
  let returned = false;
  let wentBackground = false;
  const subscription = AppState.addEventListener("change", (state) => {
    if (state !== "active") {
      wentBackground = true;
    } else if (wentBackground) {
      returned = true;
    }
  });

  try {
    const query = new URLSearchParams();
    if (upi?.app) query.set("app", upi.app);
    if (upi?.vpa) query.set("vpa", upi.vpa);
    const suffix = query.toString() ? `?${query}` : "";

    await WebBrowser.openBrowserAsync(
      `${API_URL}/wallet/topup/checkout/${orderId}${suffix}`
    );

    // iOS resolves only when the browser closes; Android when it opens.
    if (Platform.OS === "ios") {
      returned = true;
    }

    const deadline = Date.now() + 10 * 60 * 1000;
    let checksAfterReturn = 0;

    while (Date.now() < deadline && checksAfterReturn < 4) {
      const credits = await checkStatus().catch(() => null);

      if (credits !== null) {
        try {
          await WebBrowser.dismissBrowser();
        } catch {
          // Not supported everywhere; the page tells the user to close it.
        }
        return credits;
      }

      if (returned) {
        checksAfterReturn += 1;
      }

      await sleep(2000);
    }

    return null;
  } finally {
    subscription.remove();
  }
}

export default function WalletScreen() {
  const t = useT();
  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore((state) => state.updateUser);

  const [packs, setPacks] = useState<Pack[]>([]);
  const [keyId, setKeyId] = useState("");
  const [selectedPackId, setSelectedPackId] = useState("");

  const [upiApps, setUpiApps] = useState<UpiApp[]>([]);
  const [selectedApp, setSelectedApp] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Pay with UPI ID: the ID must be verified (exists, holder's name) first.
  const [upiId, setUpiId] = useState("");
  const [upiCheck, setUpiCheck] = useState<UpiCheck>({ status: "idle" });

  const [loadingPacks, setLoadingPacks] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Razorpay needs a mobile number; Google/Apple accounts give one once.
  const [needsContact, setNeedsContact] = useState(false);
  const [contact, setContact] = useState("");
  const contactValid = /^[6-9]\d{9}$/.test(contact);

  const plan =
    packs.find((p) => p.id === selectedPackId) ?? packs[0];

  const app = upiApps.find((a) => a.packageName === selectedApp);
  const payByUpiId = selectedApp === UPI_ID_OPTION;
  const verifiedUpiId =
    upiCheck.status === "valid" && upiCheck.vpa === upiId.trim()
      ? upiCheck.vpa
      : null;

  const currentBalance = Number(user?.credits ?? 0);

  // Load plans, then the UPI apps installed on this phone.
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(
          `${API_URL}/wallet/topup/packs`,
          { headers: await authHeaders() }
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.detail || translate("wallet.loadPlansFailed"));
        }

        if (!active) {
          return;
        }

        setPacks(data.packs);
        setKeyId(data.key_id);
        setNeedsContact(Boolean(data.needs_contact));
        setSelectedPackId(
          (data.packs.find((p: Pack) => p.popular) ?? data.packs[0])?.id ?? ""
        );

        // Installed copies of PhonePe / Google Pay (icons come from these).
        const apps = await installedUpiApps(data.key_id);

        if (active) {
          setUpiApps(apps);
          setSelectedApp(
            ALLOWED_UPI_APPS.map(upiAppKey).find((key) =>
              apps.some((a) => a.packageName === key)
            ) ?? UPI_ID_OPTION
          );
        }
      } catch (error) {
        console.error("Wallet load failed:", error);

        if (active) {
          setNotice({
            kind: "error",
            text: translate("wallet.loadFailed"),
          });
        }
      } finally {
        if (active) {
          setLoadingPacks(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const verifyUpiId = async () => {
    const vpa = upiId.trim();

    if (!UPI_ID_PATTERN.test(vpa)) {
      setUpiCheck({ status: "invalid", message: translate("wallet.upiInvalidFormat") });
      return;
    }

    setUpiCheck({ status: "checking" });

    try {
      const response = await fetch(`${API_URL}/wallet/upi/validate`, {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vpa }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string" ? data.detail : translate("wallet.upiCheckFailed")
        );
      }

      if (data.available === false) {
        // Validation isn't enabled on the Razorpay account: allow the ID,
        // the payment request will fail if it's wrong.
        setUpiCheck({ status: "valid", vpa: data.vpa ?? vpa, name: null, confirmed: false });
        return;
      }

      setUpiCheck(
        data.valid
          ? { status: "valid", vpa: data.vpa ?? vpa, name: data.customer_name ?? null, confirmed: true }
          : { status: "invalid", message: translate("wallet.upiNotFound") }
      );
    } catch (error: any) {
      setUpiCheck({
        status: "invalid",
        message: error?.message || translate("wallet.upiCheckRetry"),
      });
    }
  };

  const handlePay = async () => {
    if (
      loading ||
      !plan ||
      (showUpiPicker && !app && !(payByUpiId && verifiedUpiId))
    ) {
      return;
    }

    setNotice(null);

    try {
      setLoading(true);
      metaEvents.initiateCheckout(plan.price_inr, plan.id);

      const headers = await authHeaders();

      // 1. Backend creates the Razorpay order (price comes from the backend).
      const orderResponse = await fetch(
        `${API_URL}/wallet/topup/order`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pack_id: plan.id,
            ...(needsContact ? { contact } : {}),
          }),
        }
      );

      const order = await orderResponse.json();

      if (!orderResponse.ok || !order.success) {
        // No mobile number on the account yet: ask for it.
        if (order.detail?.code === "contact_required") {
          setNeedsContact(true);
        }
        throw new Error(
          (typeof order.detail === "string" ? order.detail : order.detail?.message) ||
            translate("wallet.startFailed")
        );
      }

      // Saved on the account; not asked again.
      setNeedsContact(false);

      // No native SDK (Expo Go): pay on Razorpay's page in an in-app browser.
      if (!isRazorpayAvailable) {
        const credits = await payInBrowser(order.order_id, headers);

        if (credits === null) {
          setNotice({
            kind: "error",
            text: translate("wallet.notCompleted"),
          });
          return;
        }

        updateUser({ credits });
        metaEvents.purchase(plan.price_inr, plan.id);
        track("recharge_completed", {
          amount_inr: plan.price_inr,
          credits: plan.credits,
          method: payByUpiId ? "upi_id" : "upi_app",
        });

        setNotice({
          kind: "success",
          text: translate("wallet.added", { amount: plan.credits }),
        });
        return;
      }

      // 2. Pay: the chosen UPI app opens, or (UPI ID) a request is sent to
      //    the payer's UPI app; the user approves it there.
      const common = {
        key_id: order.key_id || keyId,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        contact: order.contact,
        email: order.email,
        description: `Wallet recharge ₹${plan.price_inr}`,
      };

      if (payByUpiId && verifiedUpiId) {
        setNotice({
          kind: "success",
          text: translate("wallet.requestSent", { upiId: verifiedUpiId }),
        });
      }

      const payment =
        payByUpiId && verifiedUpiId
          ? await payWithUpiId({ ...common, vpa: verifiedUpiId })
          : await payWithUpiApp({ ...common, upi_app_package_name: app!.packageName });

      metaEvents.addPaymentInfo(plan.price_inr, plan.id);

      // 3. Backend checks Razorpay's signature and adds the credits.
      const verifyResponse = await fetch(
        `${API_URL}/wallet/topup/verify`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            razorpay_order_id: order.order_id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_signature: payment.razorpay_signature,
          }),
        }
      );

      const result = await verifyResponse.json();

      if (!verifyResponse.ok || !result.success) {
        throw new Error(
          result.detail ||
            translate("wallet.notConfirmed")
        );
      }

      /*
       * Always use the balance from the server instead of
       * calculating it on the device.
       */
      updateUser({
        credits: Number(result.credits ?? 0),
      });

      metaEvents.purchase(plan.price_inr, plan.id);
      track("recharge_completed", {
        amount_inr: plan.price_inr,
        credits: plan.credits,
        method: payByUpiId ? "upi_id" : "upi_app",
      });

      setNotice({
        kind: "success",
        text: translate("wallet.added", { amount: plan.credits }),
      });
    } catch (error: any) {
      console.error("Wallet top-up failed:", error);

      // Razorpay rejects with { code, description }; fetch errors are Errors.
      const text =
        error?.description ||
        error?.message ||
        translate("wallet.failed");

      setNotice({ kind: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const canPay =
    Boolean(
      plan &&
        (app || (payByUpiId && verifiedUpiId) || !showUpiPicker)
    ) &&
    (!needsContact || contactValid) &&
    !loading;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Shrinks the screen when the keyboard opens (UPI ID field). */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.backButton}
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.ink} />
          </Pressable>

          <View style={styles.headerContent}>
            <Text style={styles.title}>{t("wallet.title")}</Text>
            <Text style={styles.subtitle}>{t("wallet.subtitle")}</Text>
          </View>
        </View>

        {/* Current balance */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.balanceCard}>
          <View style={styles.balanceRing} />
          <SpinRing />
          <Twinkle style={styles.sparkleOne} size={12} delay={0} />
          <Twinkle style={styles.sparkleTwo} size={8} delay={900} />

          <View style={{ flex: 1 }}>
            <Text style={styles.balanceLabel}>{t("wallet.balanceLabel")}</Text>
            <CountUpBalance value={currentBalance} />
            <Text style={styles.balanceHint}>{t("wallet.balanceHint")}</Text>
          </View>

          <Float>
            <View style={styles.balanceIcon}>
              <MaterialCommunityIcons name="wallet-outline" size={22} color={COLORS.card} />
            </View>
          </Float>
        </Animated.View>

        {loadingPacks ? (
          <ActivityIndicator
            style={styles.loadingPlans}
            color={COLORS.plum}
          />
        ) : (
          plan && (
            <>
              {/* Plans */}
              <Animated.Text entering={FadeIn.delay(120)} style={styles.sectionTitle}>{t("wallet.chooseAmount")}</Animated.Text>
              <View style={styles.plansRow}>
                {packs.map((item, index) => {
                  const active = item.id === plan.id;

                  return (
                    <PackPop key={item.id} index={index} active={active}>
                    <Pressable
                      onPress={() => {
                        if (!loading) {
                          setSelectedPackId(item.id);
                        }
                      }}
                      disabled={loading}
                      style={[
                        styles.planCard,
                        active && styles.planCardActive,
                      ]}
                    >
                      {item.popular && (
                        <View style={styles.popularTag}>
                          <Text style={styles.popularText}>
                            {t("wallet.popular")}
                          </Text>
                        </View>
                      )}

                      <Text style={styles.planAmount}>
                        ₹{item.price_inr}
                      </Text>

                      {item.bonus > 0 && (
                        <View style={styles.bonusPill}>
                          <Text style={styles.bonusText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                            {t("wallet.extraAmount", { amount: item.bonus })}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                    </PackPop>
                  );
                })}
              </View>

              {/* What the selected pack adds */}
              <Animated.Text key={plan.id} entering={FadeIn.duration(300)} style={styles.offerText}>
                {plan.bonus > 0
                  ? t("wallet.offerBonus", { amount: plan.credits })
                  : t("wallet.offer", { amount: plan.credits })}
              </Animated.Text>

              {/* Payment Summary */}
              <Animated.View entering={FadeInDown.delay(250).duration(450)} style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>
                  {t("wallet.summary")}
                </Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {t("wallet.rechargeAmount")}
                  </Text>

                  <Text style={styles.summaryValue}>
                    ₹{plan.price_inr}
                  </Text>
                </View>

                {plan.bonus > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {t("wallet.extra")}
                  </Text>

                  <Text
                    style={[
                      styles.summaryValue,
                      {
                        color: COLORS.success,
                      },
                    ]}
                  >
                    + ₹{plan.bonus}
                  </Text>
                </View>
                )}

                <View style={styles.divider} />

                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>
                    {t("wallet.credit")}
                  </Text>

                  <Text style={styles.totalValue}>
                    ₹{plan.credits}
                  </Text>
                </View>
              </Animated.View>
            </>
          )
        )}

        {/* Pay Using: UPI apps installed on this phone */}
        <View style={styles.methodSection}>
          <Text style={styles.methodSectionTitle}>
            {t("wallet.payUsingUpi")}
          </Text>

          {!showUpiPicker ? (
            <Text style={styles.methodEmpty}>
              {t("wallet.razorpayPage")}
            </Text>
          ) : (
            <>
            {/* PhonePe / Google Pay: a dropdown (shown even if not installed) */}
            {(() => {
              const options = ALLOWED_UPI_APPS.map((allowed) => {
                const item = upiApps.find((a) => a.packageName === upiAppKey(allowed));
                return {
                  key: upiAppKey(allowed),
                  name: item?.appName || allowed.appName,
                  installed: Boolean(item),
                  // Bundled original logo (same whether installed or not).
                  logo: allowed.logo,
                  // Razorpay's official logo URL first, then the icon read from
                  // the phone (with or without a data: prefix).
                  icon:
                    item?.appLogo ||
                    (item?.iconBase64
                      ? item.iconBase64.startsWith("data:")
                        ? item.iconBase64
                        : `data:image/png;base64,${item.iconBase64}`
                      : undefined),
                };
              });
              // The app last picked (shown even while "Pay with UPI ID" is chosen).
              const selected =
                options.find((o) => o.key === selectedApp) ?? options[0];
              const appChosen = !payByUpiId;

              const optionIcon = (option: (typeof options)[number]) => (
                <View style={styles.methodIcon}>
                  {option.logo ? (
                    <Image source={option.logo} style={styles.methodLogo} resizeMode="contain" />
                  ) : option.icon ? (
                    <Image source={{ uri: option.icon }} style={styles.methodLogo} />
                  ) : (
                    <MaterialCommunityIcons
                      name={option.installed ? "bank-transfer" : "cellphone-arrow-down"}
                      size={18}
                      color={COLORS.plum}
                    />
                  )}
                </View>
              );

              return (
                <View>
                  <Pressable
                    onPress={() => {
                      // Tapping the box also switches back from "Pay with UPI ID".
                      if (!appChosen) setSelectedApp(selected.key);
                      setPickerOpen((open) => !open);
                    }}
                    disabled={loading}
                    style={[styles.methodCard, appChosen && styles.methodCardActive]}
                  >
                    {optionIcon(selected)}
                    <Text style={styles.methodTitle}>
                      {selected.name}
                      {!selected.installed && (
                        <Text style={styles.notInstalled}>{"  · "}{t("wallet.notInstalled")}</Text>
                      )}
                    </Text>
                    <Ionicons
                      name={pickerOpen ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={COLORS.plum}
                    />
                  </Pressable>

                  {pickerOpen && (
                    <View style={styles.dropdown}>
                      {options.map((option, index) => {
                        const active = appChosen && option.key === selected.key;
                        return (
                          <Pressable
                            key={option.key}
                            onPress={() => {
                              setSelectedApp(option.key);
                              setPickerOpen(false);
                            }}
                            style={[
                              styles.dropdownItem,
                              index > 0 && styles.dropdownDivider,
                              active && styles.dropdownItemActive,
                            ]}
                          >
                            {optionIcon(option)}
                            <Text style={styles.methodTitle}>
                              {option.name}
                              {!option.installed && (
                                <Text style={styles.notInstalled}>{"  · "}{t("wallet.notInstalled")}</Text>
                              )}
                            </Text>
                            {active && (
                              <Ionicons name="checkmark" size={18} color={COLORS.plum} />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {appChosen && !selected.installed && (
                    <View style={styles.installRow}>
                      <Text style={styles.installText}>
                        {t("wallet.appNotInstalled", { app: selected.name })}
                      </Text>
                      <Pressable
                        onPress={() => {
                          const store = ALLOWED_UPI_APPS.find((a) => upiAppKey(a) === selected.key);

                          if (Platform.OS === "ios") {
                            if (store) Linking.openURL(store.appStoreUrl);
                            return;
                          }

                          Linking.openURL(`market://details?id=${selected.key}`).catch(() =>
                            Linking.openURL(
                              `https://play.google.com/store/apps/details?id=${selected.key}`
                            )
                          );
                        }}
                        style={styles.installButton}
                      >
                        <Text style={styles.installButtonText}>{t("wallet.install")}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Pay with UPI ID (UPI collect): its own option, outside the dropdown */}
            <Pressable
              onPress={() => {
                setSelectedApp(UPI_ID_OPTION);
                setPickerOpen(false);
              }}
              disabled={loading}
              style={[styles.methodCard, payByUpiId && styles.methodCardActive]}
            >
              <View style={styles.methodIcon}>
                <MaterialCommunityIcons name="at" size={18} color={COLORS.plum} />
              </View>

              <Text style={styles.methodTitle}>{t("wallet.payWithUpiId")}</Text>

              <Ionicons
                name={payByUpiId ? "radio-button-on" : "radio-button-off"}
                size={18}
                color={payByUpiId ? COLORS.plum : COLORS.secondary}
              />
            </Pressable>

            {payByUpiId && (
              <View style={styles.upiBox}>
                <View style={styles.upiRow}>
                  <TextInput
                    value={upiId}
                    onChangeText={(value) => {
                      setUpiId(value.replace(/\s/g, ""));
                      setUpiCheck({ status: "idle" });
                    }}
                    onSubmitEditing={verifyUpiId}
                    // Bring the field above the keyboard once it opens.
                    onFocus={() =>
                      setTimeout(
                        () => scrollRef.current?.scrollToEnd({ animated: true }),
                        300
                      )
                    }
                    placeholder="name@okicici"
                    placeholderTextColor={COLORS.secondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!loading}
                    style={styles.upiInput}
                  />

                  <Pressable
                    onPress={verifyUpiId}
                    disabled={loading || upiCheck.status === "checking" || !upiId.trim()}
                    style={[
                      styles.upiVerify,
                      (!upiId.trim() || upiCheck.status === "checking") &&
                        styles.payButtonDisabled,
                    ]}
                  >
                    {upiCheck.status === "checking" ? (
                      <ActivityIndicator size="small" color={COLORS.card} />
                    ) : (
                      <Text style={styles.upiVerifyText}>
                        {verifiedUpiId ? t("wallet.verified") : t("wallet.verify")}
                      </Text>
                    )}
                  </Pressable>
                </View>

                {upiCheck.status === "valid" && verifiedUpiId && (
                  upiCheck.confirmed ? (
                    <View style={styles.upiResult}>
                      <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                      <Text style={styles.upiValid}>
                        {upiCheck.name ? upiCheck.name : t("wallet.upiVerified")}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.upiResult}>
                      <Ionicons name="information-circle" size={16} color={COLORS.gold} />
                      <Text style={styles.upiUnconfirmed}>
                        {t("wallet.nameUnconfirmed")}
                      </Text>
                    </View>
                  )
                )}

                {upiCheck.status === "invalid" && (
                  <View style={styles.upiResult}>
                    <Ionicons name="alert-circle" size={16} color={COLORS.terracotta} />
                    <Text style={styles.upiInvalid}>{upiCheck.message}</Text>
                  </View>
                )}

                <Text style={styles.upiHint}>
                  {t("wallet.upiHint")}
                </Text>
              </View>
            )}
            </>
          )}
        </View>

        {notice && (
          <Text
            style={[
              styles.notice,
              notice.kind === "error"
                ? styles.noticeError
                : styles.noticeSuccess,
            ]}
          >
            {notice.text}
          </Text>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {/* Google/Apple accounts: Razorpay needs a mobile number (asked once). */}
        {needsContact && (
          <View style={styles.contactBox}>
            <Text style={styles.contactLabel}>{t("wallet.contactLabel")}</Text>
            <TextInput
              value={contact}
              onChangeText={(value) => setContact(value.replace(/\D/g, "").slice(0, 10))}
              placeholder={t("wallet.contactPlaceholder")}
              placeholderTextColor={COLORS.secondary}
              keyboardType="number-pad"
              autoComplete="tel"
              maxLength={10}
              editable={!loading}
              style={styles.contactInput}
            />
          </View>
        )}

        <Pressable
          onPress={handlePay}
          disabled={!canPay}
          style={[
            styles.payButton,
            !canPay && styles.payButtonDisabled,
          ]}
        >
          {canPay && !loading && <Shine />}
          {loading ? (
            <>
              <ActivityIndicator
                size="small"
                color={COLORS.card}
              />

              <Text style={styles.payText}>
                {t("wallet.processing")}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.payText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                {plan
                  ? payByUpiId
                    ? t("wallet.payViaUpiId", { amount: plan.price_inr })
                    : app
                      ? t("wallet.payWithApp", { amount: plan.price_inr, app: app.appName })
                      : t("wallet.pay", { amount: plan.price_inr })
                  : t("wallet.proceed")}
              </Text>

              <Ionicons
                name="arrow-forward"
                size={17}
                color={COLORS.card}
              />
            </>
          )}
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* Animations (all still when the phone asks for reduced motion) */

/** Dashed ring that turns slowly behind the balance. */
function SpinRing() {
  const still = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    turn.value = withRepeat(withTiming(360, { duration: 24000, easing: Easing.linear }), -1);
  }, [still, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return <Animated.View style={[styles.balanceRingInner, style]} />;
}

/** Gold sparkle that fades and grows in a loop. */
function Twinkle({ style, size, delay }: { style: object; size: number; delay: number }) {
  const still = useReducedMotion();
  const glow = useSharedValue(1);

  useEffect(() => {
    if (still) return;
    glow.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.35, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })
        ),
        -1
      )
    );
  }, [still, glow, delay]);

  const animated = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.75 + glow.value * 0.35 }],
  }));

  return (
    <Animated.View style={[style, animated]}>
      <MaterialCommunityIcons name="star-four-points" size={size} color={COLORS.gold} />
    </Animated.View>
  );
}

/** Gentle up-and-down float. */
function Float({ children }: { children: ReactNode }) {
  const still = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    y.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, [still, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Balance that counts up to its value (and to the new value after a recharge). */
function CountUpBalance({ value }: { value: number }) {
  const still = useReducedMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (still) return;
    const start = from.current;
    const began = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - began) / 900);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = start + (value - start) * eased;
      from.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, still]);

  return <Text style={styles.balanceValue}>₹{(still ? value : shown).toFixed(2)}</Text>;
}

/** Pack card: staggered entrance and a small spring pop when chosen. */
function PackPop({ index, active, children }: { index: number; active: boolean; children: ReactNode }) {
  const still = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (still || !active) return;
    scale.value = withSequence(withTiming(1.07, { duration: 120 }), withSpring(1, { damping: 9, stiffness: 180 }));
  }, [active, still, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View entering={FadeInDown.delay(150 + index * 70).duration(400)} style={[{ flex: 1 }, style]}>
      {children}
    </Animated.View>
  );
}

/** Light streak that sweeps across the Pay button every few seconds. */
function Shine() {
  const still = useReducedMotion();
  const x = useSharedValue(-120);

  useEffect(() => {
    if (still) return;
    x.value = withRepeat(
      withSequence(
        withTiming(-120, { duration: 0 }),
        withDelay(1800, withTiming(420, { duration: 900, easing: Easing.inOut(Easing.quad) }))
      ),
      -1
    );
  }, [still, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { skewX: "-20deg" }] }));
  if (still) return null;
  return <Animated.View pointerEvents="none" style={[styles.shine, style]} />;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  /* Header */

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 8,
    paddingBottom: 16,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
  },

  headerContent: {
    flex: 1,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.ink,
    letterSpacing: -0.3,
  },

  subtitle: {
    marginTop: 1,
    fontSize: 12.5,
    color: COLORS.secondary,
  },

  sparkleOne: {
    position: "absolute",
    top: 18,
    right: 92,
  },

  sparkleTwo: {
    position: "absolute",
    bottom: 22,
    right: 120,
  },

  /* Current balance */

  balanceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: COLORS.plum,
    ...softShadow,
    shadowOpacity: 0.25,
  },

  balanceRing: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: "rgba(255,253,252,0.12)",
  },

  balanceRingInner: {
    position: "absolute",
    top: -36,
    right: -16,
    width: 122,
    height: 122,
    borderRadius: 61,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,253,252,0.16)",
  },

  balanceLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: "rgba(255,253,252,0.65)",
  },

  balanceValue: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: COLORS.card,
  },

  balanceHint: {
    marginTop: 2,
    fontSize: 12,
    color: "rgba(255,253,252,0.7)",
  },

  balanceIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,253,252,0.12)",
    borderWidth: 1,
    borderColor: "rgba(196,154,74,0.5)",
  },

  sectionTitle: {
    marginTop: 24,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.ink,
  },

  /* Plans */

  // All packs in one row.
  plansRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
  },

  planCard: {
    flex: 1,
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 10,
    paddingHorizontal: 3,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    ...softShadow,
    shadowOpacity: 0.05,
  },

  planCardActive: {
    borderColor: COLORS.plum,
    backgroundColor: COLORS.soft,
  },

  popularTag: {
    position: "absolute",
    top: -9,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: COLORS.gold,
  },

  popularText: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: COLORS.card,
  },

  planAmount: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.ink,
  },

  bonusPill: {
    marginTop: 6,
    maxWidth: "100%",
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: COLORS.successBg,
  },

  bonusText: {
    fontSize: 9,
    fontWeight: "600",
    color: COLORS.success,
  },

  /* Summary */

  offerText: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    overflow: "hidden",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    color: COLORS.success,
    backgroundColor: COLORS.successBg,
  },

  summaryCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    ...softShadow,
  },

  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.ink,
    marginBottom: 10,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
  },

  summaryLabel: {
    fontSize: 13.5,
    color: COLORS.secondary,
  },

  summaryValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.ink,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.line,
    marginVertical: 8,
  },

  totalLabel: {
    fontSize: 14.5,
    fontWeight: "700",
    color: COLORS.ink,
  },

  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.plum,
  },

  /* Payment method */

  methodSection: {
    marginTop: 24,
  },

  methodSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.ink,
  },

  methodEmpty: {
    marginTop: 8,
    fontSize: 12.5,
    color: COLORS.secondary,
  },

  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.line,
  },

  notInstalled: {
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.secondary,
  },

  installRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },

  installText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.secondary,
  },

  installButton: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.plum,
  },

  installButtonText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: COLORS.card,
  },

  dropdown: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: "hidden",
    ...softShadow,
  },

  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  dropdownDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },

  dropdownItemActive: {
    backgroundColor: COLORS.soft,
  },

  methodCardActive: {
    borderColor: COLORS.plum,
    backgroundColor: "#FAF7FD",
  },

  methodIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.soft,
    overflow: "hidden",
  },

  methodLogo: {
    width: 22,
    height: 22,
  },

  methodTitle: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14.5,
    fontWeight: "600",
    color: COLORS.ink,
  },

  /* Pay with UPI ID */

  upiBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
  },

  upiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  upiInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    fontSize: 14,
    color: COLORS.ink,
  },

  upiVerify: {
    height: 44,
    minWidth: 84,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.plum,
  },

  upiVerifyText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.card,
  },

  upiResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },

  upiValid: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.success,
  },

  upiUnconfirmed: {
    flex: 1,
    fontSize: 12,
    color: COLORS.secondary,
  },

  upiInvalid: {
    flex: 1,
    fontSize: 12,
    color: COLORS.terracotta,
  },

  upiHint: {
    marginTop: 8,
    fontSize: 11.5,
    color: COLORS.secondary,
  },

  /* Status message */

  notice: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    overflow: "hidden",
    fontSize: 12.5,
    textAlign: "center",
  },

  noticeError: {
    color: "#B3392F",
    backgroundColor: "#F8E4E1",
  },

  noticeSuccess: {
    color: COLORS.success,
    backgroundColor: COLORS.successBg,
  },

  loadingPlans: {
    marginTop: 24,
  },

  /* Footer */

  contactBox: {
    marginBottom: 10,
  },

  contactLabel: {
    marginBottom: 6,
    fontSize: 12.5,
    fontWeight: "600",
    color: COLORS.ink,
  },

  contactInput: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    fontSize: 14,
    color: COLORS.ink,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },

  payButton: {
    overflow: "hidden",
    height: 52,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.plum,
  },

  shine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 60,
    backgroundColor: "rgba(255,253,252,0.16)",
  },

  payButtonDisabled: {
    opacity: 0.6,
  },

  payText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.card,
  },
});
