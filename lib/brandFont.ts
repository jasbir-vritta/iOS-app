/*
 * Plus Jakarta Sans everywhere: `Text` from "react-native" becomes BrandText,
 * which picks the font file for each text's weight. Imported first thing in
 * app/_layout.tsx; the fonts load there too.
 */
import { Text as BrandText } from "../components/ui/BrandText";

// react-native's exports are getters on a plain object, so `Text` can be
// redefined (its own module's export can't). If that ever fails, the app
// simply keeps the system font.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactNative = require("react-native");
  if (ReactNative.Text !== BrandText) {
    Object.defineProperty(ReactNative, "Text", {
      configurable: true,
      enumerable: true,
      get: () => BrandText,
    });
  }
} catch (error) {
  console.warn("Brand font: keeping the system font.", error);
}
