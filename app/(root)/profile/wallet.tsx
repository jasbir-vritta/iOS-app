import {
    Ionicons,
    MaterialCommunityIcons,
} from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
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
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { track } from "../../../lib/analytics";
import { useUserStore } from "../../../components/stores/userStore";
import { API_URL, authHeaders } from "../../../lib/auth";
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
  ink: "#1C1820",
  plum: "#2B1A3D",
  terracotta: "#A94C36",
  gold: "#C49A4A",
  secondary: "#68616A",
  success: "#2F7D3E",
  successBg: "#E8F3E6",
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
          throw new Error(data.detail || "Could not load plans.");
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
            text: "Could not load recharge plans. Please try again.",
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
      setUpiCheck({ status: "invalid", message: "Enter a valid UPI ID, e.g. name@okicici." });
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
          typeof data?.detail === "string" ? data.detail : "Could not check the UPI ID."
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
          : { status: "invalid", message: "This UPI ID doesn't exist. Please check it." }
      );
    } catch (error: any) {
      setUpiCheck({
        status: "invalid",
        message: error?.message || "Could not check the UPI ID. Please try again.",
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
            "Could not start the payment."
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
            text: "Payment not completed. If money was deducted, your balance will update shortly.",
          });
          return;
        }

        updateUser({ credits });
        track("recharge_completed", {
          amount_inr: plan.price_inr,
          credits: plan.credits,
          method: payByUpiId ? "upi_id" : "upi_app",
        });

        setNotice({
          kind: "success",
          text: `₹${plan.credits} added to your wallet.`,
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
          text: `Payment request sent to ${verifiedUpiId}. Approve it in your UPI app.`,
        });
      }

      const payment =
        payByUpiId && verifiedUpiId
          ? await payWithUpiId({ ...common, vpa: verifiedUpiId })
          : await payWithUpiApp({ ...common, upi_app_package_name: app!.packageName });

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
            "Payment received but not confirmed yet. Your balance will update shortly."
        );
      }

      /*
       * Always use the balance from the server instead of
       * calculating it on the device.
       */
      updateUser({
        credits: Number(result.credits ?? 0),
      });

      track("recharge_completed", {
        amount_inr: plan.price_inr,
        credits: plan.credits,
        method: payByUpiId ? "upi_id" : "upi_app",
      });

      setNotice({
        kind: "success",
        text: `₹${plan.credits} added to your wallet.`,
      });
    } catch (error: any) {
      console.error("Wallet top-up failed:", error);

      // Razorpay rejects with { code, description }; fetch errors are Errors.
      const text =
        error?.description ||
        error?.message ||
        "Payment failed. Please try again.";

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
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={COLORS.ink}
            />
          </Pressable>

          <View style={styles.headerContent}>
            <Text style={styles.title}>Low Balance!</Text>

            <Text style={styles.subtitle}>
              Recharge to continue without interruptions.
            </Text>
          </View>

          <View style={styles.illustration}>
            <MaterialCommunityIcons
              name="wallet"
              size={46}
              color={COLORS.terracotta}
            />

            <MaterialCommunityIcons
              name="star-four-points"
              size={12}
              color={COLORS.gold}
              style={styles.sparkleOne}
            />

            <MaterialCommunityIcons
              name="star-four-points"
              size={9}
              color={COLORS.gold}
              style={styles.sparkleTwo}
            />
          </View>
        </View>

        {/* Current Balance */}
        <View style={styles.balanceCard}>
          <View>
            <Text style={styles.balanceLabel}>
              Current Wallet Balance
            </Text>

            <Text style={styles.balanceValue}>
              ₹{currentBalance.toFixed(2)}
            </Text>
          </View>

          <View style={styles.balanceIcon}>
            <MaterialCommunityIcons
              name="wallet-outline"
              size={18}
              color={COLORS.plum}
            />
          </View>
        </View>

        {loadingPacks ? (
          <ActivityIndicator
            style={styles.loadingPlans}
            color={COLORS.plum}
          />
        ) : (
          plan && (
            <>
              {/* Plans */}
              <View style={styles.plansRow}>
                {packs.map((item) => {
                  const active = item.id === plan.id;

                  return (
                    <Pressable
                      key={item.id}
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
                            POPULAR
                          </Text>
                        </View>
                      )}

                      <Text style={styles.planAmount}>
                        ₹{item.price_inr}
                      </Text>

                      {item.bonus > 0 && (
                        <View style={styles.bonusPill}>
                          <Text style={styles.bonusText}>
                            Extra ₹{item.bonus}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* What the selected pack adds */}
              <Text style={styles.offerText}>
                {plan.bonus > 0
                  ? `Congratulations! ₹${plan.credits} will be added to your wallet.`
                  : `₹${plan.credits} will be added to your wallet.`}
              </Text>

              {/* Payment Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>
                  Payment Summary
                </Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Recharge amount
                  </Text>

                  <Text style={styles.summaryValue}>
                    ₹{plan.price_inr}
                  </Text>
                </View>

                {plan.bonus > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Extra
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
                    Wallet credit
                  </Text>

                  <Text style={styles.totalValue}>
                    ₹{plan.credits}
                  </Text>
                </View>
              </View>
            </>
          )
        )}

        {/* Pay Using: UPI apps installed on this phone */}
        <View style={styles.methodSection}>
          <Text style={styles.methodSectionTitle}>
            Pay using UPI
          </Text>

          {!showUpiPicker ? (
            <Text style={styles.methodEmpty}>
              You&apos;ll choose your UPI app on the secure Razorpay page.
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
                        <Text style={styles.notInstalled}>  · Not installed</Text>
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
                                <Text style={styles.notInstalled}>  · Not installed</Text>
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
                        {selected.name} isn&apos;t installed on this phone.
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
                        <Text style={styles.installButtonText}>Install</Text>
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

              <Text style={styles.methodTitle}>Pay with UPI ID</Text>

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
                        {verifiedUpiId ? "Verified" : "Verify"}
                      </Text>
                    )}
                  </Pressable>
                </View>

                {upiCheck.status === "valid" && verifiedUpiId && (
                  upiCheck.confirmed ? (
                    <View style={styles.upiResult}>
                      <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                      <Text style={styles.upiValid}>
                        {upiCheck.name ? upiCheck.name : "UPI ID verified"}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.upiResult}>
                      <Ionicons name="information-circle" size={16} color={COLORS.gold} />
                      <Text style={styles.upiUnconfirmed}>
                        Couldn&apos;t confirm the name. Check the UPI ID is correct before paying.
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
                  You&apos;ll get a payment request in your UPI app — approve it there to finish.
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
            <Text style={styles.contactLabel}>Mobile number for UPI payment</Text>
            <TextInput
              value={contact}
              onChangeText={(value) => setContact(value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile number"
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
          {loading ? (
            <>
              <ActivityIndicator
                size="small"
                color={COLORS.card}
              />

              <Text style={styles.payText}>
                Processing...
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.payText}>
                {plan
                  ? `Pay ₹${plan.price_inr}${
                      payByUpiId
                        ? " via UPI ID"
                        : app
                          ? ` with ${app.appName}`
                          : ""
                    }`
                  : "Proceed to Pay"}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 17,
    paddingBottom: 17,
  },

  /* Header */

  header: {
    minHeight: 110,
    paddingTop: 7,
  },

  backButton: {
    width: 37,
    height: 37,
    marginLeft: -8,
    justifyContent: "center",
  },

  headerContent: {
    alignItems: "center",
    marginTop: 3,
    paddingHorizontal: 34,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.terracotta,
    letterSpacing: -0.3,
  },

  subtitle: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.secondary,
    textAlign: "center",
  },

  illustration: {
    position: "absolute",
    right: 0,
    top: 3,
    width: 60,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },

  sparkleOne: {
    position: "absolute",
    top: 0,
    right: 2,
  },

  sparkleTwo: {
    position: "absolute",
    bottom: 3,
    left: 3,
  },

  /* Current Balance */

  balanceCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 3,
    padding: 10,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  balanceLabel: {
    fontSize: 10,
    color: COLORS.secondary,
  },

  balanceValue: {
    marginTop: 1,
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.ink,
  },

  balanceIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEE6F2",
  },

  /* Plans */

  plansRow: {
    flexDirection: "row",
    gap: 7,
    marginTop: 14,
  },

  planCard: {
    flex: 1,
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 8,
    paddingHorizontal: 5,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },

  planCardActive: {
    borderColor: COLORS.plum,
  },

  popularTag: {
    position: "absolute",
    top: -9,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: COLORS.gold,
  },

  popularText: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: COLORS.ink,
  },

  planAmount: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.ink,
  },

  bonusPill: {
    marginTop: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: COLORS.successBg,
  },

  bonusText: {
    fontSize: 9,
    fontWeight: "600",
    color: COLORS.success,
  },

  /* Summary */

  offerText: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    overflow: "hidden",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    color: COLORS.success,
    backgroundColor: COLORS.successBg,
  },

  summaryCard: {
    marginTop: 15,
    padding: 15,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.ink,
    marginBottom: 12,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
  },

  summaryLabel: {
    fontSize: 13,
    color: COLORS.ink,
  },

  summaryValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.ink,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },

  totalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.ink,
  },

  totalValue: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.ink,
  },

  /* Payment Method */

  methodSection: {
    marginTop: 15,
  },

  methodSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.ink,
  },

  methodEmpty: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.secondary,
  },

  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
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
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.plum,
  },

  installButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.card,
  },

  dropdown: {
    marginTop: 6,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },

  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  dropdownDivider: {
    borderTopWidth: 1,
    borderTopColor: "#EEE6F2",
  },

  dropdownItemActive: {
    backgroundColor: "#F6F1FA",
  },

  methodCardActive: {
    borderColor: COLORS.plum,
  },

  methodIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEE6F2",
    overflow: "hidden",
  },

  methodLogo: {
    width: 22,
    height: 22,
  },

  methodTitle: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.ink,
  },

  /* Pay with UPI ID */

  upiBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  upiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  upiInput: {
    flex: 1,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FFFFFF",
    fontSize: 14,
    color: COLORS.ink,
  },

  upiVerify: {
    height: 42,
    minWidth: 78,
    paddingHorizontal: 12,
    borderRadius: 11,
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
    fontSize: 11,
    color: COLORS.secondary,
  },

  /* Status message */

  notice: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    fontSize: 12,
    textAlign: "center",
  },

  noticeError: {
    color: COLORS.terracotta,
    backgroundColor: "#F8E7E2",
  },

  noticeSuccess: {
    color: COLORS.success,
    backgroundColor: COLORS.successBg,
  },

  loadingPlans: {
    marginTop: 20,
  },

  /* Footer */

  contactBox: {
    marginBottom: 8,
  },

  contactLabel: {
    marginBottom: 5,
    fontSize: 12.5,
    fontWeight: "600",
    color: COLORS.ink,
  },

  contactInput: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FFFFFF",
    fontSize: 14,
    color: COLORS.ink,
  },

  footer: {
    paddingHorizontal: 17,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: COLORS.background,
  },

  payButton: {
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.plum,
  },

  payButtonDisabled: {
    opacity: 0.7,
  },

  payText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.card,
  },
});