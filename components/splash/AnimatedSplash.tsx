import { useEffect } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";

/*
 * Animated launch screen (design: "Vritta Splash Screen").
 * Plum night sky with twinkling stars, a slowly turning gold orbit, a soft
 * glow, the Vritta mark drawing itself in, then the wordmark, tagline and
 * a gold loading bar. Shown after the native splash (same plum colour).
 */

const PLUM = "#2B1A3D";
const GOLD = "#C49A4A";
const IVORY = "#FFFDFC";
const TERRACOTTA = "#C8664D";

// Total length of the time the loading bar takes to fill (ms, after a short delay).
export const SPLASH_MIN_DURATION = 2300;

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Fixed positions (fractions of the screen) so stars don't jump on re-render.
const STARS = Array.from({ length: 46 }, (_, i) => {
  const r = (n: number) => {
    const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  return {
    x: r(1),
    y: r(2),
    size: 0.8 + r(3) * 2.2,
    gold: r(4) < 0.18,
    phase: r(5) * 2000,
    period: 1600 + r(6) * 2400,
  };
});

function Star({ star, width, height }: { star: (typeof STARS)[number]; width: number; height: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      star.phase,
      withRepeat(withTiming(1, { duration: star.period, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [star.phase, star.period, t]);

  const style = useAnimatedStyle(() => ({ opacity: 0.2 + 0.6 * t.value }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: star.x * width,
          top: star.y * height,
          width: star.size,
          height: star.size,
          borderRadius: star.size,
          backgroundColor: star.gold ? GOLD : IVORY,
        },
        style,
      ]}
    />
  );
}

/** Fades and slides a block up into place after `delay` ms. */
function useRiseIn(delay: number, duration = 550) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
  }, [delay, duration, p]);
  return useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 12 }] }));
}

/** Pops a piece in from scale 0 (slight overshoot) after `delay` ms. */
function usePopIn(delay: number, duration = 500) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration, easing: Easing.bezier(0.3, 1.6, 0.5, 1) }));
  }, [delay, duration, p]);
  return useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 1.5), transform: [{ scale: p.value }] }));
}

// The mark's artwork, in its own coordinate box (viewBox "10 12 88 98").
const MARK_VIEWBOX = "10 12 88 98";
const MARK_W = 180;
const MARK_H = (MARK_W * 98) / 88;
// Approximate length of the gold orbit arc, for the "draw" effect.
const ARC_LENGTH = 150;

/** One piece of the mark drawn in its own full-size layer, so it can animate alone. */
function MarkLayer({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width={MARK_W} height={MARK_H} viewBox={MARK_VIEWBOX}>
        {children}
      </Svg>
    </Animated.View>
  );
}

function Mark() {
  // Gold arc draws itself.
  const arc = useSharedValue(ARC_LENGTH);
  useEffect(() => {
    arc.value = withDelay(50, withTiming(0, { duration: 750, easing: Easing.bezier(0.6, 0, 0.2, 1) }));
  }, [arc]);
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: arc.value }));

  // Leaves rise from their base, star and planet pop in, star then twinkles.
  const leftLeaf = usePopIn(150, 550);
  const rightLeaf = usePopIn(250, 550);
  const planet = usePopIn(650, 450);
  const orbitDot = useRiseIn(650, 300);

  const star = useSharedValue(0);
  const twinkle = useSharedValue(1);
  useEffect(() => {
    star.value = withDelay(550, withTiming(1, { duration: 500, easing: Easing.bezier(0.3, 1.6, 0.5, 1) }));
    twinkle.value = withDelay(
      1300,
      withRepeat(withSequence(withTiming(1.25, { duration: 1300 }), withTiming(1, { duration: 1300 })), -1),
    );
  }, [star, twinkle]);
  const starStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, star.value * 1.5),
    transform: [{ scale: star.value * twinkle.value }],
  }));

  return (
    <View style={{ width: MARK_W, height: MARK_H }}>
      <MarkLayer>
        <AnimatedPath
          d="M75.7 18.8 A46 46 0 0 0 14 62 A46 46 0 0 0 44.3 105.2"
          stroke={GOLD}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${ARC_LENGTH} ${ARC_LENGTH}`}
          animatedProps={arcProps}
        />
      </MarkLayer>
      <MarkLayer style={orbitDot}>
        <Circle cx={25.8} cy={31.2} r={3.4} fill={GOLD} />
      </MarkLayer>
      {/* Pieces that scale are centred on themselves via transformOrigin. */}
      <MarkLayer style={[starStyle, { transformOrigin: `${((50 - 10) / 88) * 100}% ${((34 - 12) / 98) * 100}%` }]}>
        <Path d="M50 22 Q51.8 32.2 58 34 Q51.8 35.8 50 46 Q48.2 35.8 42 34 Q48.2 32.2 50 22Z" fill={GOLD} />
      </MarkLayer>
      <MarkLayer style={[planet, { transformOrigin: `${((86 - 10) / 88) * 100}% ${((30 - 12) / 98) * 100}%` }]}>
        <Circle cx={86} cy={30} r={8} fill={TERRACOTTA} />
      </MarkLayer>
      <MarkLayer style={[leftLeaf, { transformOrigin: `${((58 - 10) / 88) * 100}% ${((100 - 12) / 98) * 100}%` }]}>
        <Path d="M25 45 C44 40 58 62 58 100 C50 82 42 64 31 55 Q23 50 25 45Z" fill={IVORY} />
      </MarkLayer>
      <MarkLayer style={[rightLeaf, { transformOrigin: `${((58 - 10) / 88) * 100}% ${((100 - 12) / 98) * 100}%` }]}>
        <Path d="M58 100 C62 74 76 52 94 44 C90 62 76 84 58 100Z" fill={IVORY} />
      </MarkLayer>
    </View>
  );
}

// "Vritta" wordmark (viewBox "44 184 260 78"), white with a gold dot on the i.
const WORD_W = 240;
const WORD_H = (WORD_W * 78) / 260;
const WORD_PATH =
  "M113.79 188.83L113.79 188.83L113.79 190.75Q111.68 191.52 109.33 194.11Q106.97 196.70 104.96 202.18L104.96 202.18L84.70 256.99Q83.93 256.90 83.07 256.90L83.07 256.90L79.71 256.90Q78.85 256.90 78.08 256.99L78.08 256.99L53.60 196.90Q52.25 193.44 50.62 192.14Q48.99 190.85 47.55 190.75L47.55 190.75L47.55 188.83Q50.43 188.93 54.32 189.02Q58.21 189.12 62.14 189.12L62.14 189.12Q66.56 189.12 70.45 189.02Q74.33 188.93 76.73 188.83L76.73 188.83L76.73 190.75Q73.66 190.85 71.93 191.47Q70.21 192.10 70.01 193.78Q69.82 195.46 71.17 198.82L71.17 198.82L88.06 241.82L99.87 209.95Q102.46 202.75 102.56 198.62Q102.65 194.50 100.54 192.67Q98.43 190.85 94.49 190.75L94.49 190.75L94.49 188.83Q97.76 188.93 100.64 189.02Q103.52 189.12 106.49 189.12L106.49 189.12Q108.61 189.12 110.48 189.02Q112.35 188.93 113.79 188.83ZM147.20 205.82L147.20 205.82Q150.27 205.82 152.19 207.12Q154.11 208.42 155.02 210.43Q155.93 212.45 155.93 214.66L155.93 214.66Q155.93 218.21 153.87 220.46Q151.81 222.72 148.45 222.72L148.45 222.72Q145.09 222.72 143.21 221.04Q141.34 219.36 141.34 216.58L141.34 216.58Q141.34 213.89 142.54 212.11Q143.74 210.34 145.57 209.09L145.57 209.09Q144.22 208.70 142.88 209.18L142.88 209.18Q141.05 209.47 139.42 210.67Q137.79 211.87 136.64 213.65Q135.49 215.42 134.81 217.49Q134.14 219.55 134.14 221.47L134.14 221.47L134.14 246.91Q134.14 251.52 136.40 253.15Q138.65 254.78 143.17 254.78L143.17 254.78L143.17 256.80Q140.96 256.70 136.73 256.56Q132.51 256.42 127.90 256.42L127.90 256.42Q124.06 256.42 120.13 256.56Q116.19 256.70 114.17 256.80L114.17 256.80L114.17 254.78Q117.53 254.78 118.93 253.34Q120.32 251.90 120.32 247.87L120.32 247.87L120.32 217.63Q120.32 213.31 119.02 211.25Q117.73 209.18 114.17 209.18L114.17 209.18L114.17 207.17Q117.25 207.46 120.13 207.46L120.13 207.46Q124.16 207.46 127.66 207.12Q131.17 206.78 134.14 206.11L134.14 206.11L134.14 215.04Q135.29 212.45 137.21 210.34Q139.13 208.22 141.63 207.02Q144.13 205.82 147.20 205.82ZM178.01 206.11L178.01 206.11L178.01 247.87Q178.01 251.90 179.41 253.34Q180.80 254.78 184.16 254.78L184.16 254.78L184.16 256.80Q182.43 256.70 178.78 256.56Q175.13 256.42 171.39 256.42L171.39 256.42Q167.65 256.42 163.81 256.56Q159.97 256.70 158.05 256.80L158.05 256.80L158.05 254.78Q161.41 254.78 162.80 253.34Q164.19 251.90 164.19 247.87L164.19 247.87L164.19 217.63Q164.19 213.31 162.89 211.25Q161.60 209.18 158.05 209.18L158.05 209.18L158.05 207.17Q161.12 207.46 164.00 207.46L164.00 207.46Q168.03 207.46 171.53 207.12Q175.04 206.78 178.01 206.11ZM206.81 191.42L206.81 191.42L206.81 207.17L218.14 207.17L218.14 209.09L206.81 209.09L206.81 247.87Q206.81 250.75 207.87 251.95Q208.93 253.15 211.04 253.15L211.04 253.15Q212.77 253.15 214.49 251.86Q216.22 250.56 217.57 247.39L217.57 247.39L219.20 248.26Q217.66 252.58 214.54 255.36Q211.42 258.14 206.05 258.14L206.05 258.14Q202.88 258.14 200.48 257.33Q198.08 256.51 196.45 254.88L196.45 254.88Q194.33 252.77 193.66 249.65Q192.99 246.53 192.99 241.54L192.99 241.54L192.99 209.09L184.93 209.09L184.93 207.17L192.99 207.17L192.99 194.50Q197.02 194.50 200.43 193.78Q203.84 193.06 206.81 191.42ZM239.65 191.42L239.65 191.42L239.65 207.17L250.97 207.17L250.97 209.09L239.65 209.09L239.65 247.87Q239.65 250.75 240.70 251.95Q241.76 253.15 243.87 253.15L243.87 253.15Q245.60 253.15 247.33 251.86Q249.05 250.56 250.40 247.39L250.40 247.39L252.03 248.26Q250.49 252.58 247.37 255.36Q244.25 258.14 238.88 258.14L238.88 258.14Q235.71 258.14 233.31 257.33Q230.91 256.51 229.28 254.88L229.28 254.88Q227.17 252.77 226.49 249.65Q225.82 246.53 225.82 241.54L225.82 241.54L225.82 209.09L217.76 209.09L217.76 207.17L225.82 207.17L225.82 194.50Q229.85 194.50 233.26 193.78Q236.67 193.06 239.65 191.42ZM266.24 257.47L266.24 257.47Q261.92 257.47 259.04 255.84Q256.16 254.21 254.81 251.47Q253.47 248.74 253.47 245.47L253.47 245.47Q253.47 241.34 255.34 238.75Q257.21 236.16 260.19 234.53Q263.17 232.90 266.48 231.84Q269.79 230.78 272.81 229.78Q275.84 228.77 277.71 227.38Q279.58 225.98 279.58 223.78L279.58 223.78L279.58 216.29Q279.58 213.79 278.77 211.82Q277.95 209.86 276.27 208.80Q274.59 207.74 271.90 207.74L271.90 207.74Q269.98 207.74 268.06 208.27Q266.14 208.80 264.89 210.05L264.89 210.05Q267.58 211.01 269.07 212.98Q270.56 214.94 270.56 217.44L270.56 217.44Q270.56 220.70 268.30 222.62Q266.05 224.54 262.97 224.54L262.97 224.54Q259.52 224.54 257.74 222.38Q255.97 220.22 255.97 217.15L255.97 217.15Q255.97 214.37 257.36 212.54Q258.75 210.72 261.25 209.09L261.25 209.09Q263.93 207.55 267.73 206.69Q271.52 205.82 275.93 205.82L275.93 205.82Q280.35 205.82 283.90 206.74Q287.45 207.65 289.85 210.05L289.85 210.05Q292.06 212.26 292.73 215.47Q293.41 218.69 293.41 223.58L293.41 223.58L293.41 249.70Q293.41 252.10 293.89 253.01Q294.37 253.92 295.52 253.92L295.52 253.92Q296.38 253.92 297.20 253.44Q298.01 252.96 298.97 252.29L298.97 252.29L299.93 253.92Q297.92 255.65 295.28 256.56Q292.64 257.47 289.37 257.47L289.37 257.47Q285.82 257.47 283.71 256.46Q281.60 255.46 280.69 253.73Q279.77 252 279.77 249.70L279.77 249.70Q277.47 253.34 274.21 255.41Q270.94 257.47 266.24 257.47ZM273.05 251.33L273.05 251.33Q274.97 251.33 276.56 250.42Q278.14 249.50 279.58 247.39L279.58 247.39L279.58 227.71Q278.72 229.15 277.18 230.30Q275.65 231.46 273.92 232.66Q272.19 233.86 270.61 235.30Q269.02 236.74 268.06 238.85Q267.10 240.96 267.10 243.94L267.10 243.94Q267.10 247.68 268.73 249.50Q270.37 251.33 273.05 251.33Z";

function Wordmark() {
  return (
    <Svg width={WORD_W} height={WORD_H} viewBox="44 184 260 78">
      <Path d={WORD_PATH} fill={IVORY} />
      <Circle cx={171.1} cy={194.26} r={5.76} fill={GOLD} />
    </Svg>
  );
}

export function AnimatedSplash() {
  const { width, height } = useWindowDimensions();
  // Everything is laid out around this point, like the design (36% down).
  const centerY = height * 0.36;

  const ring = useSharedValue(0);
  const glow = useSharedValue(0);
  const bar = useSharedValue(0);

  useEffect(() => {
    ring.value = withRepeat(withTiming(360, { duration: 40000, easing: Easing.linear }), -1);
    glow.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }), -1, true);
    bar.value = withDelay(400, withTiming(1, { duration: SPLASH_MIN_DURATION - 400, easing: Easing.bezier(0.4, 0, 0.2, 1) }));
  }, [ring, glow, bar]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${ring.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.7 + 0.3 * glow.value,
    transform: [{ scale: 0.9 + 0.18 * glow.value }],
  }));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: bar.value }] }));

  const word = useRiseIn(800);
  const tag = useRiseIn(1000);

  const RING = 340;
  const GLOW = 280;

  return (
    <View style={styles.screen}>
      {/* Plum radial sky */}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <RadialGradient id="sky" cx="50%" cy="40%" rx="85%" ry="60%">
            <Stop offset="0" stopColor="#43295F" />
            <Stop offset="0.48" stopColor={PLUM} />
            <Stop offset="1" stopColor="#1A0F26" />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#sky)" />
      </Svg>

      {STARS.map((star, i) => (
        <Star key={i} star={star} width={width} height={height} />
      ))}

      {/* Turning gold orbit with a glowing dot */}
      <Animated.View
        style={[
          styles.ring,
          { width: RING, height: RING, borderRadius: RING / 2, left: width / 2 - RING / 2, top: centerY - RING / 2 },
          ringStyle,
        ]}
      >
        <View style={styles.ringDot} />
      </Animated.View>

      {/* Soft pulsing glow behind the mark */}
      <Animated.View
        style={[{ position: "absolute", left: width / 2 - GLOW / 2, top: centerY - GLOW / 2 }, glowStyle]}
      >
        <Svg width={GLOW} height={GLOW}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={GOLD} stopOpacity={0.26} />
              <Stop offset="0.6" stopColor="#A94C36" stopOpacity={0.08} />
              <Stop offset="1" stopColor="#A94C36" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#glow)" />
        </Svg>
      </Animated.View>

      {/* Mark: centred slightly above the centre point, like the design */}
      <View style={{ position: "absolute", left: width / 2 - MARK_W / 2, top: centerY - MARK_H * 0.56 }}>
        <Mark />
      </View>

      <Animated.View style={[{ position: "absolute", left: width / 2 - WORD_W / 2, top: centerY + 136 }, word]}>
        <Wordmark />
      </Animated.View>

      <Animated.View style={[styles.tagWrap, { top: centerY + 234 }, tag]}>
        <Text style={styles.tag}>Your stars, your path.</Text>
      </Animated.View>

      <View style={styles.loadTrack}>
        <Animated.View style={[styles.loadFill, barStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PLUM,
    overflow: "hidden",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(196,154,74,0.16)",
  },
  ringDot: {
    position: "absolute",
    top: -3,
    left: "50%",
    marginLeft: -2.5,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  tagWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  tag: {
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: 0.7,
    color: "rgba(255,253,252,0.9)",
  },
  loadTrack: {
    position: "absolute",
    left: "50%",
    bottom: 92,
    width: 120,
    height: 2,
    marginLeft: -60,
    borderRadius: 2,
    backgroundColor: "rgba(255,253,252,0.12)",
    overflow: "hidden",
  },
  loadFill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: GOLD,
    transformOrigin: "left",
  },
});
