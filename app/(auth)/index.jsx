// app/(auth)/login.jsx
import { router } from "expo-router";
import { Fragment, useEffect, useRef, useState } from "react";
import {
    FlatList, Image, ImageBackground, InputAccessoryView, Keyboard, KeyboardAvoidingView,
    Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import loginBackground from "../../assets/backgrounds/login_background.png";
import { APP_NAME } from "../../components/constants/app";
import countryCodes from "../../components/constants/country_codes.json";
import useAuthStore from "../../components/stores/authStore";
import { saveSession } from "../../lib/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  appleFirebaseToken,
  appleSignInAvailable,
  confirmPhoneOtp,
  googleFirebaseToken,
  phoneAuthMessage,
  sendPhoneOtp,
  signInWithBackend,
} from "../../lib/firebaseAuth";

// ============================================================
// ROUTES
// ============================================================

// Main app (tabs). "/" is the launch screen, not home.
const HOME_ROUTE = "/(root)/(tabs)";
const ONBOARDING_ROUTE = "/onboarding";
const inputAccessoryViewID = "phoneInputDone";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

// ============================================================
// COUNTRY CODES  (components/constants/country_codes.json: { name, dial_code, code })
// ============================================================

const withPlus = (dial) => {
  const d = String(dial || "").replace(/\s+/g, "");
  return d ? (d.startsWith("+") ? d : `+${d}`) : "";
};

const COUNTRIES = countryCodes
  .map((c) => ({ name: c.name, code: c.code, dialCode: withPlus(c.dial_code) }))
  .filter((c) => c.name && c.dialCode && c.code);

// ============================================================
// CONTENT
// ============================================================

const ASTROLOGER_IMAGES = [
  "https://randomuser.me/api/portraits/women/44.jpg",
  "https://randomuser.me/api/portraits/men/32.jpg",
  "https://randomuser.me/api/portraits/women/68.jpg",
  "https://randomuser.me/api/portraits/women/65.jpg",
  "https://randomuser.me/api/portraits/women/49.jpg",
];

const QUESTION_BUBBLES = [
  { text: "Will I find true love?", icon: "♥", iconType: "love" },
  { text: "Is this the right time for a career change?", icon: "▥", iconType: "career" },
  { text: "What does my future look like?", icon: "☾", iconType: "future" },
  { text: "Will my relationship work out?", icon: "♧", iconType: "relationship" },
  { text: "What guidance do I need now?", icon: "✦", iconType: "guidance" },
];

const FEATURES = [
  { icon: "♨", title: "Vedic", subtitle: "Astrology" },
  { icon: "◇", title: "Tarot", subtitle: "Reading" },
  { icon: "▦", title: "Numerology", subtitle: "Insights" },
  { icon: "✦", title: "Personalized", subtitle: "Guidance" },
];

// ============================================================
// COLORS
// ============================================================

const INK = "#1C1820";
const PLUM = "#2B1A3D";
const TERRACOTTA = "#A94C36";
const GOLD = "#C49A4A";
const IVORY = "#F7F1E8";
const CARD = "#FFFDFC";
const MUTED = "#68616A";
const BORDER = "#D9CEC1";
const DISABLED = "#D9CEC1";
const ERROR = "#B42318";

// Phone (SMS OTP) and Google both sign in through Firebase; the backend
// (POST /api/auth/firebase) then logs in an existing account or signs up
// a new one. See lib/firebaseAuth.ts.

// ============================================================
// LOGIN SCREEN
// ============================================================

export default function Login() {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState("phone"); // phone | otp | verifying
  const [statusText, setStatusText] = useState("Checking your number...");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  // Shown under the status text: the number, or nothing for Google.
  const [statusDetail, setStatusDetail] = useState("");
  const confirmation = useRef(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    appleSignInAvailable().then(setAppleAvailable).catch(() => null);
  }, []);
  const [referral, setReferral] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(
    COUNTRIES.find((c) => c.code === "IN") || COUNTRIES[0]
  );
  const [error, setError] = useState("");

  const busy = useRef(false);

  // India: 10 digits starting 6-9. Other countries: 6-15 digits (the JSON has no per-country length).
  const isIndia = selectedCountry.code === "IN";
  const maxDigits = isIndia ? 10 : 15;
  const phoneValid = isIndia ? /^[6-9]\d{9}$/.test(phone) : /^\d{6,15}$/.test(phone);

  const fullPhone = `${selectedCountry.dialCode}${phone}`;

  // Resend countdown on the OTP screen.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // Backend session in hand: new users go to onboarding, others home.
  const finishSignIn = async (session, phoneNumber) => {
    await saveSession(session.access_token, phoneNumber);

    if (!session.onboarded) {
      router.replace(ONBOARDING_ROUTE);
      return;
    }

    // Load the account (user details, active profile) before opening the
    // app, so a failure shows here instead of bouncing back to login.
    setStatusText("Signing you in...");
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
    setError("");
    setStatusText("Sending your code...");
    setStatusDetail(`${selectedCountry.dialCode} ${phone}`);
    setStep("verifying");

    try {
      await sendCode();
      setStep("otp");
    } catch (e) {
      setError(phoneAuthMessage(e));
      setStep("phone");
    } finally {
      busy.current = false;
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
    setStatusText("Verifying your code...");
    setStep("verifying");

    try {
      const firebaseToken = await confirmPhoneOtp(confirmation.current, value);
      const session = await signInWithBackend(firebaseToken, referral);
      await finishSignIn(session, fullPhone);
    } catch (e) {
      setError(phoneAuthMessage(e));
      setCode("");
      setStep("otp");
    } finally {
      busy.current = false;
    }
  };

  const continueWithGoogle = async () => {
    Keyboard.dismiss();
    if (busy.current) return;

    busy.current = true;
    setError("");

    try {
      const firebaseToken = await googleFirebaseToken();

      // Picker closed: stay on the login screen.
      if (!firebaseToken) return;

      setStatusText("Signing in with Google...");
      setStatusDetail("");
      setStep("verifying");

      const session = await signInWithBackend(firebaseToken, referral);
      await finishSignIn(session);
    } catch (e) {
      setError(e?.message || "Google sign-in failed. Please try again.");
      setStep("phone");
    } finally {
      busy.current = false;
    }
  };

  const continueWithApple = async () => {
    Keyboard.dismiss();
    if (busy.current) return;

    busy.current = true;
    setError("");

    try {
      const apple = await appleFirebaseToken();

      // Sheet closed: stay on the login screen.
      if (!apple) return;

      setStatusText("Signing in with Apple...");
      setStatusDetail("");
      setStep("verifying");

      const session = await signInWithBackend(apple.token, referral, apple.name);
      await finishSignIn(session);
    } catch (e) {
      setError(e?.message || "Apple sign-in failed. Please try again.");
      setStep("phone");
    } finally {
      busy.current = false;
    }
  };

  const selectCountry = (country) => {
    Keyboard.dismiss();
    setSelectedCountry(country);
    setPhone("");
    setError("");
    setShowCountryPicker(false);
  };

  const arrowColor = phoneValid ? "#FFFFFF" : "#AAA6A5";

  return (
    <ImageBackground source={loginBackground} style={styles.root} resizeMode="cover">
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          {step === "phone" ? (
            // Scrolls on short screens or when the keyboard is open; on tall
            // screens it still fills the screen like the design.
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.screen,
                { paddingTop: Math.max(insets.top, 4) },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* BRAND */}
              <View style={styles.brand}>
                <View style={styles.brandStar}>
                  <Text style={styles.brandStarText}>✦</Text>
                </View>
                <Text style={styles.brandName}>{APP_NAME.toLowerCase()}</Text>
                <Text style={styles.brandTagline}>YOUR GUIDANCE PARTNER</Text>
              </View>

              {/* HERO */}
              <AstrologyHero />

              {/* HEADLINE */}
              <View style={styles.headline}>
                <Text style={styles.headlineMain}>Guidance for</Text>
                <Text style={styles.headlineMain}>life's big questions.</Text>
                <Text style={styles.headlineSub}>Love. Career. Relationships. Life.</Text>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerStar}>✦</Text>
                  <View style={styles.dividerLine} />
                </View>
              </View>

              {/* FEATURES */}
              <View style={styles.featureRow}>
                {FEATURES.map((feature, index) => (
                  <View
                    key={feature.title}
                    style={[styles.feature, index !== FEATURES.length - 1 && styles.featureBorder]}
                  >
                    <View style={styles.featureIcon}>
                      <Text style={styles.featureIconText}>{feature.icon}</Text>
                    </View>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
                  </View>
                ))}
              </View>

              {/* LOGIN SHEET */}
              <View style={[styles.loginSheet, { paddingBottom: 14 + insets.bottom }]}>
                <View style={styles.phoneRow}>
                  <Pressable onPress={() => setShowCountryPicker(true)} style={styles.countrySelector}>
                    <Text style={styles.countryCode}>{selectedCountry.dialCode}</Text>
                    <Text style={styles.countryChevron}>▾</Text>
                  </Pressable>

                  <TextInput
                    value={phone}
                    onChangeText={(value) => {
                      setPhone(value.replace(/\D/g, "").slice(0, maxDigits));
                      setError("");
                    }}
                    onSubmitEditing={() => Keyboard.dismiss()}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    placeholder="Phone number"
                    placeholderTextColor="#AAA5A5"
                    returnKeyType="done"
                    maxLength={maxDigits}
                    inputAccessoryViewID={Platform.OS === "ios" ? inputAccessoryViewID : undefined}
                    style={styles.phoneInput}
                  />
                </View>

                {showReferral && (
                  <TextInput
                    value={referral}
                    onChangeText={(value) => setReferral(value.toUpperCase().slice(0, 32))}
                    placeholder="Referral code"
                    placeholderTextColor={MUTED}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    style={styles.referralInput}
                  />
                )}

                {!!error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                  onPress={continueWithPhone}
                  disabled={!phoneValid}
                  style={[styles.receiveButton, { backgroundColor: phoneValid ? PLUM : DISABLED }]}
                >
                  <Text style={[styles.receiveText, { color: arrowColor }]}>Continue with Phone Number</Text>
                  <Text style={[styles.receiveArrow, { color: arrowColor }]}>→</Text>
                </Pressable>

                {/* OR */}
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>OR</Text>
                  <View style={styles.orLine} />
                </View>

                {/* GOOGLE */}
                <Pressable onPress={continueWithGoogle} style={styles.googleButton}>
                  <View style={styles.googleLogo}>
                    <Text style={styles.googleLogoText}>G</Text>
                  </View>
                  <Text style={styles.googleText}>Continue with Google</Text>
                  <Text style={styles.googleArrow}>→</Text>
                </Pressable>

                {/* APPLE (required by the App Store when Google sign-in is offered) */}
                {appleAvailable && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={26}
                    style={styles.appleButton}
                    onPress={continueWithApple}
                  />
                )}

                {/* REFERRAL */}
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowReferral((value) => !value);
                  }}
                  style={styles.referralButton}
                >
                  <Text style={styles.referralText}>
                    {showReferral ? "Hide referral code" : "Have a referral code?"}
                  </Text>
                </Pressable>

                {/* SECURITY */}
                <View style={styles.securityRow}>
                  <Text style={styles.lockIcon}>♧</Text>
                  <Text style={styles.securityText}>Your details stay private and secure.</Text>
                </View>

                {/* TERMS */}
                <Text style={styles.terms}>
                  By continuing, you agree to our{" "}
                  <Text
                    style={styles.termsLink}
                    onPress={() => {
                      Keyboard.dismiss();
                      router.push("/(root)/profile/terms");
                    }}
                  >
                    Terms of Service
                  </Text>{" "}
                  and{" "}
                  <Text
                    style={styles.termsLink}
                    onPress={() => {
                      Keyboard.dismiss();
                      router.push("/(root)/profile/privacy-policy");
                    }}
                  >
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </View>
            </ScrollView>
          ) : step === "otp" ? (
            <OtpScreen
              phoneLabel={`${selectedCountry.dialCode} ${phone}`}
              code={code}
              error={error}
              resendIn={resendIn}
              onChangeCode={(value) => {
                const digits = value.replace(/\D/g, "").slice(0, OTP_LENGTH);
                setCode(digits);
                setError("");
                // Verify as soon as all digits are in.
                if (digits.length === OTP_LENGTH) verifyCode(digits);
              }}
              onVerify={() => verifyCode()}
              onResend={resendCode}
              onChangeNumber={() => {
                confirmation.current = null;
                setCode("");
                setError("");
                setStep("phone");
              }}
              bottomInset={insets.bottom}
            />
          ) : (
            <CheckingScreen statusText={statusText} detail={statusDetail} />
          )}

          {/* COUNTRY PICKER */}
          <Modal
            visible={showCountryPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowCountryPicker(false)}
          >
            <View style={styles.modalOverlay}>
              <Pressable style={styles.modalBackdrop} onPress={() => setShowCountryPicker(false)} />

              <View style={styles.countryModal}>
                <View style={styles.modalHandle} />

                <View style={styles.countryModalHeader}>
                  <Text style={styles.countryModalTitle}>Select country</Text>
                  <Pressable onPress={() => setShowCountryPicker(false)} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>×</Text>
                  </Pressable>
                </View>

                <FlatList
                  data={COUNTRIES}
                  keyExtractor={(item) => `${item.code}-${item.dialCode}`}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.countryList}
                  renderItem={({ item }) => {
                    const selected = item.code === selectedCountry.code;
                    return (
                      <Pressable
                        onPress={() => selectCountry(item)}
                        style={[styles.countryRow, selected && styles.countryRowSelected]}
                      >
                        <View style={styles.countryFlag}>
                          <Text style={styles.countryFlagText}>{item.code}</Text>
                        </View>
                        <Text style={styles.countryName}>{item.name}</Text>
                        <Text style={styles.countryDialCode}>{item.dialCode}</Text>
                        {selected && <Text style={styles.countryCheck}>✓</Text>}
                      </Pressable>
                    );
                  }}
                />
              </View>
            </View>
          </Modal>
        </KeyboardAvoidingView>

      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID={inputAccessoryViewID}>
          <View
            style={{
              height: 44,
              backgroundColor: CARD,
              borderTopWidth: 1,
              borderTopColor: BORDER,
              alignItems: "flex-end",
              justifyContent: "center",
              paddingHorizontal: 16,
            }}
          >
            <Pressable onPress={() => Keyboard.dismiss()}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: PLUM }}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </ImageBackground>
  );
}

// ============================================================
// ASTROLOGY HERO
// ============================================================

function AstrologyHero() {
  const portraits = [
    { style: styles.portraitOne, bubble: styles.bubbleOne },
    { style: styles.portraitTwo, bubble: styles.bubbleTwo },
    { style: styles.portraitThree, bubble: styles.bubbleThree },
    { style: styles.portraitFour, bubble: styles.bubbleFour },
    { style: styles.portraitFive, bubble: styles.bubbleFive },
  ];

  return (
    <View style={styles.hero}>
      {portraits.map((p, i) => (
        <Fragment key={i}>
          <View style={[styles.heroPortrait, p.style]}>
            <Image source={{ uri: ASTROLOGER_IMAGES[i] }} style={styles.heroImage} />
            {i === 4 && (
              <View style={styles.tarotCards}>
                <View style={styles.tarotCardOne} />
                <View style={styles.tarotCardTwo} />
                <View style={styles.tarotCardThree} />
              </View>
            )}
          </View>
          <QuestionBubble item={QUESTION_BUBBLES[i]} style={p.bubble} />
        </Fragment>
      ))}
    </View>
  );
}

// ============================================================
// QUESTION BUBBLE
// ============================================================

function QuestionBubble({ item, style }) {
  const color =
    item.iconType === "love" || item.iconType === "relationship"
      ? TERRACOTTA
      : item.iconType === "guidance"
      ? GOLD
      : PLUM;

  return (
    <View style={[styles.questionBubble, style]}>
      <Text style={[styles.questionIcon, { color }]}>{item.icon}</Text>
      <Text style={styles.questionText}>{item.text}</Text>
    </View>
  );
}

// ============================================================
// CHECKING SCREEN
// ============================================================

function CheckingScreen({ statusText, detail }) {
  return (
    <View style={styles.checkingScreen}>
      <View style={styles.checkingStars}>
        <Text style={styles.checkingStar}>✦</Text>
        <Text style={[styles.checkingStar, { marginTop: 24 }]}>✦</Text>
        <Text style={styles.checkingStar}>✦</Text>
      </View>
      <Text style={styles.checkingTitle}>{statusText}</Text>
      {!!detail && <Text style={styles.checkingPhone}>{detail}</Text>}
      <Text style={styles.checkingSub}>This will only take a moment</Text>
    </View>
  );
}

// ============================================================
// OTP SCREEN
// ============================================================

function OtpScreen({
  phoneLabel, code, error, resendIn, onChangeCode, onVerify, onResend, onChangeNumber, bottomInset,
}) {
  const inputRef = useRef(null);
  const ready = code.length === OTP_LENGTH;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.otpScreen, { paddingBottom: 24 + bottomInset }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.otpTitle}>Enter the code</Text>
      <Text style={styles.otpSub}>We sent a {OTP_LENGTH}-digit code by SMS to</Text>
      <Text style={styles.otpPhone}>{phoneLabel}</Text>

      {/* One hidden input drives the boxes, so paste and SMS autofill work. */}
      <Pressable style={styles.otpBoxes} onPress={() => inputRef.current?.focus()}>
        {Array.from({ length: OTP_LENGTH }, (_, i) => (
          <View
            key={i}
            style={[styles.otpBox, i === code.length && styles.otpBoxActive, !!error && styles.otpBoxError]}
          >
            <Text style={styles.otpDigit}>{code[i] ?? ""}</Text>
          </View>
        ))}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={onChangeCode}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={OTP_LENGTH}
        autoFocus
        style={styles.otpHiddenInput}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        onPress={onVerify}
        disabled={!ready}
        style={[styles.receiveButton, { backgroundColor: ready ? PLUM : DISABLED }]}
      >
        <Text style={[styles.receiveText, { color: ready ? "#FFFFFF" : "#AAA6A5" }]}>Verify</Text>
      </Pressable>

      <Pressable onPress={onResend} disabled={resendIn > 0} style={styles.otpLink}>
        <Text style={[styles.otpLinkText, resendIn > 0 && { color: MUTED, textDecorationLine: "none" }]}>
          {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
        </Text>
      </Pressable>

      <Pressable onPress={onChangeNumber} style={styles.otpLink}>
        <Text style={styles.otpLinkText}>Change number</Text>
      </Pressable>
    </ScrollView>
  );
}

// ============================================================
// STYLES
// ============================================================

const shadow = (height, opacity, radius, elevation) => ({
  shadowColor: INK,
  shadowOffset: { width: 0, height },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation,
});

const tarotCard = { position: "absolute", width: 17, height: 29, backgroundColor: CARD, borderWidth: 1, borderColor: GOLD, borderRadius: 3 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IVORY },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  // flexGrow (not flex) so the content can be taller than the screen and scroll.
  screen: { flexGrow: 1, width: "100%", backgroundColor: "transparent", justifyContent: "space-between" },

  // BRAND
  brand: { height: 58, alignItems: "center", justifyContent: "center", position: "relative", zIndex: 20 },
  brandStar: { position: "absolute", top: -2, alignItems: "center" },
  brandStarText: { color: GOLD, fontSize: 20 },
  brandName: { marginTop: 7, color: PLUM, fontSize: 37, lineHeight: 39, fontWeight: "300", letterSpacing: -1.5 },
  brandTagline: { marginTop: 1, color: MUTED, fontSize: 8.5, lineHeight: 10, fontWeight: "600", letterSpacing: 3.1 },

  // HERO
  hero: { height: 310, width: "100%", position: "relative", overflow: "hidden", backgroundColor: "transparent" },
  heroPortrait: {
    position: "absolute", width: 82, height: 82, borderRadius: 41, backgroundColor: CARD, padding: 3,
    borderWidth: 1, borderColor: "rgba(196,154,74,0.45)", zIndex: 5, ...shadow(4, 0.08, 8, 4),
  },
  heroImage: { width: "100%", height: "100%", borderRadius: 39 },
  portraitOne: { top: 8, left: 27 },
  portraitTwo: { top: 8, right: 29 },
  portraitThree: { top: 118, left: 48 },
  portraitFour: { top: 118, right: 28 },
  portraitFive: { width: 76, height: 76, borderRadius: 38, bottom: 2, left: "50%", marginLeft: -38 },

  // TAROT CARDS
  tarotCards: { position: "absolute", right: -10, bottom: -7, width: 38, height: 42 },
  tarotCardOne: { ...tarotCard, left: 0, top: 7, transform: [{ rotate: "-18deg" }] },
  tarotCardTwo: { ...tarotCard, left: 9, top: 3, transform: [{ rotate: "3deg" }] },
  tarotCardThree: { ...tarotCard, left: 18, top: 6, transform: [{ rotate: "20deg" }] },

  // QUESTION BUBBLES
  questionBubble: {
    position: "absolute", minHeight: 38, maxWidth: 135, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 15,
    backgroundColor: "rgba(255,253,252,0.96)", flexDirection: "row", alignItems: "center", zIndex: 8,
    ...shadow(2, 0.05, 5, 2),
  },
  questionIcon: {
    width: 21, height: 21, borderRadius: 11, backgroundColor: "#F4ECEB", textAlign: "center",
    textAlignVertical: "center", lineHeight: 21, fontSize: 11, marginRight: 6, overflow: "hidden",
  },
  questionText: { flex: 1, color: INK, fontSize: 9.5, lineHeight: 12, fontWeight: "600" },
  bubbleOne: { top: 82, left: 105, width: 125 },
  bubbleTwo: { top: 82, right: 5, width: 132 },
  bubbleThree: { top: 198, left: 4, width: 128 },
  bubbleFour: { top: 198, right: 4, width: 128 },
  bubbleFive: { bottom: 2, right: 35, width: 125 },

  // HEADLINE
  headline: { alignItems: "center", paddingHorizontal: 18, paddingTop: 0, paddingBottom: 3 },
  headlineMain: { color: PLUM, fontSize: 26, lineHeight: 30, fontWeight: "800", letterSpacing: -0.8, textAlign: "center" },
  headlineSub: { marginTop: 7, color: MUTED, fontSize: 15, lineHeight: 18, fontWeight: "500", textAlign: "center" },
  divider: { flexDirection: "row", alignItems: "center", marginTop: 5, gap: 8 },
  dividerLine: { width: 42, height: 1, backgroundColor: GOLD },
  dividerStar: { color: GOLD, fontSize: 16 },

  // FEATURES
  featureRow: { height: 66, flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 11, marginTop: 0 },
  feature: { flex: 1, height: 60, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  featureBorder: { borderRightWidth: 1, borderRightColor: "rgba(217,206,193,0.75)" },
  featureIcon: {
    width: 35, height: 35, borderRadius: 18, borderWidth: 1, borderColor: "rgba(196,154,74,0.45)",
    backgroundColor: "rgba(255,253,252,0.55)", alignItems: "center", justifyContent: "center", marginBottom: 3,
  },
  featureIconText: { color: PLUM, fontSize: 17, fontWeight: "500" },
  featureTitle: { color: INK, fontSize: 10, lineHeight: 11, fontWeight: "700", textAlign: "center" },
  featureSubtitle: { color: MUTED, fontSize: 9.5, lineHeight: 11, fontWeight: "500", textAlign: "center" },

  // LOGIN SHEET
  loginSheet: {
    width: "100%", backgroundColor: CARD, borderTopLeftRadius: 29, borderTopRightRadius: 29,
    paddingTop: 14, paddingHorizontal: 18, ...shadow(-3, 0.08, 10, 7),
  },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 7, width: "100%" },

  // COUNTRY SELECTOR
  countrySelector: { width: 78, height: 51, borderRadius: 26, backgroundColor: "#F4F1EE", alignItems: "center", justifyContent: "center", flexDirection: "row", paddingHorizontal: 12 },
  countryCode: { color: INK, fontSize: 16, lineHeight: 20, fontWeight: "600" },
  countryChevron: { color: MUTED, fontSize: 13, lineHeight: 16, marginLeft: 6, marginTop: 1 },
  phoneInput: { flex: 1, height: 51, borderRadius: 26, backgroundColor: "#F4F1EE", paddingHorizontal: 18, color: INK, fontSize: 16, fontWeight: "500" },
  referralInput: { marginTop: 7, height: 44, borderRadius: 22, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, paddingHorizontal: 17, color: INK, fontSize: 14 },
  referralButton: { alignItems: "center", marginTop: 5 },
  referralText: { color: MUTED, fontSize: 11, textDecorationLine: "underline" },
  error: { marginTop: 4, color: ERROR, fontSize: 11, textAlign: "center" },
  receiveButton: { width: "100%", height: 51, marginTop: 9, borderRadius: 26, alignItems: "center", justifyContent: "center", flexDirection: "row", position: "relative" },
  receiveText: { fontSize: 15, fontWeight: "700" },
  receiveArrow: { position: "absolute", right: 18, fontSize: 23, fontWeight: "300" },

  // OR
  orRow: { flexDirection: "row", alignItems: "center", width: "100%", marginTop: 8, marginBottom: 8 },
  orLine: { flex: 1, height: 1, backgroundColor: BORDER },
  orText: { marginHorizontal: 12, color: MUTED, fontSize: 10, fontWeight: "600", letterSpacing: 1 },

  // GOOGLE
  googleButton: {
    width: "100%", height: 51, borderRadius: 26, backgroundColor: "#F4F1EE", alignItems: "center",
    justifyContent: "center", flexDirection: "row", position: "relative", borderWidth: 1, borderColor: "rgba(217,206,193,0.7)",
  },
  googleLogo: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginRight: 9, ...shadow(1, 0.08, 2, 1) },
  googleLogoText: { color: "#4285F4", fontSize: 17, fontWeight: "800" },
  googleText: { color: PLUM, fontSize: 15, fontWeight: "700" },
  googleArrow: { position: "absolute", right: 18, color: PLUM, fontSize: 23, fontWeight: "300" },
  appleButton: { width: "100%", height: 51, marginTop: 8 },

  // SECURITY / TERMS
  securityRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 5 },
  lockIcon: { color: MUTED, fontSize: 15, marginRight: 6 },
  securityText: { color: MUTED, fontSize: 10.5, fontWeight: "500" },
  terms: { marginTop: 4, paddingHorizontal: 5, color: MUTED, fontSize: 9.5, lineHeight: 13, textAlign: "center" },
  termsLink: { color: PLUM, textDecorationLine: "underline" },

  // COUNTRY MODAL
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(28,24,32,0.38)" },
  countryModal: {
    width: "100%", maxHeight: "72%", backgroundColor: CARD, borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingTop: 10, paddingBottom: 24, ...shadow(-4, 0.15, 14, 10),
  },
  modalHandle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: BORDER, marginBottom: 10 },
  countryModalHeader: { height: 54, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: BORDER },
  countryModalTitle: { color: INK, fontSize: 19, fontWeight: "700" },
  closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F4F1EE", alignItems: "center", justifyContent: "center" },
  closeButtonText: { color: MUTED, fontSize: 24, lineHeight: 26, fontWeight: "300", marginTop: -2 },
  countryList: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10 },
  countryRow: { minHeight: 58, borderRadius: 15, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", marginBottom: 4 },
  countryRowSelected: { backgroundColor: "#F4F1EE" },
  countryFlag: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F4ECEB", alignItems: "center", justifyContent: "center", marginRight: 12 },
  countryFlagText: { color: PLUM, fontSize: 10, fontWeight: "800" },
  countryName: { flex: 1, color: INK, fontSize: 14, fontWeight: "600" },
  countryDialCode: { color: MUTED, fontSize: 14, fontWeight: "600", marginRight: 10 },
  countryCheck: { color: PLUM, fontSize: 18, fontWeight: "700", width: 20, textAlign: "center" },

  // CHECKING SCREEN
  checkingScreen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, backgroundColor: "transparent" },
  checkingStars: { flexDirection: "row", alignItems: "center", gap: 26, marginBottom: 40 },
  checkingStar: { color: GOLD, fontSize: 24 },
  checkingTitle: { color: INK, fontSize: 25, fontWeight: "600", textAlign: "center" },
  checkingPhone: { marginTop: 11, color: PLUM, fontSize: 24, fontWeight: "700" },
  checkingSub: { marginTop: 7, color: MUTED, fontSize: 14 },

  // OTP SCREEN
  otpScreen: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: 40 },
  otpTitle: { color: PLUM, fontSize: 28, fontWeight: "800", textAlign: "center" },
  otpSub: { marginTop: 10, color: MUTED, fontSize: 14, textAlign: "center" },
  otpPhone: { marginTop: 4, color: INK, fontSize: 17, fontWeight: "700", textAlign: "center" },
  otpBoxes: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 28, marginBottom: 6 },
  otpBox: {
    width: 46, height: 54, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD,
    alignItems: "center", justifyContent: "center",
  },
  otpBoxActive: { borderColor: PLUM, borderWidth: 2 },
  otpBoxError: { borderColor: ERROR },
  otpDigit: { color: INK, fontSize: 22, fontWeight: "700" },
  // Off-screen but focusable, so the keyboard and SMS autofill work.
  otpHiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0 },
  otpLink: { alignItems: "center", marginTop: 14 },
  otpLinkText: { color: PLUM, fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
});