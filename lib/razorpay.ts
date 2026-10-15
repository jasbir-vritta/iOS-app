/**
 * Razorpay Custom UI (react-native-customui): UPI app list + UPI intent payments.
 *
 * Works on iPhone too: there the UPI app is named by Razorpay's identifier
 * ("phonepe", "google_pay") instead of an Android package name. Without the
 * native SDK (Expo Go) `isRazorpayAvailable` is false and the wallet pays on
 * Razorpay's page instead.
 */
import { NativeModules } from "react-native";

export type UpiApp = {
  appName: string;
  packageName: string;
  iconBase64?: string;
  appLogo?: string;
};

export type UpiPaymentOptions = {
  key_id: string;
  order_id: string;
  amount: number; // paise
  currency: string;
  contact: string;
  email: string;
  upi_app_package_name: string;
  description?: string;
};

export type PaymentSuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export const isRazorpayAvailable = Boolean(NativeModules.RazorpayCustomui);

// Loaded only when the native module exists (its import touches native code).
const Razorpay = isRazorpayAvailable
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react-native-customui").default
  : null;

let initializedKey: string | null = null;

function init(keyId: string) {
  if (Razorpay && initializedKey !== keyId) {
    // Returns a promise that never settles; the call itself is synchronous.
    Razorpay.initRazorpay(keyId);
    initializedKey = keyId;
  }
}

/** UPI apps installed on this phone (GPay, PhonePe, Paytm, ...). */
export async function getUpiApps(keyId: string): Promise<UpiApp[]> {
  if (!Razorpay) {
    return [];
  }
  init(keyId);
  const result = await Razorpay.getAppsWhichSupportUPI();
  return Array.isArray(result?.data) ? result.data : [];
}

/** Opens the chosen UPI app to pay for a Razorpay order. Rejects on failure/cancel. */
export async function payWithUpiApp(
  options: UpiPaymentOptions
): Promise<PaymentSuccess> {
  if (!Razorpay) {
    throw new Error("Payments need the app build, not Expo Go.");
  }
  init(options.key_id);
  return Razorpay.open({
    ...options,
    amount: String(options.amount),
    method: "upi",
    "_[flow]": "intent",
  });
}

export type UpiIdPaymentOptions = Omit<UpiPaymentOptions, "upi_app_package_name"> & {
  /** The payer's UPI ID, e.g. name@okicici (check it first with /wallet/upi/validate). */
  vpa: string;
};

/**
 * Pays by UPI ID (UPI "collect"): the payer gets a request in their UPI app
 * and approves it there; resolves once paid. Rejects on failure/cancel/timeout.
 *
 * NPCI phased out UPI collect on 28 Feb 2026 except for some cases (e.g. iOS
 * apps), so Razorpay may refuse it — the rejection's description is shown.
 */
export async function payWithUpiId(
  options: UpiIdPaymentOptions
): Promise<PaymentSuccess> {
  if (!Razorpay) {
    throw new Error("Payments need the app build, not Expo Go.");
  }
  init(options.key_id);
  return Razorpay.open({
    ...options,
    amount: String(options.amount),
    method: "upi",
    "_[flow]": "collect",
    vpa: options.vpa,
  });
}
