
import { useEffect } from "react";
import {
  Dimensions,
  ScrollView,
  View
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import TopBar from "../../../components/TopBar";
import { getAccessToken } from "../../../lib/auth";



import {
  getMyLifeCache,
  useMyLifeStore,
} from "../../../components/stores/myLifeStore";
import { useUserStore } from "../../../components/stores/userStore";

import DailyGuidance from "../../../components/home/DailyGuidance";
import RecommendedReports from "../../../components/home/RecommendedReports";
import VerifiedAstrologers from "../../../components/home/VerifiedAstrologers";
import YourLifeToday from "../../../components/home/YourLifeToday";
import ContinueYourJourney from "../../../components/home/ContinueYourJourney"
import { useTabBarSpace } from "../../../components/utils/tabBar";


export default function Home() {
  const tabSpace = useTabBarSpace();
  useEffect(() => {
    const logToken = async () => {
      const token = await getAccessToken();
      console.log("ACCESS TOKEN:", token);
    };

    logToken();
  }, []);


  const { user } = useUserStore();
const activeProfileId = user?.active_profile_id;

const today = useMyLifeStore((state) =>
  activeProfileId
    ? state.profiles[activeProfileId]?.daily
    : null
);

useEffect(() => {
  if (!activeProfileId || today) return;

  let cancelled = false;

  const loadCachedToday = async () => {
    const cachedToday = await getMyLifeCache(
      "daily",
      activeProfileId
    );

    if (cancelled) return;

    if (cachedToday) {
      console.log("Home: Today loaded from cache");
    } else {
      console.log("Home: Today cache is empty");
    }
  };

  loadCachedToday();

  return () => {
    cancelled = true;
  };
}, [activeProfileId, today]);

  const insets = useSafeAreaInsets();

  const C = {
    INK: "#1C1820",
    PLUM: "#2B1A3D",
    TERRACOTTA: "#A94C36",
    GOLD: "#C49A4A",
    BG: "#F4F0F8",
    CARD: "#FFFDFC",
    MUTED: "#68616A",
    BORDER: "#D9CEC1",
    CHIP: "#F7F1E8",
    GLASS: "rgba(255,253,252,0.88)",
  };

  const K =
    Math.min(Dimensions.get("window").width, 430) / 853;

  const px = (n: number) =>
    Math.round(n * K * 100) / 100;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.BG,
      }}
    >
     <ScrollView
  showsVerticalScrollIndicator={false}
  contentContainerStyle={{
    paddingHorizontal: px(16),
    paddingTop: insets.top + 4,
    paddingBottom: tabSpace,
  }}
>
  <TopBar />

  <DailyGuidance />
  <YourLifeToday />
  <ContinueYourJourney/>
<VerifiedAstrologers />
<RecommendedReports />
  {/* Other Home components */}
</ScrollView>
    </View>
  );
}
