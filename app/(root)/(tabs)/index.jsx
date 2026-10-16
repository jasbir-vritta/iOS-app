import { useFonts } from "expo-font";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AUTH_FONTS } from "../../../components/auth/theme";
import ContinueYourJourney from "../../../components/home/ContinueYourJourney";
import DailyGuidance from "../../../components/home/DailyGuidance";
import { C, F, HOME_PAD } from "../../../components/home/homeUi";
import RecommendedReports from "../../../components/home/RecommendedReports";
import VerifiedAstrologers from "../../../components/home/VerifiedAstrologers";
import YourLifeToday from "../../../components/home/YourLifeToday";
import useProfilesStore from "../../../components/stores/profilesStore";
import { useUserStore } from "../../../components/stores/userStore";
import TopBar from "../../../components/TopBar";
import { useScreenTime } from "../../../lib/analytics";
import { useTabBarSpace } from "../../../components/utils/tabBar";

// "Good morning" etc. by the IST hour (same as My Life).
const greeting = () => {
  const hour = Math.floor((Date.now() / 3600000 + 5.5) % 24);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

// Sections rise in one after another.
const enter = (index) => FadeInDown.delay(70 * index).duration(420);

export default function Home() {
  // Analytics: visited_home + home_time_spent.
  useScreenTime("home");

  const tabSpace = useTabBarSpace();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts(AUTH_FONTS);

  const activeProfileId = useUserStore((state) => state.user?.active_profile_id);
  const profileName = useProfilesStore(
    (state) => state.profiles.find((p) => p.profile_id === activeProfileId)?.name
  );
  const firstName = String(profileName || "").trim().split(/\s+/)[0];

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: HOME_PAD,
          paddingTop: insets.top + 4,
          paddingBottom: tabSpace + 12,
        }}
      >
        <TopBar />

        {/* Brand fonts first, so text doesn't jump from the system font. */}
        {fontsLoaded && (
          <>
            <Reanimated.View entering={enter(0)}>
              <Text style={styles.greeting} numberOfLines={1}>
                {greeting()}
                {firstName ? `, ${firstName}` : ""}
              </Text>
              <Text style={styles.greetingSub}>Here’s what the stars hold for you today</Text>
            </Reanimated.View>

            <Reanimated.View entering={enter(1)}>
              <DailyGuidance />
            </Reanimated.View>
            <Reanimated.View entering={enter(2)}>
              <YourLifeToday />
            </Reanimated.View>
            <Reanimated.View entering={enter(3)}>
              <ContinueYourJourney />
            </Reanimated.View>
            <Reanimated.View entering={enter(4)}>
              <VerifiedAstrologers />
            </Reanimated.View>
            <Reanimated.View entering={enter(5)}>
              <RecommendedReports />
            </Reanimated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.LAVENDER },
  greeting: { marginTop: 14, color: C.INK, fontSize: 24, fontFamily: F.bold, letterSpacing: -0.4 },
  greetingSub: { marginTop: 2, marginBottom: 14, color: C.MUTED, fontSize: 13.5, fontFamily: F.regular },
});
