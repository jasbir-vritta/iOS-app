import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
} from "expo-audio";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    AppState,
    Image,
    ImageBackground,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import mantraBackground from "../../../assets/images/mantra/mantra_background.png";
import mantrasData from "../../../components/constants/mantra.json";
import {useMantraStore} from "../../../components/stores/mantraStore";
import {useUserStore} from "../../../components/stores/userStore";
import { API_URL, authHeaders } from "../../../lib/auth";

const TARGET_CHANTS = 108;
// Chants done on this phone and not yet sent, per profile.
const PENDING_PREFIX = "@mantra_pending_";
// Last known total from the backend, per profile (shown offline).
const TOTAL_PREFIX = "@mantra_total_";
// Older versions: an unclaimed round per profile + mantra.
const LEGACY_PREFIX = "@mantra_chants_";
// Send chants this long after the last tap (one request per batch).
const FLUSH_DELAY_MS = 3000;

const C = {
  bg: "#F3ECFB",
  purple: "#3C0C4D",
  purpleLight: "#E9DFF1",
  text: "#201431",
  muted: "#777393",
  white: "#FFFFFF",
  orange: "#FCE8D4",
  orangeText: "#A23B18",
};

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
          r={radius}
          stroke={C.purple}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      <View style={styles.ringText}>
        <View style={styles.countRow}>
          <Text style={styles.countNumber}>{count}</Text>
          <Text style={styles.countTarget}> / {TARGET_CHANTS}</Text>
        </View>
        <Text style={styles.progressLabel}>Chants completed</Text>
      </View>
    </View>
  );
}

export default function MantraDetailScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();

  const params = useLocalSearchParams<{
    mantra_id?: string | string[];
  }>();

  const mantraId = Array.isArray(params.mantra_id)
    ? params.mantra_id[0]
    : params.mantra_id || "mars-mantra";

  const selectedMantra = MANTRAS.find((item) => item.id === mantraId);
  const mantra = selectedMantra ?? MANTRAS[0];

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

  const ringSize = Math.min(
    width * 0.43,
    compact ? 150 : 174
  );

  const planetSize = Math.min(
    width * 0.75,
    compact ? 240 : 280
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
          bonus > 0 ? `${days}-day streak! 🔥` : "108 chants completed 🙏",
          [
            `You earned ₹${data.credits_awarded}.`,
            bonus > 0 ? `Streak bonus: +₹${bonus}.` : "",
            days > 0 && bonus === 0 ? `Streak: ${days} day${days > 1 ? "s" : ""} in a row.` : "",
            "Keep chanting — every chant counts on the leaderboard.",
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
  }, [activeProfileId, claimMantra, savePending, totalKey]);

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
        "Profile unavailable",
        "Please select a profile before tracking mantra progress."
      );
      return;
    }

    try {
      await player.seekTo(0);
      player.play();

      await savePending(pendingRef.current + 1);

      // Batch: send a few seconds after the last chant.
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => void flushRef.current(), FLUSH_DELAY_MS);
    } catch (error) {
      console.error("Mantra playback failed:", error);

      Alert.alert(
        "Audio unavailable",
        "Could not play the mantra. Please try again."
      );
    }
  }, [isLoading, isPlaying, activeProfileId, player, savePending]);

  // Only chants that haven't been sent yet can be undone.
  const undoLastChant = useCallback(async () => {
    if (pendingRef.current <= 0) {
      Alert.alert(
        "Already saved",
        "Your chants have been saved to the leaderboard and can't be undone."
      );
      return;
    }

    stopAudio();
    await savePending(pendingRef.current - 1);
  }, [savePending, stopAudio]);

  // Clears chants not sent yet. Saved chants (leaderboard, reward progress) stay.
  const resetUnsent = useCallback(() => {
    if (pendingRef.current <= 0) return;

    const count = pendingRef.current;

    Alert.alert(
      "Reset unsent chants?",
      `${count} chant${count > 1 ? "s" : ""} not saved yet will be removed. Chants already saved to the leaderboard stay.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            if (flushTimer.current) {
              clearTimeout(flushTimer.current);
              flushTimer.current = null;
            }
            stopAudio();
            void savePending(0);
          },
        },
      ]
    );
  }, [savePending, stopAudio]);

  const copyLyrics = async () => {
    const lyrics = mantra?.sanskritLyrics || "";

    try {
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(lyrics);

      Alert.alert(
        "Copied",
        "Mantra lyrics copied to clipboard."
      );
    } catch {
      Alert.alert(
        "Mantra lyrics",
        lyrics || "Lyrics unavailable."
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
        <Text>No mantras are configured.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const reward = mantra.reward ?? 5;
  const chantTarget = mantra.chantCount || TARGET_CHANTS;
  return (
    <ImageBackground
      source={mantraBackground}
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={C.bg}
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
              accessibilityLabel="Go back"
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={30}
                color={C.purple}
              />
            </TouchableOpacity>

            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => setIsFavorite((value) => !value)}
                style={styles.headerIcon}
                accessibilityLabel="Toggle favorite"
              >
                <MaterialCommunityIcons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={27}
                  color={C.purple}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  Alert.alert(mantra.name, mantra.description)
                }
                style={styles.headerIcon}
                accessibilityLabel="More information"
              >
                <MaterialCommunityIcons
                  name="dots-horizontal-circle-outline"
                  size={27}
                  color={C.purple}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Title */}
          <View style={styles.titleSection}>
            <Text style={styles.deity}>{mantra.deity}</Text>
            <Text style={styles.title}>{mantra.name}</Text>
            <Text style={styles.description}>
              {mantra.description}
            </Text>

            <View style={styles.rewardBadge}>
              <MaterialCommunityIcons
                name="gift-outline"
                size={17}
                color={C.orangeText}
              />
              <Text style={styles.rewardText}>
                Complete {chantTarget} chants · Earn ₹{reward}
              </Text>
            </View>
          </View>

          {/* Artwork */}
          <View
            style={[
              styles.planetSection,
              { height: planetSize + (compact ? 8 : 16) },
            ]}
          >
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
          </View>

          {/* Chanting card */}
          <View
            style={[
              styles.mainCard,
              { marginTop: compact ? -90 : -105 },
            ]}
          >
            {/* Lyrics */}
            <View style={styles.lyricsHeader}>
              <View style={styles.lyricsTextContainer}>
                <Text style={styles.sanskrit}>
                  {mantra.sanskritLyrics ||
                    "Mantra lyrics not available"}
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
                accessibilityLabel="Copy mantra lyrics"
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
                name="diamond"
                size={14}
                color="#A84A2B"
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
                    Total chants: {totalChants}
                    {pending > 0 ? " · saving…" : ""}
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
              <Text style={styles.chantButtonText}>
                {isPlaying ? "Chanting..." : "Tap to Chant"}
              </Text>
            </TouchableOpacity>

            {isPlaying && (
              <Text style={styles.playingLabel}>
                Mantra audio is playing…
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
                  Undo last chant
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
                  Reset
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
                Every {chantTarget} chants earns ₹{reward}, automatically.
                {"\n"}
                Every chant counts on the leaderboard and is saved as you go.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  totalText: {
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
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 34,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  titleSection: {
    alignItems: "center",
    paddingHorizontal: 14,
    marginTop: 0,
  },
  deity: {
    fontSize: 14,
    color: C.muted,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
  },
  description: {
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
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 22,
    gap: 7,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.orangeText,
  },
  planetSection: {
    alignItems: "center",
    justifyContent: "flex-start",
    position: "relative",
    paddingTop: 12,
  },
  mainCard: {
    backgroundColor: "rgba(255,252,254,0.97)",
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 17,
    paddingBottom: 24,
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
    fontWeight: "800",
    color: C.purple,
    textAlign: "center",
  },
  pronunciation: {
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
    backgroundColor: "#E9D5D5",
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
    fontWeight: "800",
    color: C.purple,
  },
  countTarget: {
    fontSize: 22,
    fontWeight: "500",
    color: C.text,
  },
  progressLabel: {
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
    fontWeight: "600",
    color: C.white,
  },
  playingLabel: {
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
    fontWeight: "500",
  },
  disabledText: {
    color: "#BDB3C7",
  },
  actionDivider: {
    height: 25,
    width: 1,
    backgroundColor: "#D9CEDF",
  },
  infoBox: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F0EAF5",
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: C.muted,
  },
});