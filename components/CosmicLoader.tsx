import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";

import { VrittaLogo } from "./auth/VrittaLogo";

const PLUM = "#2B1A3D";
const GOLD = "#C49A4A";
const LAVENDER = "#EFE8F7";

/**
 * Loading animation in the app's style: the Vritta mark in a Deep Plum orb,
 * with two fine orbits and small planets circling it.
 */
export default function CosmicLoader({ size = 140 }: { size?: number }) {
  const [spin] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let loops: Animated.CompositeAnimation[] = [];
    let cancelled = false;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loops = [
        Animated.loop(
          Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        ),
      ];
      loops.forEach((loop) => loop.start());
    });

    return () => {
      cancelled = true;
      loops.forEach((loop) => loop.stop());
    };
  }, [spin, pulse]);

  const outer = size;
  const inner = size * 0.7;
  const orb = size * 0.42;

  const turn = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const turnBack = spin.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  const ring = (d: number) => ({ width: d, height: d, borderRadius: d / 2 });

  return (
    <View style={{ width: outer, height: outer, alignItems: "center", justifyContent: "center" }}>
      {/* Soft halo */}
      <Animated.View
        style={[s.halo, ring(orb * 1.7), { opacity: haloOpacity, transform: [{ scale: glow }] }]}
      />

      {/* Outer orbit with a gold planet */}
      <Animated.View style={[s.orbit, ring(outer), { transform: [{ rotate: turn }] }]}>
        <View style={[s.planet, { top: -5, left: outer / 2 - 5, width: 10, height: 10, backgroundColor: GOLD }]} />
        <View style={[s.planet, { bottom: outer * 0.14, left: outer * 0.08, width: 5, height: 5, backgroundColor: PLUM, opacity: 0.4 }]} />
      </Animated.View>

      {/* Inner orbit, turning the other way */}
      <Animated.View style={[s.orbit, s.innerOrbit, ring(inner), { transform: [{ rotate: turnBack }] }]}>
        <View style={[s.planet, { bottom: -4, left: inner / 2 - 4, width: 8, height: 8, backgroundColor: PLUM }]} />
      </Animated.View>

      {/* Vritta mark */}
      <Animated.View style={[s.orb, ring(orb), { transform: [{ scale: glow }] }]}>
        <VrittaLogo size={orb * 0.5} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  halo: { position: "absolute", backgroundColor: LAVENDER },
  orbit: { position: "absolute", borderWidth: 1, borderColor: "rgba(43,26,61,0.18)" },
  innerOrbit: { borderStyle: "dashed", borderColor: "rgba(43,26,61,0.22)" },
  planet: { position: "absolute", borderRadius: 999 },
  orb: {
    backgroundColor: PLUM,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PLUM,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
