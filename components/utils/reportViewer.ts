import { TurboModuleRegistry } from "react-native";

/**
 * True when this build includes react-native-webview (the in-app report
 * viewer). Older builds don't, and loading the package there would throw,
 * so they keep opening reports in the browser sheet.
 */
export function hasInAppViewer(): boolean {
  try {
    return TurboModuleRegistry.get("RNCWebViewModule") != null;
  } catch {
    return false;
  }
}
