import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, G, Line, RadialGradient, Rect, Stop } from "react-native-svg";

import { AUTH } from "./theme";

/**
 * Night sky from the login design: gradient, nebula glows, twinkling stars
 * and (on the welcome screens) a slowly turning zodiac wheel and a planet.
 */

// Stable "random" star positions (same sky every render).
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = { x: number; y: number; r: number; gold: boolean };

const STAR_GROUPS = 3;
const STARS_PER_GROUP = 42;

function makeStars(width: number, height: number, group: number): Star[] {
  const rand = seeded(1234 + group * 97);
  return Array.from({ length: STARS_PER_GROUP }, () => ({
    x: rand() * width,
    y: rand() * height,
    r: rand() < 0.12 ? rand() * 1.2 + 1 : rand() * 0.8 + 0.3,
    gold: rand() < 0.15,
  }));
}

// One group of stars fading in and out together, each group out of step.
const StarGroup = memo(function StarGroup({
  width,
  height,
  group,
  still,
}: {
  width: number;
  height: number;
  group: number;
  still: boolean;
}) {
  const stars = useMemo(() => makeStars(width, height, group), [width, height, group]);
  const opacity = useSharedValue(0.9);

  useEffect(() => {
    if (still) return;
    const duration = 1800 + group * 700;
    opacity.value = withDelay(
      group * 600,
      withRepeat(
        withSequence(
          withTiming(0.35, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    );
  }, [group, opacity, still]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width={width} height={height}>
        {stars.map((s, i) => (
          <G key={i}>
            <Circle cx={s.x} cy={s.y} r={s.r} fill={s.gold ? AUTH.goldLight : "#FFF8EE"} />
            {s.r > 1.4 && (
              <>
                <Rect x={s.x - s.r * 3} y={s.y - 0.4} width={s.r * 6} height={0.8} fill="#FFF8EE" opacity={0.35} />
                <Rect x={s.x - 0.4} y={s.y - s.r * 3} width={0.8} height={s.r * 6} fill="#FFF8EE" opacity={0.35} />
              </>
            )}
          </G>
        ))}
      </Svg>
    </Animated.View>
  );
});

// Zodiac wheel: rings, 72 ticks (long every 30°) and 12 gold dots.
const WHEEL = 410;
const C = WHEEL / 2;
const point = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
};

const Wheel = memo(function Wheel() {
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const long = i % 6 === 0;
    const a = point(i * 5, 203);
    const b = point(i * 5, long ? 189 : 197);
    return <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
  });

  const dots = Array.from({ length: 12 }, (_, k) => {
    const p = point(15 + k * 30, 171);
    return <Circle key={k} cx={p.x} cy={p.y} r={k % 3 === 0 ? 2.6 : 1.4} />;
  });

  return (
    <Svg width={WHEEL} height={WHEEL}>
      <G stroke="rgba(217,178,106,0.55)" strokeWidth={1} fill="none">
        <Circle cx={C} cy={C} r={203} />
        <Circle cx={C} cy={C} r={185} stroke="rgba(217,178,106,0.25)" />
        <Circle cx={C} cy={C} r={157} stroke="rgba(244,238,230,0.12)" strokeDasharray="2 6" />
        {ticks}
      </G>
      <G fill={AUTH.gold}>{dots}</G>
    </Svg>
  );
});

function Planet() {
  return (
    <View style={styles.planet} pointerEvents="none">
      <Svg width={130} height={130}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={AUTH.gold} stopOpacity={0.45} />
            <Stop offset="1" stopColor={AUTH.gold} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="ball" cx="34%" cy="30%" r="70%" fx="34%" fy="30%">
            <Stop offset="0" stopColor="#FFF4DC" />
            <Stop offset="0.35" stopColor="#E8C383" />
            <Stop offset="0.75" stopColor="#9A6B2C" />
            <Stop offset="1" stopColor="#4A3014" />
          </RadialGradient>
        </Defs>
        <Circle cx={65} cy={65} r={65} fill="url(#glow)" />
        <Circle cx={65} cy={65} r={29} fill="url(#ball)" />
      </Svg>
    </View>
  );
}

export function CosmicBackground({
  art = false,
  planet = true,
}: {
  art?: boolean;
  // Hide the planet where it would sit on top of content.
  planet?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const still = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (!art || still) return;
    // 2.5° a second, as in the design: one turn in 144 s.
    turn.value = withRepeat(withTiming(360, { duration: 144000, easing: Easing.linear }), -1);
  }, [art, still, turn]);

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value}deg` }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[AUTH.bgTop, AUTH.bg, AUTH.bgBottom]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Nebula glows */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {[
            ["n1", "rgb(110,60,170)", 0.42],
            ["n2", "rgb(217,150,80)", 0.2],
            ["n3", "rgb(80,40,140)", 0.35],
          ].map(([id, color, alpha]) => (
            <RadialGradient key={id as string} id={id as string} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color as string} stopOpacity={alpha as number} />
              <Stop offset="1" stopColor={color as string} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        <Circle cx={width * 0.2} cy={height * 0.18} r={260} fill="url(#n1)" />
        <Circle cx={width * 0.85} cy={height * 0.42} r={230} fill="url(#n2)" />
        <Circle cx={width * 0.35} cy={height * 0.78} r={280} fill="url(#n3)" />
      </Svg>

      {Array.from({ length: STAR_GROUPS }, (_, g) => (
        <StarGroup key={g} width={width} height={height} group={g} still={Boolean(still)} />
      ))}

      {art && (
        <>
          <Animated.View style={[styles.wheel, { left: (width - WHEEL) / 2 }, wheelStyle]}>
            <Wheel />
          </Animated.View>
          {planet && <Planet />}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: { position: "absolute", top: -150, width: WHEEL, height: WHEEL },
  // 58 px planet at right 46 / top 120 in the design (plus its glow).
  planet: { position: "absolute", right: 46 - 36, top: 120 - 36 },
});
