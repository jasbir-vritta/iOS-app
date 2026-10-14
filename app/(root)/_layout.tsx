import { Stack } from "expo-router";
import { useEffect } from "react";

import {
  registerForPushNotifications,
  useNotificationTaps,
} from "../../lib/notifications";

export default function RootLayout() {
  // Signed in from here on: register this phone for notifications and
  // open the screen a tapped notification points to.
  useEffect(() => {
    registerForPushNotifications();
  }, []);

  useNotificationTaps();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
