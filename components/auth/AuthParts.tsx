import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { AUTH, F } from "./theme";

/**
 * Building blocks of the login design, shared by its four screens.
 * Pressable styles are plain arrays, not ({ pressed }) => functions: the
 * function form was dropped on iOS (NativeWind wraps Pressable).
 */

export function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

export function AppleIcon({ size = 20, color = AUTH.bg }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M16.37 1.43c0 1.14-.5 2.27-1.18 3.08-.74.9-1.99 1.57-2.99 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.57-2.27 1.21-2.98.8-.94 2.14-1.64 3.25-1.68.03.13.05.28.05.43zm4.56 15.71c-.03.07-.46 1.58-1.52 3.12-.94 1.34-1.94 2.71-3.43 2.71-1.52 0-1.9-.88-3.63-.88-1.7 0-2.3.91-3.67.91-1.38 0-2.33-1.26-3.43-2.8-1.29-1.82-2.32-4.63-2.32-7.28 0-4.28 2.8-6.55 5.55-6.55 1.45 0 2.68.95 3.6.95.87 0 2.22-1.01 3.9-1.01.61 0 2.89.06 4.37 2.19-.13.09-2.38 1.37-2.38 4.19 0 3.26 2.85 4.42 2.96 4.45z"
      />
    </Svg>
  );
}

export function PhoneIcon({ size = 20, color = AUTH.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={6} y={2.5} width={12} height={19} rx={3} />
      <Path d="M10.5 18.5h3" />
    </Svg>
  );
}

export function MailIcon({ size = 20, color = AUTH.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={5} width={18} height={14} rx={3} />
      <Path d="M4 7l8 6 8-6" />
    </Svg>
  );
}

/** Show / hide password: an eye, struck through while hidden. */
export function EyeIcon({ open, color = AUTH.muted }: { open: boolean; color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      {!open && <Path d="M4 4l16 16" />}
    </Svg>
  );
}

export function LockIcon({ size = 14, color = AUTH.gold }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={size > 16 ? 1.8 : 2}>
      <Rect x={5} y={11} width={14} height={10} rx={2} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

export function ChevronDown({ color = AUTH.text }: { color?: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4}>
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

// Light sign-in steps (phone, email, code): the app's lavender look.
export const LIGHT = {
  bg: "#F4F0F8",
  card: "#FFFDFC",
  ink: "#1C1820",
  plum: "#2B1A3D",
  gold: "#C49A4A",
  muted: "#68616A",
  line: "rgba(217,206,193,0.9)",
  soft: "#EFE8F7",
  placeholder: "#9A929D",
  error: "#B3392F",
  success: "#2E7D4F",
};

export function BackButton({ onPress, light = false }: { onPress: () => void; light?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.back, light && styles.backLight]} accessibilityLabel="Back">
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={light ? LIGHT.ink : AUTH.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
      </Svg>
    </Pressable>
  );
}

/** "Step 1 of 2" bars on the phone and code screens. */
export function Steps({ done, light = false }: { done: number; light?: boolean }) {
  return (
    <View style={styles.steps}>
      {[1, 2].map((n) => (
        <View
          key={n}
          style={[styles.stepBar, light && styles.stepBarLight, n <= done && (light ? styles.stepOnLight : styles.stepOn)]}
        />
      ))}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  busy?: boolean;
  // Light sign-in steps: a plum pill instead of the gold one.
  light?: boolean;
};

/** Ivory pill: the main sign-in option on the welcome sheet. */
export function SolidButton({ label, onPress, icon, disabled }: ButtonProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.btn, styles.solid, disabled && styles.disabled]}>
      {icon}
      <Text style={[styles.btnText, { color: AUTH.bg }]}>{label}</Text>
    </Pressable>
  );
}

/** Frosted pill with a light border: the other sign-in options. */
export function GlassButton({ label, onPress, icon, disabled }: ButtonProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.btn, styles.glass, disabled && styles.disabled]}>
      {icon}
      <Text style={[styles.btnText, { color: AUTH.text }]}>{label}</Text>
    </Pressable>
  );
}

/** Gold call to action at the bottom of the phone and code screens. */
export function GoldButton({ label, onPress, disabled, busy, light }: ButtonProps) {
  if (light) {
    return (
      <Pressable onPress={onPress} disabled={disabled || busy} style={[styles.plum, (disabled || busy) && styles.disabled]}>
        {busy ? (
          <ActivityIndicator color={LIGHT.card} />
        ) : (
          <Text style={[styles.btnText, { color: LIGHT.card }]}>{label}</Text>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={disabled || busy} style={[styles.goldWrap, (disabled || busy) && styles.disabled]}>
      <LinearGradient colors={[AUTH.goldTop, AUTH.goldBottom]} style={styles.gold}>
        {busy ? (
          <ActivityIndicator color={AUTH.onGold} />
        ) : (
          <Text style={[styles.btnText, { color: AUTH.onGold }]}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  backLight: {
    width: 40,
    height: 40,
    marginLeft: 0,
    borderRadius: 20,
    backgroundColor: LIGHT.card,
    borderWidth: 1,
    borderColor: LIGHT.line,
  },
  steps: { flexDirection: "row", gap: 6, marginTop: 14 },
  stepBar: { width: 28, height: 3, borderRadius: 2, backgroundColor: "rgba(244,238,230,0.18)" },
  stepOn: { backgroundColor: AUTH.gold },
  stepBarLight: { backgroundColor: "rgba(43,26,61,0.12)" },
  stepOnLight: { backgroundColor: LIGHT.plum },
  btn: { height: 52, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  solid: { backgroundColor: AUTH.text },
  glass: { backgroundColor: AUTH.glass, borderWidth: 1, borderColor: AUTH.glassBorder },
  btnText: { fontFamily: F.semibold, fontSize: 15 },
  goldWrap: {
    borderRadius: 999,
    shadowColor: AUTH.gold,
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  gold: { height: 56, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  plum: {
    height: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LIGHT.plum,
  },
  disabled: { opacity: 0.5 },
});
