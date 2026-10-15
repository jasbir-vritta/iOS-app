// app/(auth)/index.jsx: sign up / log in (design: "Vritta Login - Sign Up Final").
import { useFonts } from "expo-font";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppleIcon, BackButton, ChevronDown, GlassButton, GoldButton, GoogleIcon, LockIcon, PhoneIcon, SolidButton, Steps,
} from "../../components/auth/AuthParts";
import { CosmicBackground } from "../../components/auth/CosmicBackground";
import { AUTH, AUTH_FONTS, F } from "../../components/auth/theme";
import { VrittaLogo } from "../../components/auth/VrittaLogo";
import countryCodes from "../../components/constants/country_codes.json";
import useAuthStore from "../../components/stores/authStore";
import { useKeyboardInset } from "../../components/utils/useKeyboardInset";
import { identifyUser, track } from "../../lib/analytics";
import { saveSession } from "../../lib/auth";
import {
  appleFirebaseToken,
  appleSignInAvailable,
  confirmPhoneOtp,
  googleFirebaseToken,
  phoneAuthMessage,
  sendPhoneOtp,
  signInWithBackend,
} from "../../lib/firebaseAuth";

// Main app (tabs). "/" is the launch screen, not home.
const HOME_ROUTE = "/(root)/(tabs)";
const ONBOARDING_ROUTE = "/onboarding";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

// components/constants/country_codes.json: { name, dial_code, code }
const withPlus = (dial) => {
  const d = String(dial || "").replace(/\s+/g, "");
  return d ? (d.startsWith("+") ? d : `+${d}`) : "";
};

const COUNTRIES = countryCodes
  .map((c) => ({ name: c.name, code: c.code, dialCode: withPlus(c.dial_code) }))
  .filter((c) => c.name && c.dialCode && c.code);

// Apple, Google and phone (SMS OTP) all sign in through Firebase; the backend
// (POST /api/auth/firebase) then logs in an existing account or signs up
// a new one. Sign up and Log in differ only in wording.
const COPY = {
  signup: {
    title: "Create your account",
    sub: "It’s free. Your kundli is ready in under a minute.",
    verb: "Sign up",
    foot: "Already have an account?",
    switchTo: "Log In",
  },
  login: {
    title: "Welcome back",
    sub: "Sign in to continue your readings and chats.",
    verb: "Sign in",
    foot: "New to Vritta?",
    switchTo: "Create Account",
  },
};

export default function Login() {
  // Text waits for the fonts: measured with the system font first, words
  // like "Vritta" were cut off on iOS once the real font loaded.
  const [fontsLoaded] = useFonts(AUTH_FONTS);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();

  // welcome -> phone -> otp; "verifying" while talking to Firebase/backend.
  const [screen, setScreen] = useState("welcome");
  const [mode, setMode] = useState("signup");
  const [statusText, setStatusText] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [country, setCountry] = useState(COUNTRIES.find((c) => c.code === "IN") || COUNTRIES[0]);
  const [sending, setSending] = useState(false);

  const confirmation = useRef(null);
  const busy = useRef(false);
  const otpInput = useRef(null);

  // Sign in with Apple (required by the App Store next to Google sign-in).
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    appleSignInAvailable().then(setAppleAvailable).catch(() => null);
  }, []);

  // India: 10 digits starting 6-9. Other countries: 6-15 digits.
  const isIndia = country.code === "IN";
  const maxDigits = isIndia ? 10 : 15;
  const phoneValid = isIndia ? /^[6-9]\d{9}$/.test(phone) : /^\d{6,15}$/.test(phone);
  const fullPhone = `${country.dialCode}${phone}`;
  const phoneLabel = `${country.dialCode} ${isIndia ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone}`;

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const go = (next) => {
    setError("");
    setScreen(next);
  };

  // Backend session in hand: new users go to onboarding, others home.
  const finishSignIn = async (session, phoneNumber, method) => {
    await saveSession(session.access_token, phoneNumber);

    // Mixpanel: identify first so the event belongs to this user.
    await identifyUser(session.user_id, { phone: phoneNumber });
    track(session.created ? "sign_up_completed" : "login_completed", {
      sign_up_method: method,
      platform: Platform.OS,
    });

    if (!session.onboarded) {
      router.replace(ONBOARDING_ROUTE);
      return;
    }

    // Load the account before opening the app, so a failure shows here
    // instead of bouncing back to login.
    setStatusText("Signing you in…");
    await useAuthStore.getState().initializeAuth();

    const auth = useAuthStore.getState();
    if (!auth.isAuthenticated) {
      throw new Error(auth.error || "Could not load your account. Please try again.");
    }

    router.replace(HOME_ROUTE);
  };

  const sendCode = async () => {
    confirmation.current = await sendPhoneOtp(fullPhone);
    setCode("");
    setResendIn(RESEND_SECONDS);
  };

  const continueWithPhone = async () => {
    Keyboard.dismiss();
    if (!phoneValid || busy.current) return;

    busy.current = true;
    setSending(true);
    setError("");

    try {
      await sendCode();
      go("otp");
    } catch (e) {
      setError(phoneAuthMessage(e));
    } finally {
      busy.current = false;
      setSending(false);
    }
  };

  const resendCode = async () => {
    if (resendIn > 0 || busy.current) return;

    busy.current = true;
    setError("");

    try {
      await sendCode();
    } catch (e) {
      setError(phoneAuthMessage(e));
    } finally {
      busy.current = false;
    }
  };

  const verifyCode = async (value = code) => {
    Keyboard.dismiss();
    if (value.length !== OTP_LENGTH || !confirmation.current || busy.current) return;

    busy.current = true;
    setError("");
    setStatusText("Verifying your code…");
    setScreen("verifying");

    try {
      const firebaseToken = await confirmPhoneOtp(confirmation.current, value);
      const session = await signInWithBackend(firebaseToken);
      await finishSignIn(session, fullPhone, "phone");
    } catch (e) {
      setError(phoneAuthMessage(e));
      setCode("");
      setScreen("otp");
    } finally {
      busy.current = false;
    }
  };

  const continueWithGoogle = async () => {
    if (busy.current) return;

    busy.current = true;
    setError("");

    try {
      const firebaseToken = await googleFirebaseToken();

      // Picker closed: stay on the welcome screen.
      if (!firebaseToken) return;

      setStatusText("Signing in with Google…");
      setScreen("verifying");

      const session = await signInWithBackend(firebaseToken);
      await finishSignIn(session, undefined, "google");
    } catch (e) {
      setError(e?.message || "Google sign-in failed. Please try again.");
      setScreen("welcome");
    } finally {
      busy.current = false;
    }
  };

  const continueWithApple = async () => {
    if (busy.current) return;

    busy.current = true;
    setError("");

    try {
      const apple = await appleFirebaseToken();

      // Sheet closed: stay on the welcome screen.
      if (!apple) return;

      setStatusText("Signing in with Apple…");
      setScreen("verifying");

      // Apple shares the name only on the first sign-in.
      const session = await signInWithBackend(apple.token, undefined, apple.name);
      await finishSignIn(session, undefined, "apple");
    } catch (e) {
      setError(e?.message || "Apple sign-in failed. Please try again.");
      setScreen("welcome");
    } finally {
      busy.current = false;
    }
  };

  const copy = COPY[mode];

  if (!fontsLoaded) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <CosmicBackground art />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: keyboard.padding }]} onLayout={keyboard.onLayout}>
      <StatusBar style="light" />
      <CosmicBackground art={screen === "welcome"} />

      {screen === "welcome" && (
        <ScrollView
          contentContainerStyle={[styles.welcome, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.brand}>
            <VrittaLogo size={30} />
            <Text style={styles.brandName}>Vritta</Text>
          </View>

          <View style={styles.headline}>
            <Text style={styles.h1}>
              Astrology that{"\n"}
              <Text style={styles.h1Em}>knows you.</Text>
            </Text>
            <Text style={styles.lead}>
              Daily guidance from your birth chart and verified astrologers when you need them.
            </Text>
          </View>

          <View style={styles.sheet}>
            <Text style={styles.h2}>{copy.title}</Text>
            <Text style={styles.sub}>{copy.sub}</Text>

            <View style={styles.stack}>
              {appleAvailable ? (
                <>
                  <SolidButton label={`${copy.verb} with Apple`} icon={<AppleIcon />} onPress={continueWithApple} />
                  <GlassButton label={`${copy.verb} with Google`} icon={<GoogleIcon />} onPress={continueWithGoogle} />
                </>
              ) : (
                <SolidButton label={`${copy.verb} with Google`} icon={<GoogleIcon />} onPress={continueWithGoogle} />
              )}
              <GlassButton label={`${copy.verb} with Phone`} icon={<PhoneIcon />} onPress={() => go("phone")} />
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Text style={styles.foot}>
              {copy.foot}{" "}
              <Text style={styles.link} onPress={() => setMode(mode === "signup" ? "login" : "signup")}>
                {copy.switchTo}
              </Text>
            </Text>
            <Text style={styles.terms}>
              By continuing, you agree to our{" "}
              <Text style={styles.termsLink} onPress={() => router.push("/(root)/profile/terms")}>Terms</Text> and{" "}
              <Text style={styles.termsLink} onPress={() => router.push("/(root)/profile/privacy-policy")}>
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        </ScrollView>
      )}

      {screen === "phone" && (
        <View style={[styles.flow, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <BackButton onPress={() => go("welcome")} />
            <Steps done={1} />
            <Text style={styles.big}>Enter your phone number</Text>
            <Text style={styles.sub}>We’ll send a {OTP_LENGTH}-digit code by SMS to verify it.</Text>

            <View style={styles.field}>
              <Pressable style={styles.cc} onPress={() => setShowCountryPicker(true)}>
                <Text style={styles.ccText}>
                  {country.code} {country.dialCode}
                </Text>
                <ChevronDown />
              </Pressable>
              <TextInput
                value={phone}
                onChangeText={(v) => {
                  setPhone(v.replace(/\D/g, "").slice(0, maxDigits));
                  setError("");
                }}
                onSubmitEditing={continueWithPhone}
                keyboardType="phone-pad"
                autoComplete="tel-national"
                textContentType="telephoneNumber"
                placeholder={isIndia ? "98765 43210" : "Phone number"}
                placeholderTextColor="rgba(244,238,230,0.3)"
                selectionColor={AUTH.gold}
                maxLength={maxDigits}
                autoFocus
                style={styles.num}
              />
            </View>

            <View style={styles.help}>
              <LockIcon />
              <Text style={styles.helpText}>Your number stays private. Astrologers never see it.</Text>
            </View>
            {!!error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <GoldButton label="Send Code" onPress={continueWithPhone} disabled={!phoneValid} busy={sending} />
        </View>
      )}

      {screen === "otp" && (
        <View style={[styles.flow, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <BackButton onPress={() => go("phone")} />
            <Steps done={2} />
            <Text style={styles.big}>Enter the code</Text>
            <Text style={styles.sub}>
              Sent to {phoneLabel} ·{" "}
              <Text style={styles.link} onPress={() => go("phone")}>
                Edit
              </Text>
            </Text>

            {/* One hidden input drives the boxes, so paste and SMS autofill work. */}
            <Pressable style={styles.otp} onPress={() => otpInput.current?.focus()}>
              {Array.from({ length: OTP_LENGTH }, (_, i) => (
                <View key={i} style={[styles.otpBox, i === code.length && styles.otpBoxOn, !!error && styles.otpBoxError]}>
                  <Text style={styles.otpDigit}>{code[i] ?? ""}</Text>
                </View>
              ))}
            </Pressable>
            <TextInput
              ref={otpInput}
              value={code}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, "").slice(0, OTP_LENGTH);
                setCode(digits);
                setError("");
                if (digits.length === OTP_LENGTH) verifyCode(digits);
              }}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              maxLength={OTP_LENGTH}
              autoFocus
              style={styles.hiddenInput}
            />

            <Text style={styles.helpText}>
              Didn’t get it?{" "}
              {resendIn > 0 ? (
                <Text style={styles.helpStrong}>Resend in 0:{String(resendIn).padStart(2, "0")}</Text>
              ) : (
                <Text style={styles.link} onPress={resendCode}>
                  Resend code
                </Text>
              )}
            </Text>
            {!!error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <GoldButton label="Verify & Continue" onPress={() => verifyCode()} disabled={code.length !== OTP_LENGTH} />
        </View>
      )}

      {screen === "verifying" && (
        <View style={styles.verifying}>
          <ActivityIndicator size="large" color={AUTH.gold} />
          <Text style={styles.verifyingText}>{statusText}</Text>
        </View>
      )}

      {/* Country picker */}
      <Modal visible={showCountryPicker} transparent animationType="slide" onRequestClose={() => setShowCountryPicker(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowCountryPicker(false)} />
          <View style={[styles.countrySheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.countryTitle}>Select country</Text>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => `${item.code}-${item.dialCode}`}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setCountry(item);
                    setPhone("");
                    setError("");
                    setShowCountryPicker(false);
                  }}
                  style={[styles.countryRow, item.code === country.code && styles.countryRowOn]}
                >
                  <Text style={styles.countryCode}>{item.code}</Text>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryDial}>{item.dialCode}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AUTH.bg },

  // Welcome (sign up / log in)
  welcome: { flexGrow: 1, paddingHorizontal: 12, justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12 },
  brandName: { fontFamily: F.serif, fontSize: 24, color: AUTH.text, paddingRight: 4 },
  headline: { paddingHorizontal: 12, marginTop: 110, marginBottom: 28 },
  // paddingRight: room for the italic overhang of "knows you."
  h1: { fontFamily: F.serif, fontSize: 40, lineHeight: 43, color: AUTH.text, letterSpacing: -0.8, paddingRight: 8 },
  h1Em: { fontFamily: F.serifItalic, color: AUTH.gold },
  lead: { marginTop: 14, maxWidth: 290, fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: AUTH.muted },
  sheet: {
    padding: 18,
    paddingTop: 24,
    borderRadius: 28,
    backgroundColor: AUTH.sheet,
    borderWidth: 1,
    borderColor: AUTH.sheetBorder,
  },
  h2: { fontFamily: F.bold, fontSize: 22, lineHeight: 28, color: AUTH.text, letterSpacing: -0.3 },
  sub: { marginTop: 8, fontFamily: F.regular, fontSize: 14, lineHeight: 21, color: AUTH.muted },
  stack: { gap: 10, marginTop: 20 },
  foot: { marginTop: 18, textAlign: "center", fontFamily: F.regular, fontSize: 14, color: AUTH.muted },
  link: { fontFamily: F.semibold, color: AUTH.gold },
  terms: { marginTop: 8, textAlign: "center", fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: AUTH.muted },
  termsLink: { textDecorationLine: "underline" },
  error: { marginTop: 12, fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: AUTH.error, textAlign: "center" },

  // Phone and code screens
  flow: { flex: 1, paddingHorizontal: 22, justifyContent: "space-between" },
  big: { marginTop: 28, fontFamily: F.serif, fontSize: 32, lineHeight: 35, color: AUTH.text, letterSpacing: -0.3 },
  field: {
    marginTop: 30,
    height: 60,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AUTH.glass,
    borderWidth: 1,
    borderColor: "rgba(217,178,106,0.7)",
    shadowColor: AUTH.gold,
    shadowOpacity: 0.4,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
  },
  cc: {
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 18,
    paddingRight: 14,
    borderRightWidth: 1,
    borderRightColor: "rgba(244,238,230,0.14)",
  },
  ccText: { fontFamily: F.semibold, fontSize: 15, color: AUTH.text },
  num: { flex: 1, height: "100%", paddingHorizontal: 14, fontFamily: F.semibold, fontSize: 18, letterSpacing: 0.7, color: AUTH.text },
  help: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  helpText: { marginTop: 16, fontFamily: F.regular, fontSize: 13, lineHeight: 19, color: AUTH.muted, flexShrink: 1 },
  helpStrong: { fontFamily: F.semibold, color: AUTH.text },
  otp: { flexDirection: "row", gap: 8, marginTop: 30 },
  otpBox: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AUTH.glass,
    borderWidth: 1,
    borderColor: AUTH.fieldBorder,
  },
  otpBoxOn: { borderColor: "rgba(217,178,106,0.8)", shadowColor: AUTH.gold, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  otpBoxError: { borderColor: AUTH.error },
  otpDigit: { fontFamily: F.serif, fontSize: 28, color: AUTH.text },
  hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0 },

  // Verifying
  verifying: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 30 },
  verifyingText: { fontFamily: F.semibold, fontSize: 17, color: AUTH.text, textAlign: "center" },

  // Country picker
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  countrySheet: {
    maxHeight: "72%",
    backgroundColor: "#1E142C",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: AUTH.sheetBorder,
    paddingTop: 10,
    paddingHorizontal: 14,
  },
  modalHandle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: "rgba(244,238,230,0.25)", marginBottom: 12 },
  countryTitle: { fontFamily: F.bold, fontSize: 19, color: AUTH.text, marginBottom: 8, paddingHorizontal: 6 },
  countryRow: { minHeight: 52, borderRadius: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  countryRowOn: { backgroundColor: "rgba(217,178,106,0.14)" },
  countryCode: { width: 30, fontFamily: F.bold, fontSize: 12, color: AUTH.gold },
  countryName: { flex: 1, fontFamily: F.medium, fontSize: 14, color: AUTH.text },
  countryDial: { fontFamily: F.semibold, fontSize: 14, color: AUTH.muted },
});
