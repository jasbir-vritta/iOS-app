import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import Reanimated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Ellipse, G, Line } from "react-native-svg";

import { AUTH_FONTS, F } from "../../../components/auth/theme";
import { VrittaLogo } from "../../../components/auth/VrittaLogo";
import { APP_NAME } from "../../../components/constants/app";
import {
  loadMyLifeHoroscope,
  useMyLifeStore,
} from "../../../components/stores/myLifeStore";
import useProfilesStore from "../../../components/stores/profilesStore";
import { useRewardsStore } from "../../../components/stores/rewardsStore";
import { useUserStore } from "../../../components/stores/userStore";
import { hasBirthDetails } from "../../../components/utils/birthDetails";
import { useTabBarSpace } from "../../../components/utils/tabBar";
import { useScreenTime } from "../../../lib/analytics";
import { useT } from "../../../lib/i18n";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// App palette (same as Home and Profile).
const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  LAVENDER: "#F4F0F8",
  IVORY: "#F7F1E8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  BORDER: "#D9CEC1",
  // Tiny premium accents only.
  GOLD: "#C49A4A",
  LINE: "rgba(217,206,193,0.6)",
};

// Functional status colors.
// `labelKey` is translated at render time.
const STATUS = {
  Favourable: { labelKey: "mylife.status.favourable", color: "#2E7D4F", bg: "#E6F2EA" },
  Neutral: { labelKey: "mylife.status.neutral", color: "#9A6A12", bg: "#F8EFD9" },
  Challenging: { labelKey: "mylife.status.watchful", color: "#B3392F", bg: "#F8E4E1" },
};

// Each tab has its own look, built only from the locked palette:
// two dark heroes (Deep Plum, Ink) and two light ones (Warm Ivory, soft
// lavender). `fg` is the hero's text colour (rgb); `accent` drives the tab
// pill, bars and icons. Solid colours only (no gradients on functional UI).
const tint = (rgb) => (alpha) => `rgba(${rgb},${alpha})`;

const LIGHT_TEXT = "255,253,252"; // Card White
const DARK_TEXT = "28,24,32"; // Ink

const THEMES = {
  daily: {
    accent: C.PLUM, soft: "#EFE8F7", hero: C.PLUM, heroBorder: C.PLUM, fg: LIGHT_TEXT,
    page: C.LAVENDER,
    tint: tint("43,26,61"),
  },
  weekly: {
    accent: C.INK, soft: "#EDEAF0", hero: C.INK, heroBorder: C.INK, fg: LIGHT_TEXT,
    page: "#EEEBF2",
    tint: tint("28,24,32"),
  },
  monthly: {
    accent: "#4A3366", soft: "#EFE8F7", hero: C.CARD, heroBorder: C.BORDER, fg: DARK_TEXT,
    page: C.IVORY,
    tint: tint("74,51,102"),
  },
  yearly: {
    accent: C.PLUM, soft: "#EFE8F7", hero: "#EAE2F3", heroBorder: "#DCCFEA", fg: DARK_TEXT,
    page: "#F8F5FB",
    tint: tint("43,26,61"),
  },
};

const PERIOD_KEYS = ["daily", "weekly", "monthly", "yearly"];

// Built at render time so the labels follow the app language.
const periodsFor = (tr) =>
  PERIOD_KEYS.map((key) => ({
    key,
    label: tr(`mylife.period.${key}.label`),
    kicker: tr(`mylife.period.${key}.kicker`),
    areasTitle: tr(`mylife.period.${key}.areasTitle`),
    guidanceTitle: tr(`mylife.period.${key}.guidanceTitle`),
    loading: tr(`mylife.period.${key}.loading`),
  }));

const AREAS = [
  { key: "love", labelKey: "mylife.area.love", icon: "heart-outline" },
  { key: "career", labelKey: "mylife.area.career", icon: "briefcase-outline" },
  { key: "money", labelKey: "mylife.area.money", icon: "wallet-outline" },
  { key: "health", labelKey: "mylife.area.health", icon: "meditation" },
  { key: "travel", labelKey: "mylife.area.travel", icon: "airplane" },
];

const SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];

// The backend sends English sign names; show them in the app language.
const signName = (tr, sign) => {
  const key = String(sign || "").trim().toLowerCase();
  return SIGNS.includes(key) ? tr(`mylife.sign.${key}`) : sign;
};

const toText = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    return toText(value.description ?? value.text ?? value.name ?? value.title);
  }
  return "";
};

const toList = (value) =>
  Array.isArray(value) ? value.map(toText).filter(Boolean) : toText(value).split("\n").filter(Boolean);

const normalizeStatus = (value) => {
  const text = toText(value).toLowerCase();
  if (/challeng|watch|avoid|unfavo|difficult|bad|negative/.test(text)) return "Challenging";
  if (/favo|good|excellent|positive|great/.test(text)) return "Favourable";
  return "Neutral";
};

function areaData(horoscope, tr) {
  return AREAS.map((area) => {
    const raw = horoscope?.areas?.[area.key] || {};
    const score = Number(raw.score);
    return {
      ...area,
      label: tr(area.labelKey),
      status: normalizeStatus(raw.status),
      score: Number.isFinite(score) ? score : null,
      title: toText(raw.title),
      description: toText(raw.description),
    };
  });
}

// "Good morning" etc. by the IST hour, with the first name when known.
const greeting = (tr, name) => {
  const hour = Math.floor(((Date.now() / 3600000) + 5.5) % 24);
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return name
    ? tr(`mylife.greeting.${part}Name`, { name })
    : tr(`mylife.greeting.${part}`);
};

// Sections rise in one after another when a tab opens.
const enter = (index) => FadeInDown.delay(80 * index).duration(420);

const energyLabel = (tr, score) =>
  tr(score >= 80 ? "mylife.energy.high" : score >= 70 ? "mylife.energy.balanced" : "mylife.energy.gentle");

// Current tab's theme for every part of the screen.
const ThemeContext = createContext("daily");
const useTheme = () => THEMES[useContext(ThemeContext)];

export default function MyLife() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const [fontsLoaded] = useFonts(AUTH_FONTS);
  const [activeTab, setActiveTab] = useState("daily");
  const tr = useT();
  const periods = periodsFor(tr);

  // Analytics, per tab: visited_my_vritta_daily + my_vritta_daily_time_spent
  // (weekly / monthly / yearly the same way).
  useScreenTime(`my_vritta_${activeTab}`);
  // Load errors, keyed "profileId:period".
  const [errors, setErrors] = useState({});

  const completeInsightReward = useRewardsStore(
    (state) => state.completeInsightReward
  );

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        completeInsightReward();
      }, 60_000);

      return () => {
        clearTimeout(timer);
      };
    }, [completeInsightReward])
  );

  const user = useUserStore((state) => state.user);
  const profiles = useProfilesStore((state) => state.profiles);

  const activeProfileId = user?.active_profile_id;

  const activeProfile = profiles.find(
    (profile) => profile.profile_id === activeProfileId
  );

  // Profiles without a birth place/time can't be calculated: ask to complete them.
  const needsBirthDetails =
    Boolean(activeProfile) && !hasBirthDetails(activeProfile);

  // Shared with Home and Profile through the My Life store.
  const horoscope = useMyLifeStore((state) =>
    activeProfileId ? state.profiles[activeProfileId]?.[activeTab] : null
  );

  const loadPeriod = useCallback(async (profileId, period) => {
    try {
      await loadMyLifeHoroscope(period, profileId);
    } catch (err) {
      console.error("MY LIFE ERROR:", err);
      // Empty message: the translated fallback is shown at render time.
      setErrors((prev) => ({
        ...prev,
        [`${profileId}:${period}`]: err?.message || "",
      }));
    }
  }, []);

  const dataKey = `${activeProfileId}:${activeTab}`;
  const error = dataKey in errors
    ? errors[dataKey] || tr("mylife.error.text", { app: APP_NAME })
    : null;

  useEffect(() => {
    if (!activeProfileId || needsBirthDetails || horoscope || error) {
      return;
    }

    loadPeriod(activeProfileId, activeTab);
  }, [activeProfileId, needsBirthDetails, activeTab, horoscope, error, loadPeriod]);

  // Clearing the error makes the effect above fetch again.
  const retry = () =>
    setErrors((prev) => {
      const next = { ...prev };
      delete next[dataKey];
      return next;
    });

  const period = periods.find((p) => p.key === activeTab) || periods[0];

  const share = async () => {
    try {
      await Share.share({
        message: [
          tr("mylife.share.heading", { app: APP_NAME, period: period.label }),
          activeProfile?.name && tr("mylife.share.name", { name: activeProfile.name }),
          horoscope?.sign && tr("mylife.share.moonSign", { sign: signName(tr, toText(horoscope.sign)) }),
          toText(horoscope?.title),
          toText(horoscope?.text),
        ].filter(Boolean).join("\n"),
      });
    } catch (err) {
      console.log("SHARE ERROR", err);
    }
  };

  // Brand fonts first, so text doesn't jump from the system font.
  if (!fontsLoaded) {
    return <View style={styles.screen} />;
  }

  if (needsBirthDetails) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <PageBackground theme={THEMES.daily} />
        <View style={styles.stateIcon}>
          <Icon name="account-edit-outline" size={26} color={C.PLUM} />
        </View>
        <Text style={styles.stateTitle}>{tr("mylife.birth.title")}</Text>
        <Text style={styles.stateText}>
          {activeProfile?.name
            ? tr("mylife.birth.text", { name: activeProfile.name, app: APP_NAME })
            : tr("mylife.birth.textNoName", { app: APP_NAME })}
        </Text>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/profile/edit_profile",
              params: { profileId: activeProfileId },
            })
          }
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>{tr("mylife.birth.button")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ThemeContext.Provider value={activeTab}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <PageBackground theme={THEMES[activeTab]} />

        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.logoBadge}>
              <VrittaLogo size={22} />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
                {tr("mylife.title", { app: APP_NAME })}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {greeting(tr, activeProfile?.name ? String(activeProfile.name).split(" ")[0] : "")}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.iconButton}
            onPress={share}
            hitSlop={8}
            accessibilityLabel={tr("mylife.shareA11y")}
          >
            <Icon name="share-variant-outline" size={19} color={C.INK} />
          </Pressable>
        </View>

        <TabBar periods={periods} active={activeTab} onChange={setActiveTab} />

        {horoscope ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scroll, { paddingBottom: tabSpace }]}
          >
            <HoroscopeScreen key={activeTab} horoscope={horoscope} period={period} />
          </ScrollView>
        ) : error ? (
          <View style={styles.center}>
            <View style={styles.stateIcon}>
              <Icon name="cloud-alert-outline" size={26} color={C.PLUM} />
            </View>
            <Text style={styles.stateTitle}>{tr("mylife.error.title", { app: APP_NAME })}</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable onPress={retry} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{tr("mylife.error.retry")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={THEMES[activeTab].accent} />
            <Text style={styles.loadingText}>{period.loading}</Text>
          </View>
        )}
      </View>
    </ThemeContext.Provider>
  );
}

/* ------------------------------ background ------------------------------ */

const SKY_DOTS = [
  [0.12, 0.05, 1.3], [0.27, 0.11, 0.9], [0.46, 0.04, 1.1], [0.63, 0.13, 0.8],
  [0.83, 0.07, 1.4], [0.92, 0.19, 0.9], [0.06, 0.24, 0.8], [0.38, 0.27, 0.7],
  [0.74, 0.31, 1.0], [0.18, 0.55, 0.8], [0.88, 0.5, 0.9], [0.55, 0.62, 0.7],
  [0.08, 0.78, 1.0], [0.7, 0.84, 0.8], [0.94, 0.72, 1.1], [0.32, 0.9, 0.8],
];

const CONSTELLATION = [[0.62, 0.035], [0.71, 0.075], [0.79, 0.06], [0.86, 0.105], [0.94, 0.09]];

/* Lavender canvas with a soft wash of the tab's colour and faint line art. */
function PageBackground({ theme }) {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[theme.page, theme.page]}
        locations={[0, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <G stroke={theme.accent} fill="none">
          <Ellipse cx={width * 0.96} cy={height * 0.02} rx={width * 0.62} ry={width * 0.3} strokeOpacity={0.08} transform={`rotate(-14 ${width * 0.96} ${height * 0.02})`} />
          <Ellipse cx={width * 0.96} cy={height * 0.02} rx={width * 0.44} ry={width * 0.2} strokeOpacity={0.1} transform={`rotate(-14 ${width * 0.96} ${height * 0.02})`} />
          <Circle cx={width * 0.1} cy={height * 0.7} r={width * 0.34} strokeOpacity={0.06} strokeDasharray="2 7" />
        </G>
        <G stroke={theme.accent} strokeOpacity={0.16} strokeWidth={0.8}>
          {CONSTELLATION.slice(1).map(([x, y], i) => {
            const [px, py] = CONSTELLATION[i];
            return <Line key={i} x1={px * width} y1={py * height} x2={x * width} y2={y * height} />;
          })}
        </G>
        {CONSTELLATION.map(([x, y], i) => (
          <Circle key={`c${i}`} cx={x * width} cy={y * height} r={i === 2 ? 2 : 1.4} fill={theme.accent} opacity={0.3} />
        ))}
        {SKY_DOTS.map(([x, y, r], i) => (
          <Circle key={`d${i}`} cx={x * width} cy={y * height} r={r} fill={theme.accent} opacity={0.16} />
        ))}
      </Svg>
    </View>
  );
}

/* ------------------------------ tabs ------------------------------ */

function TabBar({ periods, active, onChange }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const index = periods.findIndex((p) => p.key === active);
  // Created once; animated to the selected tab below.
  const [x] = useState(() => new Animated.Value(index));

  useEffect(() => {
    Animated.spring(x, { toValue: index, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
  }, [index, x]);

  const tabWidth = width / periods.length;

  return (
    <View style={styles.tabs} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}>
      {width > 0 && (
        <Animated.View
          style={[
            styles.tabIndicator,
            { width: tabWidth, shadowColor: t.accent, transform: [{ translateX: Animated.multiply(x, tabWidth) }] },
          ]}
        >
          <View style={[StyleSheet.absoluteFill, { borderRadius: 999, backgroundColor: t.accent }]} />
        </Animated.View>
      )}
      {periods.map((p) => {
        const selected = p.key === active;
        return (
          <Pressable
            key={p.key}
            onPress={() => onChange(p.key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.tabText, selected && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit>
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------ building blocks ------------------------------ */

function SectionTitle({ children, note, overline }) {
  const t = useTheme();
  return (
    <View style={styles.sectionWrap}>
      {!!overline && <Text style={[styles.overline, { color: t.accent }]}>{overline}</Text>}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{children}</Text>
        <View style={[styles.sectionRule, { backgroundColor: t.tint(0.25) }]} />
        {!!note && <Text style={styles.sectionNote}>{note}</Text>}
      </View>
    </View>
  );
}

/* White card with a faint wash of the tab colour and orbit art in the corner. */
function Card({ children, style, contentStyle, art = true, tone = "white" }) {
  const t = useTheme();
  // Ivory cards on an ivory page would blend in: use Card White there.
  const ivory = tone === "ivory" && t.page !== C.IVORY;
  const colors = ivory ? [C.IVORY, C.IVORY] : [C.CARD, C.CARD];

  return (
    <View style={[styles.card, { shadowColor: t.accent }, style]}>
      <View style={styles.cardClip}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {art && (
          <Svg width={140} height={100} style={styles.cardArt} pointerEvents="none">
            <Circle cx={140} cy={0} r={86} stroke={t.accent} strokeOpacity={0.1} fill="none" />
            <Circle cx={140} cy={0} r={60} stroke={t.accent} strokeOpacity={0.12} fill="none" strokeDasharray="2 5" />
            <Circle cx={96} cy={20} r={1.5} fill={t.accent} opacity={0.35} />
            <Circle cx={124} cy={54} r={1} fill={t.accent} opacity={0.25} />
          </Svg>
        )}
        <View style={styles.cardHighlight} />
        <View style={[styles.cardContent, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}

/* Round icon badge: soft tint with a fine ring, or the solid tab colour. */
function Medallion({ icon, size = 42, active = false }) {
  const t = useTheme();
  return (
    <View style={[styles.medal, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.soft, borderColor: t.tint(0.35) }]}>
      {active && (
        <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: t.accent }]} />
      )}
      <Icon name={icon} size={size * 0.44} color={active ? C.CARD : t.accent} />
    </View>
  );
}

/* Progress ring with the score in the middle. */
function Ring({ score, size, color, track, stroke = 4, textStyle }) {
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * length;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${length}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[styles.ringText, { color }, textStyle]}>{score}</Text>
    </View>
  );
}

function ScoreRing({ score, size = 56 }) {
  const fg = tint(useTheme().fg);
  return <Ring score={score} size={size} color={fg(1)} track={fg(0.2)} />;
}

/* Zodiac wheel (from the login sky) in fine white lines. */
const WHEEL = 300;
const WC = WHEEL / 2;
const wheelPoint = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return { x: WC + r * Math.sin(a), y: WC - r * Math.cos(a) };
};

function ZodiacWheel() {
  const fg = tint(useTheme().fg);
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const long = i % 6 === 0;
    const a = wheelPoint(i * 5, 148);
    const b = wheelPoint(i * 5, long ? 136 : 143);
    return <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
  });

  const dots = Array.from({ length: 12 }, (_, k) => {
    const p = wheelPoint(15 + k * 30, 124);
    return (
      <Circle
        key={k}
        cx={p.x}
        cy={p.y}
        r={k % 4 === 0 ? 2.2 : 1.2}
        fill={k % 4 === 0 ? C.GOLD : fg(0.5)}
      />
    );
  });

  return (
    <Svg width={WHEEL} height={WHEEL}>
      <G stroke={fg(0.2)} strokeWidth={1} fill="none">
        <Circle cx={WC} cy={WC} r={148} />
        <Circle cx={WC} cy={WC} r={133} stroke={fg(0.12)} />
        <Circle cx={WC} cy={WC} r={108} stroke={fg(0.1)} strokeDasharray="2 6" />
        {ticks}
      </G>
      {dots}
    </Svg>
  );
}

/* ------------------------------ screen ------------------------------ */

function HoroscopeScreen({ horoscope, period }) {
  const tr = useT();
  const areas = areaData(horoscope, tr);
  const scored = areas.filter((a) => a.score !== null);
  const overall = scored.length
    ? Math.round(scored.reduce((sum, a) => sum + a.score, 0) / scored.length)
    : null;

  return (
    <View>
      <Reanimated.View entering={enter(0)}>
        <Hero horoscope={horoscope} period={period} overall={overall} areas={areas} />
      </Reanimated.View>

      <Reanimated.View entering={enter(1)}>
        <SectionTitle overline={tr("mylife.insights")} note={tr("mylife.tapToRead")}>{period.areasTitle}</SectionTitle>
        <AreaList areas={areas} />
      </Reanimated.View>

      <Reanimated.View entering={enter(2)}>
        <Guidance
          title={period.guidanceTitle}
          dos={toList(horoscope.guidance?.dos)}
          donts={toList(horoscope.guidance?.donts)}
        />
      </Reanimated.View>

      {period.key === "daily" && Array.isArray(horoscope.timing) && horoscope.timing.length > 0 && (
        <Reanimated.View entering={enter(3)}>
          <BestWindow timing={horoscope.timing} />
        </Reanimated.View>
      )}

      <Reanimated.View entering={enter(4)}>
        <Lucky lucky={horoscope.lucky} />
      </Reanimated.View>

      <Reanimated.View entering={enter(5)}>
        <Tips tips={horoscope.tips} />
      </Reanimated.View>
    </View>
  );
}

/* The one rich card: the tab's deep gradient with a slowly turning wheel. */
function Hero({ horoscope, period, overall, areas }) {
  const t = useTheme();
  const tr = useT();
  const sign = toText(horoscope.sign);
  const fg = tint(t.fg);
  const still = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    // One turn every 144 s, as on the login screen.
    turn.value = withRepeat(withTiming(360, { duration: 144000, easing: Easing.linear }), -1);
  }, [still, turn]);

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value}deg` }],
  }));

  return (
    <View style={[styles.hero, { shadowColor: t.accent, backgroundColor: t.hero }]}>
      <View style={[styles.heroClip, { backgroundColor: t.hero, borderColor: t.heroBorder }]}>
        <Reanimated.View style={[styles.heroWheel, wheelStyle]} pointerEvents="none">
          <ZodiacWheel />
        </Reanimated.View>

        <View style={styles.heroContent}>
          <View style={styles.heroMeta}>
            <Text style={[styles.heroDate, { color: fg(0.72) }]} numberOfLines={1}>{toText(horoscope.label)}</Text>
            {!!sign && (
              <View style={[styles.heroChip, { backgroundColor: fg(0.1), borderColor: fg(0.24) }]}>
                <Icon name="moon-waning-crescent" size={12} color={fg(1)} />
                <Text style={[styles.heroChipText, { color: fg(1) }]}>
                  {tr("mylife.moonIn", { sign: signName(tr, sign) })}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.heroKicker, { color: fg(0.72) }]}>{period.kicker}</Text>
          <Text style={[styles.heroTitle, { color: fg(1) }]}>{toText(horoscope.title)}</Text>
          <Text style={[styles.heroText, { color: fg(0.86) }]}>{toText(horoscope.text)}</Text>

          {overall !== null && (
            <View style={[styles.energyRow, { borderTopColor: fg(0.16) }]}>
              <ScoreRing score={overall} />
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={[styles.energyLabel, { color: fg(0.72) }]}>{tr("mylife.overallEnergy")}</Text>
                <Text style={[styles.energyValue, { color: fg(1) }]}>{energyLabel(tr, overall)}</Text>
              </View>
            </View>
          )}

          {areas.some((a) => a.score !== null) && (
            <View style={[styles.glance, { backgroundColor: fg(0.07), borderColor: fg(0.14) }]}>
              {areas.map((area) => (
                <View key={area.key} style={styles.glanceItem}>
                  <Icon name={area.icon} size={17} color={fg(0.85)} />
                  <Text style={[styles.glanceScore, { color: fg(1) }]}>
                    {area.score !== null ? area.score : "–"}
                  </Text>
                  <Text style={[styles.glanceLabel, { color: fg(0.65) }]} numberOfLines={1} adjustsFontSizeToFit>
                    {area.label}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function AreaList({ areas }) {
  const t = useTheme();
  const tr = useT();
  const [open, setOpen] = useState(null);

  const toggle = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((current) => (current === key ? null : key));
  };

  return (
    <Card contentStyle={styles.areaList}>
      {areas.map((area, index) => {
        const isOpen = open === area.key;
        const status = STATUS[area.status];
        const statusLabel = tr(status.labelKey);

        return (
          <View key={area.key} style={index > 0 && styles.divider}>
            <Pressable
              onPress={() => toggle(area.key)}
              style={styles.areaRow}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={tr("mylife.areaA11y", { area: area.label, status: statusLabel })}
            >
              <Medallion icon={area.icon} size={46} active={isOpen} />

              <View style={styles.areaBody}>
                <View style={styles.areaTop}>
                  <Text style={styles.areaName}>{area.label}</Text>
                  <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                    <Text style={[styles.statusText, { color: status.color }]} numberOfLines={1}>{statusLabel}</Text>
                  </View>
                </View>
                {!!area.title && (
                  <Text style={styles.areaTitle} numberOfLines={isOpen ? undefined : 1}>
                    {area.title}
                  </Text>
                )}
              </View>

              {area.score !== null && (
                <Ring
                  score={area.score}
                  size={46}
                  stroke={3.5}
                  color={t.accent}
                  track={t.soft}
                  textStyle={styles.areaRingText}
                />
              )}

              <View style={[styles.chevron, { backgroundColor: isOpen ? t.accent : t.soft }, isOpen && styles.chevronOpen]}>
                <Icon name="chevron-down" size={18} color={isOpen ? C.CARD : t.accent} />
              </View>
            </Pressable>

            {isOpen && !!area.description && (
              <View style={[styles.areaDetail, { borderLeftColor: t.tint(0.4) }]}>
                <Text style={styles.areaDescription}>{area.description}</Text>
              </View>
            )}
          </View>
        );
      })}
    </Card>
  );
}

function Guidance({ title, dos, donts }) {
  const t = useTheme();
  const tr = useT();
  if (!dos.length && !donts.length) return null;

  return (
    <>
      <SectionTitle overline={tr("mylife.guidance")}>{title}</SectionTitle>
      <View style={styles.guideRow}>
        {dos.length > 0 && (
          <Card style={{ flex: 1 }} contentStyle={styles.guideCard} art={false}>
            <View style={[styles.guideAccent, { backgroundColor: t.accent }]} />
            <View style={styles.guideHead}>
              <Medallion icon="check" size={28} active />
              <Text style={styles.guideHeading}>{tr("mylife.do")}</Text>
            </View>
            {dos.map((item, index) => (
              <View key={`do-${index}`} style={styles.guideItem}>
                <Icon name="star-four-points" size={10} color={t.accent} style={{ marginTop: 5, marginRight: 8 }} />
                <Text style={styles.guideText}>{item}</Text>
              </View>
            ))}
          </Card>
        )}
        {donts.length > 0 && (
          <Card style={{ flex: 1 }} contentStyle={styles.guideCard} art={false} tone="ivory">
            <View style={styles.guideHead}>
              <Medallion icon="close" size={28} />
              <Text style={styles.guideHeading}>{tr("mylife.avoid")}</Text>
            </View>
            {donts.map((item, index) => (
              <View key={`dont-${index}`} style={styles.guideItem}>
                <View style={styles.avoidDash} />
                <Text style={styles.guideText}>{item}</Text>
              </View>
            ))}
          </Card>
        )}
      </View>
    </>
  );
}

// Minutes after midnight in IST (the timing slots are in IST).
const istMinutes = () => Math.floor((Date.now() / 60000 + 330) % 1440);

// The day's planetary hours from the current one on. The backend sends the
// whole day once; "now" is worked out here and moves every minute.
function useCurrentSlots(timing, count = 6) {
  const [now, setNow] = useState(istMinutes);

  useEffect(() => {
    const timer = setInterval(() => setNow(istMinutes()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const rows = timing.filter((slot) => Number.isFinite(slot?.start) && Number.isFinite(slot?.end));
  if (!rows.length) {
    // Older saved readings: already a window with "current" marked.
    return timing.slice(0, count).map((slot) => ({ ...slot, current: Boolean(slot?.current) }));
  }

  const index = rows.findIndex((slot) => {
    const length = (slot.end - slot.start + 1440) % 1440 || 60;
    return (now - slot.start + 1440) % 1440 < length;
  });
  const start = Math.max(0, (index === -1 ? 0 : index) - 1);

  return rows.slice(start, start + count).map((slot, i) => ({
    ...slot,
    current: start + i === index,
  }));
}

function BestWindow({ timing }) {
  const t = useTheme();
  const tr = useT();
  const slots = useCurrentSlots(timing).map((slot) => ({
    time: toText(slot?.time),
    status: toText(slot?.status).toLowerCase(),
    current: slot.current,
  }));

  return (
    <>
      <SectionTitle overline={tr("mylife.timing")} note={tr("mylife.planetaryHours")}>{tr("mylife.bestWindow")}</SectionTitle>
      <Card art={false}>
        <View style={styles.windowTrack}>
          {slots.map((slot, index) => {
            const isBest = slot.status === "best" || slot.status === "favourable";
            const isAvoid = slot.status === "avoid";

            return (
              <View key={index} style={styles.windowItem}>
                <Text style={[styles.windowNow, { color: t.accent }, !slot.current && { opacity: 0 }]} numberOfLines={1}>
                  {tr("mylife.now")}
                </Text>
                <View style={[styles.windowBar, slot.current && [styles.windowBarCurrent, { borderColor: t.accent }]]}>
                  {isBest ? (
                    <View style={[StyleSheet.absoluteFill, { borderRadius: 12, backgroundColor: t.accent }]} />
                  ) : (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        { borderRadius: 12, backgroundColor: isAvoid ? STATUS.Challenging.bg : t.soft },
                      ]}
                    />
                  )}
                  {isBest && <Icon name="white-balance-sunny" size={15} color={C.CARD} />}
                </View>
                <Text style={[styles.windowTime, isBest && { color: t.accent, fontFamily: F.bold }]}>{slot.time}</Text>
                <Text
                  style={[styles.windowStatus, isBest && { color: t.accent, fontFamily: F.bold }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {tr(isBest ? "mylife.slot.best" : isAvoid ? "mylife.slot.avoid" : "mylife.slot.neutral")}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>
    </>
  );
}

function LuckyTile({ watermark, label, children }) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1 }} contentStyle={styles.luckyTile} art={false}>
      <Icon name={watermark} size={64} color={t.accent} style={styles.luckyWatermark} />
      <Text style={styles.luckyLabel}>{label}</Text>
      {children}
    </Card>
  );
}

function Lucky({ lucky }) {
  const t = useTheme();
  const tr = useT();
  const colours = Array.isArray(lucky?.colours) ? lucky.colours : [];
  const numbers = toList(lucky?.numbers);
  const letters = toList(lucky?.letters);

  if (!colours.length && !numbers.length && !letters.length) return null;

  return (
    <>
      <SectionTitle overline={tr("mylife.luck")}>{tr("mylife.luckyForYou")}</SectionTitle>
      <View style={styles.luckyRow}>
        {colours.length > 0 && (
          <LuckyTile watermark="palette-outline" label={tr("mylife.colours")}>
            <View style={styles.swatches}>
              {colours.slice(0, 3).map((c, i) => (
                <View
                  key={`${c?.name}-${i}`}
                  style={[styles.swatch, { backgroundColor: c?.hex || t.soft, marginLeft: i ? -9 : 0 }]}
                />
              ))}
            </View>
            <Text style={styles.luckyValue} numberOfLines={2}>
              {colours.map((c) => toText(c?.name)).filter(Boolean).join(", ")}
            </Text>
          </LuckyTile>
        )}

        {numbers.length > 0 && (
          <LuckyTile watermark="numeric" label={tr("mylife.numbers")}>
            <Text style={[styles.luckyBig, { color: t.accent }]}>{numbers.slice(0, 3).join(" · ")}</Text>
          </LuckyTile>
        )}

        {letters.length > 0 && (
          <LuckyTile watermark="alphabetical-variant" label={tr("mylife.letters")}>
            <Text style={[styles.luckyBig, { color: t.accent }]}>{letters.slice(0, 3).join(" · ")}</Text>
          </LuckyTile>
        )}
      </View>
    </>
  );
}

function Tips({ tips }) {
  const t = useTheme();
  const tr = useT();
  const cosmic = toText(tips?.cosmic);
  const people = [
    { key: "singles", icon: "account-outline", label: tr("mylife.forSingles") },
    { key: "couples", icon: "account-multiple-outline", label: tr("mylife.forCouples") },
  ].filter((row) => toText(tips?.[row.key]));

  if (!cosmic && !people.length) return null;

  return (
    <Card tone="ivory" style={{ marginTop: 30 }} contentStyle={{ paddingVertical: 4 }}>
      {!!cosmic && (
        <View style={styles.quote}>
          <Text style={[styles.quoteMark, { color: t.accent }]}>“</Text>
          <View style={styles.quoteHead}>
            <Icon name="star-four-points" size={12} color={C.GOLD} />
            <Text style={[styles.quoteLabel, { color: t.accent }]}>{tr("mylife.cosmicTip")}</Text>
          </View>
          <Text style={styles.quoteText}>{cosmic}</Text>
        </View>
      )}

      {people.map((row, index) => (
        <View key={row.key} style={[styles.tipRow, (cosmic || index > 0) && styles.divider]}>
          <Medallion icon={row.icon} size={34} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.tipLabel}>{row.label}</Text>
            <Text style={styles.tipText}>{toText(tips[row.key])}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

/* ------------------------------ styles ------------------------------ */

const softShadow = {
  shadowOpacity: 0.08,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 10 },
  elevation: 3,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.LAVENDER },
  scroll: { paddingHorizontal: 16, paddingTop: 6 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 28 },

  stateIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.CARD, borderWidth: 1, borderColor: C.BORDER, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  stateTitle: { color: C.INK, fontSize: 24, fontFamily: F.bold, marginBottom: 8, textAlign: "center" },
  stateText: { color: C.MUTED, fontSize: 14, fontFamily: F.regular, textAlign: "center", lineHeight: 21, marginBottom: 24 },
  loadingText: { marginTop: 16, color: C.MUTED, fontSize: 14, fontFamily: F.medium, textAlign: "center" },
  primaryButton: { backgroundColor: C.PLUM, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999 },
  primaryButtonText: { color: C.CARD, fontSize: 15, fontFamily: F.semibold },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  brand: { flex: 1, flexDirection: "row", alignItems: "center" },
  logoBadge: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.PLUM, alignItems: "center", justifyContent: "center" },
  title: { color: C.INK, fontSize: 26, fontFamily: F.bold, letterSpacing: -0.4 },
  subtitle: { color: C.MUTED, fontSize: 13, fontFamily: F.regular, marginTop: 1 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.CARD, borderWidth: 1, borderColor: C.BORDER, alignItems: "center", justifyContent: "center", marginLeft: 12 },

  tabs: { flexDirection: "row", marginHorizontal: 16, marginBottom: 16, padding: 4, borderRadius: 999, backgroundColor: C.CARD, borderWidth: 1, borderColor: C.BORDER },
  tabIndicator: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: 999, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  tab: { flex: 1, height: 40, alignItems: "center", justifyContent: "center" },
  tabText: { color: C.MUTED, fontSize: 13.5, fontFamily: F.semibold },
  tabTextActive: { color: C.CARD },

  card: { borderRadius: 28, backgroundColor: C.CARD, ...softShadow },
  cardClip: { borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: "rgba(217,206,193,0.6)" },
  cardArt: { position: "absolute", top: 0, right: 0 },
  cardHighlight: { position: "absolute", top: 0, left: 20, right: 20, height: 1, backgroundColor: "#FFFFFF" },
  cardContent: { padding: 16 },
  divider: { borderTopWidth: 1, borderTopColor: C.LINE },

  sectionWrap: { marginTop: 34, marginBottom: 14, paddingHorizontal: 2 },
  overline: { fontSize: 11, fontFamily: F.bold, letterSpacing: 1.6, marginBottom: 4 },
  glance: { flexDirection: "row", marginTop: 18, paddingVertical: 12, borderRadius: 18, borderWidth: 1 },
  glanceItem: { flex: 1, alignItems: "center", gap: 3 },
  glanceScore: { fontSize: 16, fontFamily: F.bold, marginTop: 2 },
  glanceLabel: { fontSize: 10.5, fontFamily: F.medium },
  areaRingText: { fontSize: 13 },
  sectionHead: { flexDirection: "row", alignItems: "center", marginTop: 32, marginBottom: 14, paddingHorizontal: 2 },
  sectionTitle: { color: C.INK, fontSize: 22, fontFamily: F.bold, letterSpacing: -0.3 },
  sectionRule: { flex: 1, height: 1, marginHorizontal: 12 },
  sectionNote: { color: C.MUTED, fontSize: 12, fontFamily: F.medium },

  medal: { alignItems: "center", justifyContent: "center", borderWidth: 1, overflow: "hidden" },
  ringText: { color: C.CARD, fontSize: 16, fontFamily: F.bold },

  hero: { borderRadius: 26, backgroundColor: C.PLUM, shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  heroClip: { borderRadius: 26, overflow: "hidden", borderWidth: 1 },
  heroWheel: { position: "absolute", top: -WHEEL * 0.42, right: -WHEEL * 0.38, width: WHEEL, height: WHEEL },
  heroContent: { padding: 20 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18, paddingRight: 60 },
  heroDate: { flexShrink: 1, color: "rgba(255,253,252,0.75)", fontSize: 11.5, fontFamily: F.semibold, letterSpacing: 1, textTransform: "uppercase" },
  heroChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "rgba(255,253,252,0.16)", borderWidth: 1, borderColor: "rgba(255,253,252,0.3)" },
  heroChipText: { color: C.CARD, fontSize: 11.5, fontFamily: F.semibold },
  heroKicker: { color: "rgba(255,253,252,0.75)", fontSize: 12, fontFamily: F.semibold, letterSpacing: 1, textTransform: "uppercase" },
  heroTitle: { color: C.CARD, fontSize: 32, lineHeight: 37, fontFamily: F.bold, letterSpacing: -0.6, marginTop: 8, marginBottom: 12, paddingRight: 16 },
  heroText: { color: "rgba(255,253,252,0.88)", fontSize: 15, lineHeight: 23, fontFamily: F.regular },
  energyRow: { flexDirection: "row", alignItems: "center", marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: "rgba(255,253,252,0.18)" },
  energyLabel: { color: "rgba(255,253,252,0.75)", fontSize: 12, fontFamily: F.medium },
  energyValue: { color: C.CARD, fontSize: 18, fontFamily: F.bold, marginTop: 2 },

  areaList: { paddingHorizontal: 18, paddingVertical: 6 },
  areaRow: { flexDirection: "row", alignItems: "center", paddingVertical: 20 },
  areaBody: { flex: 1, marginLeft: 16 },
  areaTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  areaName: { color: C.INK, fontSize: 16, fontFamily: F.semibold },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusText: { fontSize: 9.5, fontFamily: F.semibold },
  areaTitle: { color: C.MUTED, fontSize: 13.5, lineHeight: 19, fontFamily: F.regular, marginTop: 6 },
  barRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  barValue: { width: 46, textAlign: "right", fontSize: 12.5, fontFamily: F.bold },
  chevron: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginLeft: 14 },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  areaDetail: { marginLeft: 62, marginRight: 8, marginTop: -4, marginBottom: 20, paddingLeft: 14, borderLeftWidth: 2 },
  areaDescription: { color: C.MUTED, fontSize: 14, lineHeight: 22, fontFamily: F.regular },

  guideRow: { flexDirection: "row", gap: 10 },
  guideCard: { padding: 14, paddingTop: 18 },
  guideAccent: { position: "absolute", top: 0, left: 16, right: 16, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  guideHead: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  guideHeading: { color: C.INK, fontSize: 18, fontFamily: F.bold, marginLeft: 9 },
  guideItem: { flexDirection: "row", alignItems: "flex-start", marginTop: 11 },
  avoidDash: { width: 8, height: 2, borderRadius: 1, backgroundColor: C.MUTED, marginTop: 9, marginRight: 8 },
  guideText: { flex: 1, color: C.INK, fontSize: 13.5, lineHeight: 20, fontFamily: F.medium },

  windowTrack: { flexDirection: "row", justifyContent: "space-between" },
  windowItem: { width: "15.5%", alignItems: "center" },
  windowNow: { fontSize: 9.5, fontFamily: F.bold, letterSpacing: 0.8, marginBottom: 5 },
  windowBar: { width: "100%", height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  windowBarCurrent: { borderWidth: 2, borderRadius: 13 },
  windowTime: { color: C.INK, fontSize: 10.5, fontFamily: F.semibold, marginTop: 8, textAlign: "center" },
  windowStatus: { color: C.MUTED, fontSize: 10.5, fontFamily: F.medium, marginTop: 1, textAlign: "center" },

  luckyRow: { flexDirection: "row", gap: 10 },
  luckyTile: { minHeight: 128, padding: 14, justifyContent: "space-between" },
  luckyWatermark: { position: "absolute", right: -10, bottom: -12, opacity: 0.07 },
  luckyLabel: { color: C.MUTED, fontSize: 11, fontFamily: F.semibold, letterSpacing: 1, textTransform: "uppercase" },
  swatches: { flexDirection: "row", marginTop: 14, marginBottom: 8 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: C.CARD },
  luckyValue: { color: C.INK, fontSize: 12.5, lineHeight: 17, fontFamily: F.semibold },
  luckyBig: { fontSize: 26, fontFamily: F.bold, letterSpacing: -0.3, marginTop: 14 },

  quote: { paddingTop: 16, paddingBottom: 18 },
  quoteMark: { position: "absolute", right: 0, top: -20, fontFamily: F.bold, fontSize: 120, opacity: 0.14 },
  quoteHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  quoteLabel: { fontSize: 11, fontFamily: F.semibold, letterSpacing: 1, textTransform: "uppercase" },
  quoteText: { color: C.INK, fontSize: 19, lineHeight: 27, fontFamily: F.medium, fontStyle: "italic", paddingRight: 20 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 15 },
  tipLabel: { color: C.MUTED, fontSize: 12, fontFamily: F.semibold },
  tipText: { color: C.INK, fontSize: 14, lineHeight: 21, fontFamily: F.regular, marginTop: 3 },
});
