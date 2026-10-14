import {
  AppleAuthProvider,
  getAuth,
  getIdToken,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPhoneNumber,
  signOut,
} from "@react-native-firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

import { GOOGLE_WEB_CLIENT_ID } from "../components/constants/app";
import { API_URL } from "./auth";

/**
 * Phone (SMS OTP), Google and Apple sign-in, all through Firebase.
 *
 * Firebase verifies the user; the app then sends Firebase's ID token to
 * POST /api/auth/firebase, which logs in or signs up and returns our own
 * access token. The Firebase session itself is not kept.
 */

export type PhoneConfirmation = Awaited<
  ReturnType<typeof signInWithPhoneNumber>
>;

export type BackendSession = {
  access_token: string;
  user_id: string;
  onboarded: boolean;
  created: boolean;
};

let googleConfigured = false;

function configureGoogle() {
  if (googleConfigured) return;

  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error("Google sign-in is not set up yet.");
  }

  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  googleConfigured = true;
}

/** Sends the SMS code. `phoneNumber` includes the country code. */
export function sendPhoneOtp(phoneNumber: string): Promise<PhoneConfirmation> {
  return signInWithPhoneNumber(getAuth(), phoneNumber);
}

/** Checks the SMS code and returns the Firebase ID token. */
export async function confirmPhoneOtp(
  confirmation: PhoneConfirmation,
  code: string
): Promise<string> {
  const result = await confirmation.confirm(code);
  const user = result?.user ?? getAuth().currentUser;

  if (!user) {
    throw new Error("Could not verify the code. Please try again.");
  }

  return getIdToken(user);
}

/**
 * Shows the Google account picker and returns the Firebase ID token,
 * or null if the user closed the picker.
 */
export async function googleFirebaseToken(): Promise<string | null> {
  configureGoogle();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Sign out first so the account picker shows every time.
    await GoogleSignin.signOut().catch(() => null);

    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) return null;

    const idToken = response.data.idToken;

    if (!idToken) {
      throw new Error("Google did not return an ID token.");
    }

    const result = await signInWithCredential(
      getAuth(),
      GoogleAuthProvider.credential(idToken)
    );

    return getIdToken(result.user);
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (
        error.code === statusCodes.SIGN_IN_CANCELLED ||
        error.code === statusCodes.IN_PROGRESS
      ) {
        return null;
      }

      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error("Google Play Services is not available on this phone.");
      }
    }

    throw error;
  }
}

/** Whether this iPhone offers Sign in with Apple. */
export function appleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

/**
 * Shows the Apple sign-in sheet and returns the Firebase ID token (plus
 * the user's name, which Apple only shares on the first sign-in), or null
 * if the user closed the sheet.
 */
export async function appleFirebaseToken(): Promise<{ token: string; name: string } | null> {
  // Firebase checks that Apple's token was issued for this exact request.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;

  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "ERR_REQUEST_CANCELED") return null;
    throw error;
  }

  if (!credential.identityToken) {
    throw new Error("Apple did not return a sign-in token.");
  }

  const result = await signInWithCredential(
    getAuth(),
    AppleAuthProvider.credential(credential.identityToken, rawNonce)
  );

  const name = credential.fullName
    ? AppleAuthentication.formatFullName(credential.fullName).trim()
    : "";

  return { token: await getIdToken(result.user), name };
}

/** Exchanges a Firebase ID token for our backend session. */
export async function signInWithBackend(
  firebaseIdToken: string,
  referralCode?: string,
  // Apple: the name from the first sign-in, for new accounts.
  name?: string
): Promise<BackendSession> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/api/auth/firebase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firebase_id_token: firebaseIdToken,
        referral_code: referralCode || null,
        name: name || null,
      }),
    });
  } catch {
    throw new Error("No connection. Check your internet and try again.");
  } finally {
    // Our backend session replaces Firebase's.
    signOut(getAuth()).catch(() => null);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.access_token) {
    throw new Error(
      data?.detail || "Could not sign you in. Please try again."
    );
  }

  return data as BackendSession;
}

/** Turns Firebase phone-auth errors into messages for the user. */
export function phoneAuthMessage(error: unknown): string {
  const code = String((error as { code?: string })?.code ?? "");

  if (code.includes("invalid-verification-code")) {
    return "That code is incorrect. Please check and try again.";
  }
  if (code.includes("session-expired") || code.includes("code-expired")) {
    return "This code has expired. Please request a new one.";
  }
  if (code.includes("invalid-phone-number")) {
    return "Enter a valid mobile number.";
  }
  if (code.includes("too-many-requests") || code.includes("quota-exceeded")) {
    return "Too many attempts. Please try again later.";
  }
  if (code.includes("operation-not-allowed")) {
    // Sign-in method or SMS region not enabled in Firebase.
    return "Phone sign-in isn't available for this number yet. Please try Google sign-in.";
  }
  if (code.includes("network-request-failed")) {
    return "No connection. Check your internet and try again.";
  }

  return (error as Error)?.message || "Something went wrong. Please try again.";
}
