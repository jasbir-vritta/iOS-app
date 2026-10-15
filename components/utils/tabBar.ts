import { useSafeAreaInsets } from "react-native-safe-area-context";

// The tab bar floats over the screens (it is translucent), so scrolling
// content needs this much room at the bottom to clear it.
export const TAB_BAR_HEIGHT = 84;

export function useTabBarSpace(extra = 24) {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + insets.bottom + extra;
}
