import { Stack } from "expo-router";
import { useEffect } from "react";

import NotificationNudge from "../../components/notifications/NotificationNudge";
import {
  registerForPushNotifications,
  useNotificationTaps,
} from "../../lib/notifications";

export default function RootLayout() {
  // Signed in from here on: register this phone for notifications (the
  // phone's own "Allow notifications?" prompt shows once) and open the
  // screen a tapped notification points to.
  useEffect(() => {
    registerForPushNotifications({ ask: true });
  }, []);

  useNotificationTaps();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
      {/* Reminder once a day while notifications aren't allowed */}
      <NotificationNudge />
    </>
  );
}
