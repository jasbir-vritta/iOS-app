import { cssInterop } from "nativewind";
import { Children, forwardRef, isValidElement, ReactNode } from "react";
import { StyleSheet, Text as RNTextType, TextProps } from "react-native";

import { F } from "../auth/theme";

/*
 * Text in the brand font (Plus Jakarta Sans). Each weight is its own font
 * file, so the weight a text asks for (style or Tailwind class) picks the file.
 * Text with its own font (icons, a chosen family) keeps it; plain nested text
 * inherits from its parent.
 *
 * lib/brandFont.ts makes this the app's <Text>, so it renders React Native's
 * own Text, taken before that swap.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RNText: typeof RNTextType = require("react-native/Libraries/Text/Text").default;

const familyFor = (weight: unknown) => {
  const w = weight === "bold" ? 700 : Number(weight) || 400;
  if (w >= 700) return F.bold;
  if (w >= 600) return F.semibold;
  if (w >= 500) return F.medium;
  return F.regular;
};

const SYSTEM_FONTS = /^(System|sans-serif)$/;

// Indian scripts (Devanagari, Bengali, Tamil, Telugu, Kannada, ...): their
// vowel marks (matras) sit above and below the letters and get cut off by
// line heights tuned for English, and negative letter spacing breaks joined
// letters. Such text gets room (1.45x the font size) and normal spacing.
const INDIC = new RegExp(`[${String.fromCharCode(0x0900)}-${String.fromCharCode(0x0dff)}]`); // U+0900 to U+0DFF
const INDIC_LINE = 1.45;

const hasIndic = (children: ReactNode): boolean =>
  Children.toArray(children).some((child) =>
    typeof child === "string"
      ? INDIC.test(child)
      : isValidElement<{ children?: ReactNode }>(child) && hasIndic(child.props.children)
  );

const indicFix = (flat: Record<string, any>) => {
  const fix: Record<string, number> = {};
  const size = typeof flat.fontSize === "number" ? flat.fontSize : 14;
  if (typeof flat.lineHeight === "number" && flat.lineHeight < size * INDIC_LINE) {
    fix.lineHeight = Math.round(size * INDIC_LINE);
  }
  if (typeof flat.letterSpacing === "number" && flat.letterSpacing < 0) fix.letterSpacing = 0;
  return Object.keys(fix).length ? fix : null;
};

export const Text = forwardRef<RNTextType, TextProps>(function BrandText({ style: baseStyle, ...props }, ref) {
  const baseFlat = StyleSheet.flatten(baseStyle) || {};
  const fix = hasIndic(props.children) ? indicFix(baseFlat) : null;
  const style = fix ? [baseStyle, fix] : baseStyle;
  const flat = fix ? { ...baseFlat, ...fix } : baseFlat;
  const ownFont = typeof flat.fontFamily === "string" && !SYSTEM_FONTS.test(flat.fontFamily);
  const styled = flat.fontWeight !== undefined || flat.fontSize !== undefined || flat.fontFamily !== undefined;

  if (ownFont || !styled) {
    return <RNText ref={ref} {...props} style={style} />;
  }

  // The weight is in the font file itself; "normal" stops Android adding fake bold.
  return (
    <RNText
      ref={ref}
      {...props}
      style={[style, { fontFamily: familyFor(flat.fontWeight), fontWeight: "normal" }]}
    />
  );
});
Text.displayName = "Text";

// Tailwind classes (className) reach this component as a style.
cssInterop(Text, { className: "style" });
