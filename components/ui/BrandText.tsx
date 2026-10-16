import { cssInterop } from "nativewind";
import { forwardRef } from "react";
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

export const Text = forwardRef<RNTextType, TextProps>(function BrandText({ style, ...props }, ref) {
  const flat = StyleSheet.flatten(style) || {};
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
