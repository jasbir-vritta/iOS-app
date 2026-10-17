import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { requireOptionalNativeModule } from "expo-modules-core";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    AppState,
    Platform,
    Image,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import Reanimated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";

import { F } from "../../../components/auth/theme";

import mantrasData from "../../../components/constants/mantra.json";
import {useMantraStore} from "../../../components/stores/mantraStore";
import {useUserStore} from "../../../components/stores/userStore";
import { track, useScreenTime } from "../../../lib/analytics";
import { API_URL, authHeaders } from "../../../lib/auth";
import { useT } from "../../../lib/i18n";

const TARGET_CHANTS = 108;
// Chants done on this phone and not yet sent, per profile.
const PENDING_PREFIX = "@mantra_pending_";
// Last known total from the backend, per profile (shown offline).
const TOTAL_PREFIX = "@mantra_total_";
// Older versions: an unclaimed round per profile + mantra.
const LEGACY_PREFIX = "@mantra_chants_";
// Mantra chanted last (Home's "Continue your journey" opens it).
const LAST_PREFIX = "@mantra_last_";
// Send chants this long after the last tap (one request per batch).
const FLUSH_DELAY_MS = 3000;
// Favourite mantras per profile (shared with the Mantra tab).
const FAVORITES_PREFIX = "@mantra_favorites_";

// App palette (Plum, Ink, Lavender, Ivory, Card, a little Gold).
const C = {
  bg: "#F4F0F8",
  purple: "#2B1A3D",
  purpleLight: "#EFE8F7",
  text: "#1C1820",
  muted: "#68616A",
  white: "#FFFDFC",
  orange: "#F7F1E8",
  orangeText: "#8A6A2E",
  gold: "#C49A4A",
  line: "rgba(217,206,193,0.6)",
};

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

type MantraDetails = {
  id: string;
  name: string;
  deity: string;
  description: string;
  sanskritLyrics: string;
  pronunciation?: string;
  categories: string[];
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  iconColor: string;
  circleColor: string;
  imageUrl?: string;
  audioUrl?: string;
  reward: number;
  chantCount: number;
};

const MANTRAS = mantrasData as MantraDetails[];

// A mantra's translated name/deity/description (keyed by id), falling back to the
// English data. Sanskrit lyrics are never translated.
const pickText = (t: ReturnType<typeof useT>, key: string, fallback: string) => {
  const text = t(key);
  return text === key ? fallback : text;
};

function ProgressRing({
  count,
  size,
}: {
  count: number;
  size: number;
}) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(count / TARGET_CHANTS, 1);
  const still = useReducedMotion();
  const t = useT();

  // The ring glides to the new count, and the centre pulses once per chant.
  const fill = useSharedValue(progress);
  const pop = useSharedValue(1);
  useEffect(() => {
    fill.value = still ? progress : withTiming(progress, { duration: 600, easing: Easing.out(Easing.cubic) });
    if (!still) pop.value = withSequence(withTiming(1.08, { duration: 140 }), withTiming(1, { duration: 260 }));
  }, [progress, fill, pop, still]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - fill.value) }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={C.purpleLight}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius - stroke / 2 - 6}
          stroke={C.gold}
          strokeOpacity={0.35}
          strokeWidth={1}
          strokeDasharray="2 5"
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={C.purple}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={ringProps}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      <Reanimated.View style={[styles.ringText, popStyle]}>
        <View style={styles.countRow}>
          <Text style={styles.countNumber}>{count}</Text>
          <Text style={styles.countTarget}> / {TARGET_CHANTS}</Text>
        </View>
        <Text style={styles.progressLabel}>{t("mantra.chantsThisRound")}</Text>
      </Reanimated.View>
    </View>
  );
}

/* ---------------- motion per mantra ---------------- */

type Effect = "rays" | "stars" | "orbit" | "coins" | "hearts" | "notes" | "petals";

type Motion = {
  spin: number; // seconds per turn (0 = no spin, negative = the other way)
  effect: Effect;
  speed?: number; // orbit seconds per turn / rays seconds per turn
  moons?: number; // orbit: how many moons
};

const MOTION: Record<string, Motion> = {
  "sun-mantra": { spin: 60, effect: "rays", speed: 30 },
  "hanuman-mantra": { spin: 25, effect: "rays", speed: 14 },
  "moon-mantra": { spin: 0, effect: "stars" },
  "shiva-mantra": { spin: 80, effect: "stars" },
  "rahu-mantra": { spin: -50, effect: "stars" },
  "mars-mantra": { spin: 40, effect: "orbit", speed: 16, moons: 1 },
  "mercury-mantra": { spin: 30, effect: "orbit", speed: 7, moons: 1 },
  "jupiter-mantra": { spin: 50, effect: "orbit", speed: 24, moons: 2 },
  "lakshmi-mantra": { spin: 45, effect: "coins" },
  "venus-mantra": { spin: 45, effect: "hearts" },
  "saraswati-mantra": { spin: 50, effect: "notes" },
  "krishna-mantra": { spin: 50, effect: "notes" },
  "ganesh-mantra": { spin: 50, effect: "petals" },
};
const DEFAULT_MOTION: Motion = { spin: 40, effect: "stars" };

// Sun rays: a ring of short strokes that turns around the artwork.
function Rays({ size, color, seconds, still }: { size: number; color: string; seconds: number; still: boolean }) {
  const turn = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    turn.value = withRepeat(withTiming(360, { duration: seconds * 1000, easing: Easing.linear }), -1);
  }, [seconds, still, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const box = size * 1.36;
  const c = box / 2;

  return (
    <Reanimated.View
      style={[{ position: "absolute", width: box, height: box, left: (size - box) / 2, top: (size - box) / 2 }, style]}
      pointerEvents="none"
    >
      <Svg width={box} height={box}>
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i * Math.PI) / 12;
          const r1 = size * 0.54;
          const r2 = size * (i % 2 ? 0.6 : 0.66);
          return (
            <Line
              key={i}
              x1={c + r1 * Math.cos(a)}
              y1={c + r1 * Math.sin(a)}
              x2={c + r2 * Math.cos(a)}
              y2={c + r2 * Math.sin(a)}
              stroke={color}
              strokeOpacity={0.45}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
    </Reanimated.View>
  );
}

// Moons travelling round the artwork.
function Orbit({
  size,
  color,
  seconds,
  moons,
  still,
}: {
  size: number;
  color: string;
  seconds: number;
  moons: number;
  still: boolean;
}) {
  const turn = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    turn.value = withRepeat(withTiming(360, { duration: seconds * 1000, easing: Easing.linear }), -1);
  }, [seconds, still, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const box = size * 1.3;

  return (
    <Reanimated.View
      style={[{ position: "absolute", width: box, height: box, left: (size - box) / 2, top: (size - box) / 2 }, style]}
      pointerEvents="none"
    >
      {Array.from({ length: moons }, (_, i) => {
        const a = (i * 2 * Math.PI) / moons;
        const r = box / 2 - 8;
        const d = i === 0 ? 14 : 9;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: box / 2 + r * Math.sin(a) - d / 2,
              top: box / 2 - r * Math.cos(a) - d / 2,
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: color,
              shadowColor: color,
              shadowOpacity: 0.6,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        );
      })}
    </Reanimated.View>
  );
}

// Twinkling stars around the artwork.
const STAR_SPOTS = [
  { x: -0.12, y: 0.12, s: 12, d: 0 },
  { x: 1.05, y: 0.2, s: 10, d: 700 },
  { x: -0.06, y: 0.78, s: 9, d: 1300 },
  { x: 1.08, y: 0.7, s: 13, d: 400 },
  { x: 0.5, y: -0.1, s: 9, d: 1000 },
];

function Twinkle({ x, y, s: starSize, d, color, size, still }: { x: number; y: number; s: number; d: number; color: string; size: number; still: boolean }) {
  const glow = useSharedValue(0.6);
  useEffect(() => {
    if (still) return;
    glow.value = withDelay(
      d,
      withRepeat(withSequence(withTiming(1, { duration: 1300 }), withTiming(0.15, { duration: 1300 })), -1)
    );
  }, [d, glow, still]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.75 + glow.value * 0.35 }] }));
  return (
    <Reanimated.View style={[{ position: "absolute", left: x * size - starSize / 2, top: y * size - starSize / 2 }, style]}>
      <MaterialCommunityIcons name="star-four-points" size={starSize} color={color} />
    </Reanimated.View>
  );
}

// Small icons drifting up (hearts, notes, petals) or down (coins), fading in and out.
const DRIFT_SPOTS = [
  { x: 0.02, d: 0 },
  { x: 0.9, d: 1100 },
  { x: 0.18, d: 2200 },
  { x: 0.78, d: 3300 },
  { x: 0.5, d: 1700 },
];

function Drift({
  x,
  d,
  icon,
  color,
  size,
  down,
  still,
}: {
  x: number;
  d: number;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color: string;
  size: number;
  down: boolean;
  still: boolean;
}) {
  const t = useSharedValue(still ? 0.5 : 0);
  useEffect(() => {
    if (still) return;
    t.value = withDelay(d, withRepeat(withTiming(1, { duration: 4400, easing: Easing.inOut(Easing.quad) }), -1));
  }, [d, still, t]);
  const style = useAnimatedStyle(() => {
    const travel = size * 0.85;
    const y = down ? -size * 0.1 + travel * t.value : size * 0.9 - travel * t.value;
    return {
      opacity: still ? 0.5 : Math.sin(Math.PI * t.value) * 0.85,
      transform: [{ translateY: y }, { translateX: Math.sin(t.value * Math.PI * 2) * 8 }, { rotate: `${t.value * 40 - 20}deg` }],
    };
  });
  return (
    <Reanimated.View style={[{ position: "absolute", left: x * size - 9, top: 0 }, style]} pointerEvents="none">
      <MaterialCommunityIcons name={icon} size={18} color={color} />
    </Reanimated.View>
  );
}

const DRIFT_ICON: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>["name"]> = {
  coins: "circle-multiple",
  hearts: "heart",
  notes: "music-note",
  petals: "flower-tulip",
};

/* Artwork with its own motion: spin, float, and an effect that fits the mantra. */
function FloatingArt({
  size,
  playing,
  glow,
  mantraId,
  children,
}: {
  size: number;
  playing: boolean;
  glow: string;
  mantraId: string;
  children: React.ReactNode;
}) {
  const still = useReducedMotion();
  const motion = MOTION[mantraId] ?? DEFAULT_MOTION;
  const float = useSharedValue(0);
  const halo = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    float.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
    if (motion.spin !== 0) {
      const target = motion.spin > 0 ? 360 : -360;
      spin.value = withRepeat(withTiming(target, { duration: Math.abs(motion.spin) * 1000, easing: Easing.linear }), -1);
    }
  }, [float, spin, still, motion.spin]);

  useEffect(() => {
    if (still || !playing) {
      halo.value = withTiming(0, { duration: 400 });
      return;
    }
    halo.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [halo, playing, still]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 + 12 * float.value }, { rotate: `${spin.value}deg` }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + 0.18 * halo.value,
    transform: [{ scale: 0.86 + 0.08 * halo.value }],
  }));

  const coinColor = "#C49A4A";
  const driftColor = motion.effect === "coins" ? coinColor : glow;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Faint orbit rings in the mantra's colour */}
      <Svg
        width={size * 1.5}
        height={size * 1.5}
        style={{ position: "absolute", left: -size * 0.25, top: -size * 0.25 }}
        pointerEvents="none"
      >
        <Circle cx={size * 0.75} cy={size * 0.75} r={size * 0.72} stroke={glow} strokeOpacity={0.16} fill="none" />
        <Circle
          cx={size * 0.75}
          cy={size * 0.75}
          r={size * 0.62}
          stroke={glow}
          strokeOpacity={0.22}
          strokeDasharray="2 7"
          fill="none"
        />
      </Svg>

      {motion.effect === "rays" && <Rays size={size} color={glow} seconds={motion.speed ?? 30} still={still} />}

      <Reanimated.View
        style={[
          { position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: glow },
          haloStyle,
        ]}
      />
      <Reanimated.View style={floatStyle}>{children}</Reanimated.View>

      {motion.effect === "orbit" && (
        <Orbit size={size} color={glow} seconds={motion.speed ?? 16} moons={motion.moons ?? 1} still={still} />
      )}
      {motion.effect === "stars" &&
        STAR_SPOTS.map((spot, i) => <Twinkle key={i} {...spot} color={glow} size={size} still={still} />)}
      {(motion.effect === "coins" || motion.effect === "hearts" || motion.effect === "notes" || motion.effect === "petals") &&
        DRIFT_SPOTS.map((spot, i) => (
          <Drift
            key={i}
            x={spot.x}
            d={spot.d}
            icon={DRIFT_ICON[motion.effect]}
            color={driftColor}
            size={size}
            down={motion.effect === "coins"}
            still={still}
          />
        ))}
    </View>
  );
}

export default function MantraDetailScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const t = useT();

  const params = useLocalSearchParams<{
    mantra_id?: string | string[];
  }>();

  const mantraId = Array.isArray(params.mantra_id)
    ? params.mantra_id[0]
    : params.mantra_id || "mars-mantra";

  const selectedMantra = MANTRAS.find((item) => item.id === mantraId);
  const mantra = selectedMantra ?? MANTRAS[0];
  const text = useMemo(
    () => ({
      name: pickText(t, `mantra.name.${mantra.id}`, mantra.name),
      deity: pickText(t, `mantra.deity.${mantra.id}`, mantra.deity),
      description: pickText(t, `mantra.desc.${mantra.id}`, mantra.description),
    }),
    [t, mantra]
  );

  // Analytics, per mantra (e.g. mars_mantra): visited_mars_mantra,
  // mars_mantra_time_spent, and mars_mantra_chanted with the chants of this
  // visit (one event when the user leaves, not one per tap).
  const eventName = mantra.id.replace(/-/g, "_");
  useScreenTime(eventName);
  const visitChants = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const sendChants = () => {
        if (visitChants.current > 0) {
          track(`${eventName}_chanted`, { chants: visitChants.current, platform: Platform.OS });
          visitChants.current = 0;
        }
      };
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "background") sendChants();
      });
      return () => {
        subscription.remove();
        sendChants();
      };
    }, [eventName])
  );

  const player = useAudioPlayer(mantra?.audioUrl || null);
  const audioStatus = useAudioPlayerStatus(player);

  // Every chant counts on the leaderboard: chants are queued on the phone
  // ("pending") and sent in small batches. Credits are given by the backend
  // each time the profile's total passes a multiple of 108.
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [pending, setPending] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  const pendingRef = useRef(0);
  const sendingRef = useRef(false);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const claimMantra = useMantraStore((state) => state.claimMantra);

  const activeProfileId = useUserStore(
    (state) => state.user?.active_profile_id
  );

  // Per profile (the reward progress is per profile, across mantras).
  const pendingKey = activeProfileId
    ? `${PENDING_PREFIX}${activeProfileId}`
    : null;
  const totalKey = activeProfileId
    ? `${TOTAL_PREFIX}${activeProfileId}`
    : null;

  // Progress in the current round of 108 (total so far, including unsent).
  const totalChants = (serverTotal ?? 0) + pending;
  const chantCount = totalChants % TARGET_CHANTS;

  const isPlaying = Boolean(audioStatus.playing);
  const duration = Math.max(0, audioStatus.duration || 0);
  const position = Math.max(0, audioStatus.currentTime || 0);

  const audioProgress =
    duration > 0 ? Math.min(position / duration, 1) : 0;

  const compact = height < 800;

  // Sized so the whole chanting card fits on screen under the artwork.
  const ringSize = Math.min(
    width * 0.4,
    compact ? 138 : 160
  );

  const planetSize = Math.min(
    width * 0.62,
    compact ? 200 : 240
  );

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
    }).catch((error) => {
      console.warn("Audio mode setup failed:", error);
    });
  }, []);

  const savePending = useCallback(
    async (value: number) => {
      const next = Math.max(0, Math.floor(value));
      pendingRef.current = next;
      setPending(next);

      if (!pendingKey) return;

      try {
        await AsyncStorage.setItem(pendingKey, String(next));
      } catch (error) {
        console.warn("Could not save chant progress:", error);
      }
    },
    [pendingKey]
  );

  // Send queued chants. Failures keep them queued for the next try.
  const flush = useCallback(async () => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }

    const toSend = pendingRef.current;

    if (!activeProfileId || toSend <= 0 || sendingRef.current) {
      return;
    }

    sendingRef.current = true;

    try {
      const data = await claimMantra(activeProfileId, toSend);

      await savePending(pendingRef.current - toSend);
      setServerTotal(data.total_chants);

      if (totalKey) {
        AsyncStorage.setItem(totalKey, String(data.total_chants)).catch(() => {});
      }

      if (data.rewards_awarded > 0) {
        const days = data.streak?.days ?? 0;
        const bonus = data.streak_bonus_awarded ?? 0;

        Alert.alert(
          bonus > 0 ? t("mantra.streakAlertTitle", { days }) : t("mantra.roundAlertTitle"),
          [
            t("mantra.youEarned", { amount: data.credits_awarded }),
            bonus > 0 ? t("mantra.streakBonus", { bonus }) : "",
            days > 0 && bonus === 0
              ? days > 1
                ? t("mantra.streakDaysMany", { days })
                : t("mantra.streakDaysOne")
              : "",
            t("mantra.keepChanting"),
          ]
            .filter(Boolean)
            .join("\n")
        );
      }
    } catch (error) {
      console.warn("Could not send chants (will retry):", error);
    } finally {
      sendingRef.current = false;
    }
  }, [activeProfileId, claimMantra, savePending, totalKey, t]);

  // Latest flush for timers/cleanup without re-running effects.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // Load: queued chants on this phone + the profile's total from the backend.
  useEffect(() => {
    let mounted = true;

    async function load() {
      // Start from a clean state for this profile.
      setIsLoading(true);
      setServerTotal(null);
      pendingRef.current = 0;
      setPending(0);

      if (!activeProfileId || !pendingKey || !totalKey) {
        if (mounted) setIsLoading(false);
        return;
      }

      try {
        const [savedPending, savedTotal] = await Promise.all([
          AsyncStorage.getItem(pendingKey),
          AsyncStorage.getItem(totalKey),
        ]);

        let queued = Math.max(0, Math.floor(Number(savedPending) || 0));

        // Earlier versions kept an unclaimed round per mantra on the phone:
        // move it into the queue so those chants are not lost.
        const legacyKeys = MANTRAS.map(
          (m) => `${LEGACY_PREFIX}${activeProfileId}_${m.id}`
        );
        const legacy = await AsyncStorage.multiGet(legacyKeys);
        for (const [, value] of legacy) {
          queued += Math.max(0, Math.min(TARGET_CHANTS, Math.floor(Number(value) || 0)));
        }
        await AsyncStorage.multiRemove([
          ...legacyKeys,
          ...legacyKeys.map((key) => `${key}_claimed`),
        ]);

        if (!mounted) return;

        pendingRef.current = queued;
        setPending(queued);
        await AsyncStorage.setItem(pendingKey, String(queued));

        // Last known total, so the counter shows right away (and offline).
        const cachedTotal = Number(savedTotal);
        if (savedTotal !== null && Number.isFinite(cachedTotal) && cachedTotal >= 0) {
          setServerTotal(cachedTotal);
        }

        const response = await fetch(
          `${API_URL}/mantra/progress?profile_id=${encodeURIComponent(activeProfileId)}`,
          { headers: await authHeaders() }
        );

        if (response.ok) {
          const data = await response.json();
          if (mounted && typeof data?.total_chants === "number") {
            setServerTotal(data.total_chants);
            AsyncStorage.setItem(totalKey, String(data.total_chants)).catch(() => {});
          }
        }
      } catch (error) {
        console.warn("Could not load chant progress:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }

      // Send anything left over from last time.
      if (mounted) void flushRef.current();
    }

    // Started from a timer so no state is set synchronously in the effect.
    const timer = setTimeout(() => void load(), 0);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [activeProfileId, pendingKey, totalKey]);

  // Send queued chants when the app goes to the background or the screen closes.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void flushRef.current();
    });

    return () => {
      subscription.remove();
      void flushRef.current();
    };
  }, []);

  const stopAudio = useCallback(() => {
    try {
      player.pause();
      player.seekTo(0);
    } catch (error) {
      console.warn("Could not stop mantra audio:", error);
    }
  }, [player]);

  const playMantra = useCallback(async () => {
    if (isLoading || isPlaying) {
      return;
    }

    if (!activeProfileId) {
      Alert.alert(
        t("mantra.profileUnavailable"),
        t("mantra.profileUnavailableText")
      );
      return;
    }

    try {
      await player.seekTo(0);
      player.play();

      await savePending(pendingRef.current + 1);
      visitChants.current += 1;
      AsyncStorage.setItem(`${LAST_PREFIX}${activeProfileId}`, mantra.id).catch(() => {});

      // Batch: send a few seconds after the last chant.
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => void flushRef.current(), FLUSH_DELAY_MS);
    } catch (error) {
      console.error("Mantra playback failed:", error);

      Alert.alert(
        t("mantra.audioUnavailable"),
        t("mantra.audioUnavailableText")
      );
    }
  }, [isLoading, isPlaying, activeProfileId, player, savePending, mantra.id, t]);

  // Only chants that haven't been sent yet can be undone.
  const undoLastChant = useCallback(async () => {
    if (pendingRef.current <= 0) {
      Alert.alert(
        t("mantra.alreadySaved"),
        t("mantra.alreadySavedText")
      );
      return;
    }

    stopAudio();
    await savePending(pendingRef.current - 1);
    visitChants.current = Math.max(0, visitChants.current - 1);
  }, [savePending, stopAudio, t]);

  // Clears chants not sent yet. Saved chants (leaderboard, reward progress) stay.
  const resetUnsent = useCallback(() => {
    if (pendingRef.current <= 0) return;

    const count = pendingRef.current;

    Alert.alert(
      t("mantra.resetTitle"),
      count > 1 ? t("mantra.resetTextMany", { count }) : t("mantra.resetTextOne"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("mantra.reset"),
          style: "destructive",
          onPress: () => {
            if (flushTimer.current) {
              clearTimeout(flushTimer.current);
              flushTimer.current = null;
            }
            stopAudio();
            visitChants.current = Math.max(0, visitChants.current - count);
            void savePending(0);
          },
        },
      ]
    );
  }, [savePending, stopAudio, t]);

  // Favourites are kept per profile on the phone (same list as the Mantra tab).
  useEffect(() => {
    if (!activeProfileId) return;
    let cancelled = false;
    AsyncStorage.getItem(`${FAVORITES_PREFIX}${activeProfileId}`)
      .then((value) => {
        if (cancelled) return;
        const list = value ? JSON.parse(value) : [];
        setIsFavorite(Array.isArray(list) && list.includes(mantra.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeProfileId, mantra.id]);

  const toggleFavorite = async () => {
    const next = !isFavorite;
    setIsFavorite(next);
    if (!activeProfileId) return;
    try {
      const key = `${FAVORITES_PREFIX}${activeProfileId}`;
      const value = await AsyncStorage.getItem(key);
      const list: string[] = value ? JSON.parse(value) : [];
      const updated = next ? [...new Set([...list, mantra.id])] : list.filter((id) => id !== mantra.id);
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch {
      // Keep the heart as tapped; it saves next time.
    }
  };

  // Share the mantra's audio as a file (plays in WhatsApp etc.).
  const [sharingAudio, setSharingAudio] = useState(false);

  const shareText = () => {
    Share.share({
      message: `${t("mantra.shareMessage", { name: text.name, deity: text.deity })}\n${mantra.sanskritLyrics || ""}`.trim(),
    }).catch(() => {});
  };

  const shareAudio = async () => {
    if (!mantra.audioUrl || sharingAudio) return;

    // Audio sharing needs expo-sharing, which is in newer builds only.
    // Older builds share the mantra text instead (quietly, no error).
    if (!requireOptionalNativeModule("ExpoSharing")) {
      shareText();
      return;
    }

    setSharingAudio(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sharing = require("expo-sharing");
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing unavailable");

      const ext = (mantra.audioUrl.split("?")[0].split(".").pop() || "mp3").toLowerCase();
      const file = new File(Paths.cache, `${mantra.id}.${ext}`);
      // Downloaded once, then reused from the phone's cache.
      if (!file.exists) await File.downloadFileAsync(mantra.audioUrl, file);

      await Sharing.shareAsync(file.uri, {
        mimeType: ext === "m4a" ? "audio/mp4" : "audio/mpeg",
        UTI: ext === "m4a" ? "public.mpeg-4-audio" : "public.mp3",
        dialogTitle: t("mantra.shareA11y", { name: text.name }),
      });
    } catch (error) {
      console.warn("Mantra audio share failed:", error);
      shareText();
    } finally {
      setSharingAudio(false);
    }
  };

  // Share button: shares the audio (text only if a mantra has no audio).
  const shareMantra = () => {
    if (!mantra.audioUrl) {
      shareText();
      return;
    }
    void shareAudio();
  };

  const copyLyrics = async () => {
    const lyrics = mantra?.sanskritLyrics || "";

    try {
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(lyrics);

      Alert.alert(
        t("mantra.copied"),
        t("mantra.copiedText")
      );
    } catch {
      Alert.alert(
        t("mantra.lyrics"),
        lyrics || t("mantra.lyricsUnavailable")
      );
    }
  };

  const formatTime = (seconds: number) => {
    const safe = Math.floor(Math.max(0, seconds));

    return `${Math.floor(safe / 60)}:${String(
      safe % 60
    ).padStart(2, "0")}`;
  };

  if (!mantra) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Text>{t("mantra.noneConfigured")}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text>{t("mantra.goBack")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const reward = mantra.reward ?? 5;
  const chantTarget = mantra.chantCount || TARGET_CHANTS;
  return (
    <View style={[styles.background, { backgroundColor: C.bg }]}>
      {/* Each mantra's own tint, fading into the app's lavender */}
      <LinearGradient
        colors={[mantra.circleColor || C.purpleLight, mantra.circleColor || C.purpleLight, C.bg]}
        locations={[0, 0.35, 0.85]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={mantra.circleColor || C.bg}
        />

        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerCircle}
              accessibilityLabel={t("mantra.goBack")}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={30}
                color={C.purple}
              />
            </TouchableOpacity>

            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={toggleFavorite}
                style={styles.headerIcon}
                accessibilityLabel={t("mantra.toggleFavA11y")}
              >
                <MaterialCommunityIcons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={27}
                  color={C.purple}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={shareMantra}
                disabled={sharingAudio}
                style={styles.headerIcon}
                accessibilityLabel={t("mantra.shareA11y", { name: text.name })}
              >
                {sharingAudio ? (
                  <ActivityIndicator size="small" color={C.purple} />
                ) : (
                  <MaterialCommunityIcons
                    name="share-variant"
                    size={21}
                    color={C.purple}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Title */}
          <View style={styles.titleSection}>
            <Text style={styles.deity}>{text.deity}</Text>
            <Text style={styles.title}>{text.name}</Text>
            <Text style={styles.description}>
              {text.description}
            </Text>

            <View style={styles.rewardBadge}>
              <MaterialCommunityIcons
                name="gift-outline"
                size={17}
                color={C.orangeText}
              />
              <Text style={styles.rewardText}>
                {t("mantra.rewardBadge", { count: chantTarget, reward })}
              </Text>
            </View>
          </View>

          {/* Artwork */}
          <View
            style={[
              styles.planetSection,
              { height: planetSize + 4 },
            ]}
          >
            <FloatingArt size={planetSize} playing={isPlaying} glow={mantra.iconColor || C.gold} mantraId={mantra.id}>
              {mantra.imageUrl ? (
                <Image
                  source={{ uri: mantra.imageUrl }}
                  style={{
                    width: planetSize,
                    height: planetSize,
                  }}
                  resizeMode="contain"
                />
              ) : (
                <MaterialCommunityIcons
                  name={mantra.icon}
                  size={planetSize * 0.8}
                  color={mantra.iconColor}
                />
              )}
            </FloatingArt>
          </View>

          {/* Chanting card */}
          <View
            style={[
              styles.mainCard,
              // The card rises over the lower part of the artwork.
              { marginTop: -Math.round(planetSize * 0.45) },
            ]}
          >
            {/* Lyrics */}
            <View style={styles.lyricsHeader}>
              <View style={styles.lyricsTextContainer}>
                <Text style={styles.sanskrit}>
                  {mantra.sanskritLyrics ||
                    t("mantra.lyricsNotAvailable")}
                </Text>

                {mantra.pronunciation ? (
                  <Text style={styles.pronunciation}>
                    {mantra.pronunciation}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={copyLyrics}
                style={styles.copyButton}
                accessibilityLabel={t("mantra.copyA11y")}
              >
                <MaterialCommunityIcons
                  name="content-copy"
                  size={21}
                  color={C.purple}
                />
              </TouchableOpacity>
            </View>

            {/* Audio progress */}
            <View style={styles.audioSection}>
              <View style={styles.audioTrack}>
                <View
                  style={[
                    styles.audioTrackProgress,
                    { width: `${audioProgress * 100}%` },
                  ]}
                />
              </View>

              <Text style={styles.audioTime}>
                {formatTime(position)} / {formatTime(duration)}
              </Text>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <MaterialCommunityIcons
                name="star-four-points"
                size={13}
                color={C.gold}
              />
              <View style={styles.dividerLine} />
            </View>

            {/* Chant counter */}
            <View style={styles.ringSection}>
              {isLoading ? (
                <ActivityIndicator color={C.purple} size="large" />
              ) : (
                <>
                  <ProgressRing
                    count={chantCount}
                    size={ringSize}
                  />
                  <Text style={styles.totalText}>
                    {pending > 0
                      ? t("mantra.totalChantsSaving", { count: totalChants })
                      : t("mantra.totalChants", { count: totalChants })}
                  </Text>
                </>
              )}
            </View>

            {/* Play mantra */}
            <TouchableOpacity
              onPress={playMantra}
              disabled={isLoading || isPlaying}
              activeOpacity={0.8}
              style={[
                styles.chantButton,
                (isLoading || isPlaying) && styles.disabledButton,
              ]}
            >
              <MaterialCommunityIcons
                name="gesture-tap"
                size={24}
                color={C.white}
              />
              <Text style={styles.chantButtonText} numberOfLines={1} adjustsFontSizeToFit>
                {isPlaying ? t("mantra.chanting") : t("mantra.tapToChant")}
              </Text>
            </TouchableOpacity>

            {isPlaying && (
              <Text style={styles.playingLabel}>
                {t("mantra.audioPlaying")}
              </Text>
            )}

            {/* Undo / Reset (only chants not sent yet) */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={undoLastChant}
                disabled={isLoading || pending === 0}
              >
                <MaterialCommunityIcons
                  name="backup-restore"
                  size={22}
                  color={pending === 0 ? "#BDB3C7" : C.purple}
                />

                <Text
                  style={[
                    styles.secondaryActionText,
                    pending === 0 && styles.disabledText,
                  ]}
                >
                  {t("mantra.undoLast")}
                </Text>
              </TouchableOpacity>

              <View style={styles.actionDivider} />

              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={resetUnsent}
                disabled={isLoading || pending === 0}
              >
                <MaterialCommunityIcons
                  name="restart"
                  size={22}
                  color={pending === 0 ? "#BDB3C7" : C.purple}
                />

                <Text
                  style={[
                    styles.secondaryActionText,
                    pending === 0 && styles.disabledText,
                  ]}
                >
                  {t("mantra.reset")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Reward information */}
            <View style={styles.infoBox}>
              <MaterialCommunityIcons
                name="information-outline"
                size={21}
                color={C.muted}
              />

              <Text style={styles.infoText}>
                {t("mantra.info", { count: chantTarget, reward })}
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  totalText: {
    fontFamily: F.regular,
    marginTop: 8,
    fontSize: 12,
    color: C.muted,
    textAlign: "center",
  },

  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  header: {
    height: 46,
    marginTop: 5,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerCircle: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,253,252,0.85)",
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  titleSection: {
    alignItems: "center",
    paddingHorizontal: 14,
    marginTop: 0,
  },
  deity: {
    fontSize: 11.5,
    color: C.purple,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontFamily: F.bold,
    opacity: 0.8,
  },
  title: {
    marginTop: 4,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: F.bold,
    color: C.text,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  description: {
    fontFamily: F.regular,
    maxWidth: 310,
    fontSize: 14,
    lineHeight: 19,
    color: C.muted,
    textAlign: "center",
    marginTop: 2,
  },
  rewardBadge: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.orange,
    borderWidth: 1,
    borderColor: "#E6D9C4",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 22,
    gap: 7,
  },
  rewardText: {
    fontSize: 12,
    fontFamily: F.semibold,
    color: C.orangeText,
  },
  planetSection: {
    alignItems: "center",
    justifyContent: "flex-start",
    position: "relative",
    paddingTop: 4,
  },
  mainCard: {
    backgroundColor: "rgba(255,253,252,0.97)",
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: C.purple,
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    zIndex: 2,
    flexShrink: 0,
  },
  lyricsHeader: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  lyricsTextContainer: {
    flex: 1,
    alignItems: "center",
    paddingLeft: 25,
  },
  sanskrit: {
    fontSize: 25,
    lineHeight: 34,
    fontFamily: F.bold,
    color: C.purple,
    textAlign: "center",
  },
  pronunciation: {
    fontFamily: F.regular,
    fontSize: 14,
    color: C.muted,
    marginTop: 2,
    textAlign: "center",
  },
  copyButton: {
    width: 34,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 5,
  },
  audioSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    marginBottom: 13,
  },
  audioTrack: {
    flex: 1,
    height: 8,
    borderRadius: 10,
    backgroundColor: C.purpleLight,
    overflow: "hidden",
  },
  audioTrackProgress: {
    height: "100%",
    backgroundColor: C.purple,
    borderRadius: 10,
  },
  audioTime: {
    fontFamily: F.regular,
    minWidth: 67,
    fontSize: 12,
    color: C.muted,
    textAlign: "right",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.line,
  },
  ringSection: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  ringText: {
    alignItems: "center",
    justifyContent: "center",
  },
  countRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  countNumber: {
    fontSize: 36,
    fontFamily: F.bold,
    color: C.purple,
  },
  countTarget: {
    fontSize: 22,
    fontFamily: F.medium,
    color: C.text,
  },
  progressLabel: {
    fontFamily: F.regular,
    fontSize: 12,
    color: C.muted,
    marginTop: 0,
  },
  chantButton: {
    height: 54,
    borderRadius: 30,
    backgroundColor: C.purple,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 9,
  },
  claimButton: {
    height: 54,
    borderRadius: 30,
    backgroundColor: "#198754",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
  },
  disabledButton: {
    opacity: 0.55,
  },
  chantButtonText: {
    fontSize: 17,
    fontFamily: F.semibold,
    color: C.white,
  },
  playingLabel: {
    fontFamily: F.regular,
    fontSize: 11,
    textAlign: "center",
    color: C.muted,
    marginTop: -3,
    marginBottom: 7,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 39,
    marginBottom: 9,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryActionText: {
    fontSize: 12,
    color: C.purple,
    fontFamily: F.medium,
  },
  disabledText: {
    color: "#BDB3C7",
  },
  actionDivider: {
    height: 25,
    width: 1,
    backgroundColor: C.line,
  },
  infoBox: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.purpleLight,
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  infoText: {
    fontFamily: F.regular,
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: C.muted,
  },
});