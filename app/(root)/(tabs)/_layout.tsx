import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Slot, router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


const BACKGROUND = "#F7F1E8";

const COLORS = {
  BAR: "#FFFDFC",
  BAR_EDGE: "#FFFDFC",
  ACTIVE_BG: "#9B3F1F",
  ACTIVE_ICON: "#FFFFFF",
  ACTIVE_LABEL: "#9B3F1F",
  INACTIVE: "#68616A",
};

const tabs = [
  {
    label: "My Vritta",
    route: "/(root)/(tabs)/my_life",
    match: "my_life",
    icon: "flower-outline",
  },
  {
    label: "Chat",
    route: "/(root)/(tabs)/chat",
    match: "chat",
    icon: "chat-outline",
  },
  {
    label: "Home",
    route: "/(root)/(tabs)",
    match: "index",
    icon: "home-outline",
  },
  {
    label: "Reports",
    route: "/(root)/(tabs)/reports",
    match: "reports",
    icon: "file-chart-outline",
  },
  {
    label: "Mantra",
    route: "/(root)/(tabs)/mantra",
    match: "mantra",
    icon: "meditation",
  },
];

function CustomTabBar() {
  const pathname = usePathname();
  // Android draws edge-to-edge (and iPhones have a home indicator): keep the
  // tabs above the system navigation bar.
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: COLORS.BAR,
          borderColor: COLORS.BAR_EDGE,
          paddingBottom: 8 + insets.bottom,
        },
      ]}
    >
      <View
        style={{
          height: 68,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {tabs.map((tab) => {
          const active =
            tab.match === "index"
              ? pathname === "/(root)/(tabs)" ||
                pathname === "/"
              : pathname.includes(tab.match);

          return (
            <Pressable
              key={tab.label}
              onPress={() =>
                router.replace(tab.route as any)
              }
              style={{
                flex: 1,
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Icon. The active circle is its own element (not a toggled
                  background colour), with fixed StyleSheet styles, so its
                  rounded shape survives re-renders after a tab press. */}
              <View style={styles.iconWrap}>
                {active && <View style={[styles.activeCircle, { backgroundColor: COLORS.ACTIVE_BG }]} />}
                <MaterialCommunityIcons
                  name={tab.icon as any}
                  size={23}
                  color={
                    active
                      ? COLORS.ACTIVE_ICON
                      : COLORS.INACTIVE
                  }
                />
              </View>

              {/* Label */}
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 15,
                  color: active
                    ? COLORS.ACTIVE_LABEL
                    : COLORS.INACTIVE,
                  fontWeight: active
                    ? "700"
                    : "500",
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: BACKGROUND,
      }}
    >
      <Slot />

      {/* Floats over the screen; screens leave room via useTabBarSpace(). */}
      <CustomTabBar />
    </View>
  );
}

const ICON_SIZE = 38;

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: "hidden",
    paddingTop: 8,
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 8,
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  activeCircle: {
    position: "absolute",
    top: 0,
    left: 0,
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    overflow: "hidden",
  },
});
