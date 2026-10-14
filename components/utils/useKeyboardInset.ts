import { useCallback, useEffect, useState } from "react";
import { Keyboard, Platform, type LayoutChangeEvent } from "react-native";

/**
 * Space to leave at the bottom of a screen so the keyboard doesn't cover its
 * input (Android).
 *
 * With edge-to-edge (Expo SDK 57) Android no longer shrinks the window for
 * the keyboard, so KeyboardAvoidingView often has no effect. This adds the
 * keyboard's height as bottom padding — minus however much the window did
 * shrink on its own, so phones that still resize never get a double gap.
 *
 * Usage: <View style={{ flex: 1, paddingBottom: keyboard.padding }} onLayout={keyboard.onLayout}>
 */
export function useKeyboardInset() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [height, setHeight] = useState(0);
  // Tallest the screen has been (keyboard closed).
  const [fullHeight, setFullHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const show = Keyboard.addListener("keyboardDidShow", (event) =>
      setKeyboardHeight(event.endCoordinates.height)
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const h = event.nativeEvent.layout.height;
    setFullHeight((full) => Math.max(full, h));
    setHeight(h);
  }, []);

  // How much the system already resized the window for the keyboard.
  const systemShrink = Math.max(0, fullHeight - height);
  const padding = keyboardHeight > 0 ? Math.max(0, keyboardHeight - systemShrink) : 0;

  return {
    /** Bottom padding to apply to the screen's root view. */
    padding,
    /** Pass to the same root view's onLayout. */
    onLayout,
    /** True while the keyboard is open (any platform handling). */
    open: keyboardHeight > 0,
  };
}
