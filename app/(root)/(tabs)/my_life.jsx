import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_NAME } from "../../../components/constants/app";
import {
  getMyLifeCache,
  saveMyLifeCache,
} from "../../../components/stores/myLifeStore";
import useProfilesStore from "../../../components/stores/profilesStore";
import { useRewardsStore } from "../../../components/stores/rewardsStore";
import { useUserStore } from "../../../components/stores/userStore";
import { hasBirthDetails } from "../../../components/utils/birthDetails";
import { API_URL, authHeaders } from "../../../lib/auth";

const BG = "#F8F6FC";
const CARD = "#FFFFFF";
const TEXT = "#292333";
const MUTED = "#292333";
const ORANGE = "#B94A2F";
const PURPLE = "#4A285E";
const BORDER = "#E8E2EC";

const TAB = {
  Past: { icon: "🌱", active: "#4A285E" },
  Today: { icon: "☀️", active: ORANGE },
  Future: { icon: "🔮", active: "#4A285E" },
};

const AREAS = [
  { key: "love", label: "Love", icon: "❤️" },
  { key: "career", label: "Career", icon: "💼" },
  { key: "money", label: "Money", icon: "🪙" },
  { key: "health", label: "Health", icon: "🌿" },
];

const STATUS_COLOR = {
  Favourable: "#278447",
  Neutral: "#D9822B",
  Challenging: "#D84E3D",
};

const STATUS_BG = {
  Favourable: "#E3F4E7",
  Neutral: "#FFF0DD",
  Challenging: "#FCE4E0",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PAST_IMAGES = [
  require("../../../assets/images/my_life/my_life_past_1.png"),
  require("../../../assets/images/my_life/my_life_past_2.png"),
  require("../../../assets/images/my_life/my_life_past_3.png"),
  require("../../../assets/images/my_life/my_life_past_4.png"),
];

const TODAY_MOON_IMAGE_BASE =
  "https://storage.googleapis.com/vritta/astrology/my_life_today";


  const FUTURE_IMAGE_BASE =
  "https://storage.googleapis.com/vritta/astrology/future";

const getFutureImage = (phaseName: string) => {
  const key = String(phaseName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  const validPhases = [
    "sun",
    "moon",
    "mars",
    "mercury",
    "jupiter",
    "venus",
    "saturn",
    "rahu",
    "ketu",
  ];

  if (!validPhases.includes(key)) {
    return require("../../../assets/images/my_life/my_life_future_top.png");
  }

  return {
    uri: `${FUTURE_IMAGE_BASE}/${key}.jpg`,
  };
};


const getTodayMoonImage = (moonSign: string) => {
  const key = String(moonSign || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  const validSigns = [
    "aries",
    "taurus",
    "gemini",
    "cancer",
    "leo",
    "virgo",
    "libra",
    "scorpio",
    "sagittarius",
    "capricorn",
    "aquarius",
    "pisces",
  ];

  if (!validSigns.includes(key)) {
    return require("../../../assets/images/my_life/my_life_today_top.png");
  }

  return {
    uri: `${TODAY_MOON_IMAGE_BASE}/${key}.jpg`,
  };
};



const toText = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    return toText(value.description ?? value.text ?? value.name ?? value.title ?? value.details ?? value.tithi_name);
  }
  return "";
};

const toList = (value) =>
  Array.isArray(value) ? value.map(toText).filter(Boolean) : toText(value).split("\n").filter(Boolean);

const normalizeStatus = (value) => {
  const text = toText(value).toLowerCase();
  if (/challeng|watch|avoid|unfavo|difficult|bad|negative/.test(text)) return "Challenging";
  if (/favo|good|excellent|positive|great/.test(text)) return "Favourable";
  return "Neutral";
};

const formatDate = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return toText(value);
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} '${match[1].slice(2)}`;
};

const calculateAge = (dateOfBirth, dateString) => {
  if (!dateOfBirth || !dateString) return null;

  const [birthDay, birthMonth, birthYear] =
    dateOfBirth.split("/").map(Number);

  const [year, month, day] =
    dateString.split("-").map(Number);

  if (
    !birthDay ||
    !birthMonth ||
    !birthYear ||
    !year ||
    !month ||
    !day
  ) {
    return null;
  }

  let age = year - birthYear;

  const birthdayHasPassed =
    month > birthMonth ||
    (month === birthMonth && day >= birthDay);

  if (!birthdayHasPassed) {
    age -= 1;
  }

  return age;
};


const ageLabel = (row, profile) => {
  if (!profile?.dateOfBirth || !row?.start) {
    return "";
  }

  const startAge = calculateAge(
    profile.dateOfBirth,
    row.start
  );

  const endAge = calculateAge(
    profile.dateOfBirth,
    row.end || row.start
  );

  if (startAge === null) {
    return "";
  }

  if (
    endAge === null ||
    startAge === endAge
  ) {
    return `Age ${startAge}`;
  }

  return `Age ${startAge}–${endAge}`;
};

function areaData(today) {
  return AREAS.map((area) => {
    const raw = today?.life_areas?.[area.key] || {};
    return {
      ...area,
      status: normalizeStatus(raw.status),
      title: toText(raw.title) || `${area.label} today`,
      description: toText(raw.description || raw.text),
    };
  });
}

export default function MyLife() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("Today");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  const completeInsightReward = useRewardsStore(
  (state) => state.completeInsightReward
);




useFocusEffect(
  useCallback(() => {
    const timer = setTimeout(() => {
      completeInsightReward();
    }, 60_000);

    return () => {
      clearTimeout(timer);
    };
  }, [completeInsightReward])
);




  const user = useUserStore(
  (state) => state.user
);

const profiles = useProfilesStore(
  (state) => state.profiles
);

const activeProfileId = user?.active_profile_id;

const activeProfile = profiles.find(
  (profile) =>
    profile.profile_id === activeProfileId
);

  // Profiles without a birth place/time can't be calculated: ask to complete them.
  const needsBirthDetails =
    Boolean(activeProfile) && !hasBirthDetails(activeProfile);

  useEffect(() => {
  if (!activeProfileId || needsBirthDetails) {
    return;
  }

  loadMyLife();
}, [activeProfileId, needsBirthDetails]);

  const loadMyLife = async () => {
  if (!activeProfileId) {
    setError("No active profile found.");
    setLoading(false);
    return;
  }

  try {
    setLoading(true);
    setError("");

    /*
     * ---------------------------------------------------------
     * 1. CHECK CACHE
     * ---------------------------------------------------------
     */

    const [cachedToday, cachedPast, cachedFuture] =
      await Promise.all([
        getMyLifeCache("today", activeProfileId),
        getMyLifeCache("past", activeProfileId),
        getMyLifeCache("future", activeProfileId),
      ]);

    /*
     * ---------------------------------------------------------
     * 2. USE PROFILE STORE FOR PROFILE DATA
     * ---------------------------------------------------------
     */

    const profile =
      activeProfile || {};

    /*
     * ---------------------------------------------------------
     * 3. IF EVERYTHING IS CACHED
     *    NO API CALLS
     * ---------------------------------------------------------
     */

    if (
      cachedToday &&
      cachedPast &&
      cachedFuture
    ) {
      console.log(
        "MY LIFE: Using cached data",
        activeProfileId
      );

      setData({
        profile,
        today: cachedToday,
        past: cachedPast,
        future: cachedFuture,
      });

      return;
    }

    /*
     * ---------------------------------------------------------
     * 4. ONLY FETCH WHAT IS MISSING / EXPIRED
     * ---------------------------------------------------------
     */

    const headers = await authHeaders();

    const requests: Promise<Response | null>[] = [
      cachedToday
        ? Promise.resolve(null)
        : fetch(
            `${API_URL}/astrology/mylife/today?profile_id=${encodeURIComponent(activeProfileId)}`,
            {
              method: "POST",
              headers,
            }
          ),

      cachedPast
        ? Promise.resolve(null)
        : fetch(
            `${API_URL}/astrology/mylife/past?profile_id=${encodeURIComponent(activeProfileId)}`,
            {
              method: "POST",
              headers,
            }
          ),

      cachedFuture
        ? Promise.resolve(null)
        : fetch(
            `${API_URL}/astrology/mylife/future?profile_id=${encodeURIComponent(activeProfileId)}`,
            {
              method: "POST",
              headers,
            }
          ),
    ];

    const [
      todayRes,
      pastRes,
      futureRes,
    ] = await Promise.all(requests);

    /*
     * ---------------------------------------------------------
     * 5. PARSE ONLY API RESPONSES THAT WERE NEEDED
     * ---------------------------------------------------------
     */

    const parseResponse = async (
      res: Response | null
    ) => {
      if (!res) {
        return null;
      }

      const raw = await res.text();

      let json = null;

      try {
        json = JSON.parse(raw);
      } catch {
        json = null;
      }

      if (!res.ok) {
        throw new Error(
          json?.detail ||
            `My ${APP_NAME} failed to load (status ${res.status})`
        );
      }

      return json;
    };

    const [
      todayJson,
      pastJson,
      futureJson,
    ] = await Promise.all([
      parseResponse(todayRes),
      parseResponse(pastRes),
      parseResponse(futureRes),
    ]);

    /*
     * ---------------------------------------------------------
     * 6. GET FRESH DATA OR KEEP CACHE
     * ---------------------------------------------------------
     */

    const today =
      cachedToday ||
      todayJson?.today ||
      {};

    const past =
  cachedPast ||
  pastJson?.past ||
  {};

const future =
  cachedFuture ||
  futureJson?.future ||
  {};

    /*
     * ---------------------------------------------------------
     * 7. SAVE NEW DATA TO CACHE
     * ---------------------------------------------------------
     */

    await Promise.all([
      !cachedToday && today
        ? saveMyLifeCache(
            "today",
            activeProfileId,
            today
          )
        : Promise.resolve(),

      !cachedPast && past
        ? saveMyLifeCache(
            "past",
            activeProfileId,
            past
          )
        : Promise.resolve(),

      !cachedFuture && future
        ? saveMyLifeCache(
            "future",
            activeProfileId,
            future
          )
        : Promise.resolve(),
    ]);

    /*
     * ---------------------------------------------------------
     * 8. UPDATE SCREEN
     * ---------------------------------------------------------
     */

    setData({
      profile:
        todayJson?.profile ||
        pastJson?.profile ||
        futureJson?.profile ||
        profile,

      today,
      past,
      future,
    });

    console.log(
      "MY LIFE: Fresh data loaded and cached",
      activeProfileId
    );
  } catch (err) {
    console.error(
      "MY LIFE ERROR:",
      err
    );

    setError(
      err?.message ||
        `Unable to load My ${APP_NAME}. Please try again.`
    );
  } finally {
    setLoading(false);
  }
};

  const share = async () => {
    try {
      await Share.share({
        message: [
          `My ${APP_NAME}`,
          data?.profile?.name && `Name: ${data.profile.name}`,
          data?.profile?.dateOfBirth && `DOB: ${data.profile.dateOfBirth}`,
          data?.today?.moon_sign && `Moon Sign: ${data.today.moon_sign}`,
        ].filter(Boolean).join("\n"),
      });
    } catch (err) {
      console.log("SHARE ERROR", err);
    }
  };

  if (needsBirthDetails) {
    return (
      <View style={[styles.center, { backgroundColor: BG }]}>
        <Text style={styles.errorTitle}>Complete birth details</Text>
        <Text style={styles.errorText}>
          Add the birth date, time and place for {activeProfile?.name || "this profile"} to see My {APP_NAME}.
        </Text>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/profile/edit_profile",
              params: { profileId: activeProfileId },
            })
          }
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Complete Profile</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, backgroundColor: BG }]}>
        <ActivityIndicator size="large" color={ORANGE} />
        <Text style={styles.loadingText}>Preparing My {APP_NAME}...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: BG }]}>
        <Text style={styles.errorTitle}>Unable to load My {APP_NAME}</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={loadMyLife} style={styles.retryButton}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const profile = data?.profile || {};
  const today = data?.today || {};


  const handleBack = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(root)/(tabs)");
  }
};

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={handleBack}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My {APP_NAME}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {profile.dateOfBirth || ""} {profile.placeOfBirth ? `· ${profile.placeOfBirth}` : ""}  ⓘ
          </Text>
        </View>
        <Pressable
  style={styles.headerButton}
  onPress={share}
  hitSlop={10}
>
  <MaterialCommunityIcons
    name="share-variant-outline"
    size={21}
    color={TEXT}
  />
</Pressable>
      </View>

      <TabBar active={activeTab} onChange={setActiveTab} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        {activeTab === "Today" && <TodayScreen today={today} onFuture={() => setActiveTab("Future")} />}
        {activeTab === "Past" && <PastScreen profile={profile} timeline={data?.past?.timeline || []} />}
        {activeTab === "Future" && <FutureScreen future={data?.future || {}} />}
      </ScrollView>
    </View>
  );
}

function TabBar({ active, onChange }) {
  return (
    <View style={styles.tabs}>
      {Object.keys(TAB).map((name) => {
        const selected = name === active;
        return (
          <Pressable
            key={name}
            onPress={() => onChange(name)}
            style={[styles.tab, selected && { backgroundColor: TAB[name].active }]}
          >
            <Text style={styles.tabIcon}>{TAB[name].icon}</Text>
            <Text style={[styles.tabText, selected && styles.tabTextActive]}>{name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TodayScreen({ today, onFuture }) {
  const areas = areaData(today);
  const dos = toList(today.guidance?.dos);
  const donts = toList(today.guidance?.donts);
  const moon = toText(today.moon_sign);

  const heroImage = getTodayMoonImage(moon);

  return (
    <View style={styles.todayPage}>
      <View style={styles.todayTop}>
        <View style={styles.dateLine}>
          <Text style={styles.dateText}>{toText(today.date) || "TODAY"}</Text>
          {!!moon && (
            <View style={styles.moonPill}>
              <Text style={styles.moonGlyph}>☾</Text>
              <Text style={styles.moonText}>Moon in {moon}</Text>
            </View>
          )}
        </View>

        <ImageBackground
        source={heroImage}          
style={styles.hero}
          imageStyle={styles.heroImage}
          resizeMode="cover"
        >
          <Text style={styles.heroKicker}>TODAY FOR YOU</Text>
          <Text style={styles.heroTitle}>{toText(today.horoscope_title) || "Steady progress with thoughtful choices."}</Text>
          <Text style={styles.heroText}>{toText(today.horoscope_text) || "Your work moves forward today, with supportive conversations and clearer direction."}</Text>
        </ImageBackground>
      </View>

      <View style={styles.todayBody}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Life areas today</Text>
          <Text style={styles.linkText}>See details ›</Text>
        </View>

        <View style={styles.areaGrid}>
          {areas.map((area) => (
            <View key={area.key} style={styles.areaCard}>
              <View style={styles.areaCircle}><Text style={styles.areaEmoji}>{area.icon}</Text></View>
              <View style={styles.areaInfo}>
                <Text style={styles.areaName}>{area.label}</Text>
                <Text style={[styles.areaStatus, { color: STATUS_COLOR[area.status], backgroundColor: STATUS_BG[area.status] }]}>
                  {area.status === "Challenging" ? "Watchful" : area.status}
                </Text>
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </View>
          ))}
        </View>

        <View style={styles.guidanceCard}>
          <View style={styles.sectionHead}>
            <View style={styles.guidanceHeading}>
              <Text style={styles.spark}>✦</Text>
              <Text style={styles.sectionTitle}>Today’s guidance</Text>
            </View>
            <Text style={styles.linkText}>See all ›</Text>
          </View>
          {dos.map((item, index) => (
            <GuidanceRow key={`do-${index}`} text={item} positive />
          ))}
          {donts.map((item, index) => (
            <GuidanceRow key={`dont-${index}`} text={item} />
          ))}
        </View>

        <BestWindow timing={today.timing} />

        <Pressable style={styles.futureLink} onPress={onFuture}>
          <View style={styles.futureLinkIcon}><Text>🔮</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.futureLinkSmall}>GO DEEPER</Text>
            <Text style={styles.futureLinkText}>Explore what’s ahead in your dasha</Text>
          </View>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BestWindow({ timing }) {
  // The backend currently returns timing: [] for this profile.
  // Keep the section visible to match the Today design, while using real
  // backend timing automatically as soon as it becomes available.
  const hasApiTiming = Array.isArray(timing) && timing.length > 0;

  const fallback = [
    { time: "12 AM", status: "Avoid" },
    { time: "6 AM", status: "Neutral" },
    { time: "10 AM – 1 PM", status: "Best" },
    { time: "6 PM", status: "Neutral" },
    { time: "12 AM", status: "Avoid" },
  ];

  const slots = hasApiTiming
    ? timing.slice(0, 5).map((slot) => ({
        time: toText(slot?.time),
        status: toText(slot?.status),
      }))
    : fallback;

  return (
    <View style={styles.windowBlock}>
      <Text style={styles.windowTitle}>◷  Your best window</Text>

      <View style={styles.windowTrack}>
        {slots.map((slot, index) => {
          const isBest =
            String(slot.status).toLowerCase() === "best" ||
            String(slot.status).toLowerCase() === "favourable";

          const isAvoid =
            String(slot.status).toLowerCase() === "avoid";

          return (
            <View key={index} style={styles.windowItem}>
              <View
                style={[
                  styles.windowBar,
                  {
                    backgroundColor: isBest
                      ? ORANGE
                      : isAvoid
                        ? "#F0DCE3"
                        : "#E8E3EA",
                  },
                ]}
              />
              {isBest && <View style={styles.windowSun}><Text>☀</Text></View>}
              <Text
                style={[
                  styles.windowTime,
                  isBest && styles.windowTimeBest,
                ]}
              >
                {slot.time}
              </Text>
              <Text
                style={[
                  styles.windowStatus,
                  isBest && styles.windowStatusBest,
                  isAvoid && styles.windowStatusAvoid,
                ]}
              >
                {slot.status}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function GuidanceRow({ text, positive = false }) {
  return (
    <View style={styles.guidanceRow}>
      {positive ? (
        <View style={styles.guidanceCheck}><Text style={styles.guidanceCheckText}>✓</Text></View>
      ) : (
        <View style={styles.guidanceEmpty} />
      )}
      <Text style={styles.guidanceText}>{text}</Text>
    </View>
  );
}

function PastScreen({ profile, timeline }) {
  return (
    <View style={styles.timelinePage}>
      <Text style={styles.timelineTitle}>Your story so far</Text>

      <Text style={styles.timelineSubtitle}>
        Key turning points from your chart, explained in simple language.
      </Text>

      <PastTimeline
        rows={timeline}
        profile={profile}
      />

      <View style={styles.shapedSection}>
        <Text style={styles.shapedTitle}>What shaped you</Text>

        <Text style={styles.shapedSubtitle}>
          Core themes that have influenced your journey so far.
        </Text>

        <View style={styles.shapedGrid}>
          <View style={styles.shapedCard}>
            <View
              style={[
                styles.shapedIcon,
                { backgroundColor: "#E7F5EA" },
              ]}
            >
              <Text style={styles.shapedEmoji}>🌿</Text>
            </View>

            <Text style={styles.shapedCardTitle}>
              Independence
            </Text>

            <Text style={styles.shapedCardText}>
              You’ve learned to rely on yourself and make your own
              decisions.
            </Text>
          </View>

          <View style={styles.shapedCard}>
            <View
              style={[
                styles.shapedIcon,
                { backgroundColor: "#FDE9EC" },
              ]}
            >
              <Text style={styles.shapedEmoji}>❤️</Text>
            </View>

            <Text style={styles.shapedCardTitle}>
              Relationships
            </Text>

            <Text style={styles.shapedCardText}>
              Deep bonds and important lessons in trust and boundaries.
            </Text>
          </View>

          <View style={styles.shapedCard}>
            <View
              style={[
                styles.shapedIcon,
                { backgroundColor: "#FFF0E3" },
              ]}
            >
              <Text style={styles.shapedEmoji}>⚙️</Text>
            </View>

            <Text style={styles.shapedCardTitle}>
              Work ethic
            </Text>

            <Text style={styles.shapedCardText}>
              You’ve shown discipline and the ability to learn from
              challenges.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function PastTimeline({ rows, profile }) {
  const visibleRows = rows.slice(0, 4);

  return (
    <View style={styles.pastTimelineWrap}>
      {visibleRows.map((row, index) => {
        const imageSource = PAST_IMAGES[index];

        const dates = row?.start
  ? `(${formatDate(row.start)} – ${formatDate(
      row.end || row.start
    )})`
  : "";

        const age = ageLabel(row, profile);

        return (
          <View
            key={`${row?.start || "past"}-${index}`}
            style={styles.pastTimelineRow}
          >
            {/* Timeline rail */}
            <View style={styles.pastRail}>
              <View style={styles.pastRailDot} />

              {index < visibleRows.length - 1 && (
                <View style={styles.pastRailLine} />
              )}
            </View>

            {/* Story card */}
            <View style={styles.pastCardWrap}>
              <Pressable style={styles.pastStoryCard}>
                <View style={styles.pastStoryImageColumn}>
                  <View style={styles.pastCategoryIcon}>
                    <Text style={styles.pastCategoryEmoji}>
                      {index === 0
                        ? "🌿"
                        : index === 1
                        ? "📖"
                        : index === 2
                        ? "❤️"
                        : "📖"}
                    </Text>
                  </View>

                  <Image
                    source={imageSource}
                    style={styles.pastStoryImage}
                    resizeMode="cover"
                  />
                </View>

                <View style={styles.pastStoryCopy}>
                  <View style={styles.pastAgeRow}>
                    <Text style={styles.pastAge}>
                      {age || `Age ${index + 1}`}
                    </Text>

                    {!!dates && (
  <Text style={styles.pastYears}>
    {dates}
  </Text>
)}
                  </View>

                  <Text style={styles.pastStoryTitle}>
                    {toText(row?.title)}
                  </Text>

                  <Text
                    style={styles.pastStoryDescription}
                    numberOfLines={4}
                  >
                    {toText(row?.description)}
                  </Text>
                </View>

                <Text style={styles.pastStoryArrow}>
                  ›
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}



function Timeline({ rows, profile, tone }) {
  const [open, setOpen] = useState(null);
  const isPast = tone === "past";
  return (
    <View style={styles.timelineWrap}>
      {rows.map((row, index) => (
        <View key={`${row.start}-${index}`} style={styles.timelineRow}>
          <View style={styles.rail}>
            <View style={[styles.railDot, isPast ? styles.railPast : styles.railFuture]}>
              <Text style={styles.railEmoji}>{index % 2 === 0 ? "🌿" : "❤️"}</Text>
            </View>
            {index < rows.length - 1 && <View style={[styles.railLine, isPast ? styles.railPastLine : styles.railFutureLine]} />}
          </View>
          <View style={styles.timelineMain}>
            <Text style={styles.ageText}>{ageLabel(row, profile)} {row.start ? `(${row.start.slice(0, 4)} – ${row.end?.slice(0, 4) || ""})` : ""}</Text>
            <Pressable onPress={() => setOpen(open === index ? null : index)} style={styles.storyCard}>
              <View style={styles.storyImagePlaceholder}>
                <Text style={{ fontSize: 34 }}>{index % 3 === 0 ? "🌅" : index % 3 === 1 ? "🌱" : "🌇"}</Text>
              </View>
              <View style={styles.storyCopy}>
                <Text style={styles.storyTitle}>{toText(row.title)}</Text>
                <Text numberOfLines={open === index ? undefined : 3} style={styles.storyDescription}>{toText(row.description)}</Text>
              </View>
              <Text style={styles.storyArrow}>{open === index ? "⌃" : "›"}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function getDaysRemaining(endDate) {
  if (!endDate) return null;

  const end = new Date(`${endDate}T23:59:59`);
  const now = new Date();

  const diff =
    end.getTime() - now.getTime();

  if (diff <= 0) {
    return 0;
  }

  return Math.ceil(
    diff / (1000 * 60 * 60 * 24)
  );
}


function getPhaseProgress(startDate, endDate) {
  if (!startDate || !endDate) {
    return 60;
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  const now = new Date();

  const total =
    end.getTime() - start.getTime();

  if (total <= 0) {
    return 100;
  }

  const elapsed =
    now.getTime() - start.getTime();

  return Math.max(
    0,
    Math.min(100, (elapsed / total) * 100)
  );
}


function getPhaseTitle(phase) {
  const first = toText(phase?.ahead?.[0]);

  if (first) {
    const cleaned = first
      .replace(/^you are currently in (a |the )?/i, "")
      .replace(/^this phase (is |will be )?/i, "")
      .trim();

    if (cleaned.length > 0) {
      const sentenceEnd = cleaned.search(/[.!?]/);

      if (
        sentenceEnd > 0 &&
        sentenceEnd < 75
      ) {
        return cleaned.slice(0, sentenceEnd);
      }

      if (cleaned.length <= 75) {
        return cleaned;
      }
    }
  }

  if (phase?.major && phase?.sub) {
    return `${phase.major}–${phase.sub} phase`;
  }

  return "A new phase is unfolding.";
}


function getPhaseDescription(phase, areas) {
  const currentArea = areas.find(
    (area) =>
      toText(area.event?.description).length > 0
  );

  if (currentArea?.event?.description) {
    return toText(
      currentArea.event.description
    );
  }

  const second =
    toText(phase?.ahead?.[1]);

  if (second) {
    return second;
  }

  return "This is a time to stay focused, work through what matters and build stronger foundations for what comes next.";
}


function buildPrepareItems(phase, areas) {
  const items = [];

  const ahead = Array.isArray(phase?.ahead)
    ? phase.ahead
    : [];

  ahead.forEach((item) => {
    const text = toText(item);

    if (text && items.length < 4) {
      const cleaned = text
        .replace(/^you are currently in /i, "")
        .replace(/^this phase encourages /i, "")
        .trim();

      if (cleaned) {
        items.push(cleaned);
      }
    }
  });

  areas.forEach((area) => {
    const description = toText(
      area.event?.description
    );

    if (
      description &&
      items.length < 4
    ) {
      items.push(
        `${area.label}: stay mindful and consistent.`
      );
    }
  });

  const fallback = [
    "Stay focused on your responsibilities",
    "Plan important decisions carefully",
    "Protect time for meaningful growth",
    "Stay grounded and avoid impulsive choices",
  ];

  while (items.length < 4) {
    items.push(fallback[items.length]);
  }

  return items.slice(0, 4);
}


function buildLeanIntoItems(phase, areas) {
  const items = [];

  const reflections = Array.isArray(
    phase?.reflections
  )
    ? phase.reflections
    : [];

  reflections.forEach((item) => {
    const text = toText(item)
      .replace(/^I am /i, "")
      .replace(/^I need to /i, "")
      .replace(/^I /i, "")
      .trim();

    if (text && items.length < 4) {
      items.push(
        text.charAt(0).toUpperCase() +
          text.slice(1)
      );
    }
  });

  if (items.length < 4) {
    const statusAreas = areas.filter(
      (area) =>
        normalizeStatus(
          area.data?.status
        ) !== "Challenging"
    );

    statusAreas.forEach((area) => {
      if (items.length < 4) {
        items.push(
          `Strengthen your ${area.label.toLowerCase()}`
        );
      }
    });
  }

  const fallback = [
    "Consistency over speed",
    "Practical planning",
    "Building long-term skills",
    "Strengthening key relationships",
  ];

  while (items.length < 4) {
    items.push(fallback[items.length]);
  }

  return items.slice(0, 4);
}


function buildAvoidItems(phase, areas) {
  const items = [];

  const challengingAreas =
    areas.filter(
      (area) =>
        normalizeStatus(
          area.data?.status
        ) === "Challenging"
    );

  challengingAreas.forEach((area) => {
    if (items.length < 4) {
      items.push(
        `Neglecting your ${area.label.toLowerCase()}`
      );
    }
  });

  const fallback = [
    "Impulsive spending",
    "Taking unnecessary risks",
    "Overcommitting",
    "Ignoring rest and recovery",
  ];

  while (items.length < 4) {
    items.push(fallback[items.length]);
  }

  return items.slice(0, 4);
}

function FutureProgress({
  phase,
  timeline,
  daysLeft,
}) {
  const points = [
    {
      label: "Current",
      value:
        daysLeft !== null
          ? `${daysLeft} days`
          : "Now",
    },
    {
      label: "Next",
      value: getNextDuration(
        timeline,
        phase
      ),
    },
    {
      label: "Later",
      value: "1–2 years",
    },
    {
      label: "Long term",
      value: "2+ years",
    },
  ];

  return (
    <View style={styles.futureProgress}>
      <View style={styles.futureProgressLine} />

      {points.map((point, index) => (
        <View
          key={point.label}
          style={styles.futurePoint}
        >
          <View
            style={[
              styles.futureDot,
              index === 0 &&
                styles.futureDotActive,
            ]}
          />

          <Text
            style={[
              styles.futurePointLabel,
              index === 0 &&
                styles.futurePointActive,
            ]}
          >
            {point.label}
          </Text>

          <Text style={styles.futurePointValue}>
            {point.value}
          </Text>
        </View>
      ))}
    </View>
  );
}


function getNextDuration(timeline, phase) {
  if (
    !Array.isArray(timeline) ||
    timeline.length === 0
  ) {
    return "Next";
  }

  const next = timeline.find(
    (item) =>
      item?.start &&
      phase?.end &&
      item.start > phase.end
  );

  if (!next) {
    return "Next";
  }

  const start = new Date(
    `${next.start}T00:00:00`
  );

  const end = new Date(
    `${next.end || next.start}T00:00:00`
  );

  const months = Math.max(
    1,
    Math.round(
      (end - start) /
        (1000 * 60 * 60 * 24 * 30)
    )
  );

  return `${months} month${months === 1 ? "" : "s"}`;
}



function FutureScreen({ future }) {
  const phase = future?.phase || {};
  const timeline = Array.isArray(future?.timeline)
    ? future.timeline
    : [];


    const futureHeroImage = getFutureImage(
    phase.major
  );

  const areas = [
    {
      key: "career",
      label: "Career",
      icon: "💼",
    },
    {
      key: "money",
      label: "Money",
      icon: "🪙",
    },
    {
      key: "health",
      label: "Health",
      icon: "🌿",
    },
    {
      key: "love",
      label: "Relationships",
      icon: "❤️",
    },
  ].map((area) => ({
    ...area,
    data: phase.areas?.[area.key] || {},
    event:
      phase.areas?.[area.key]?.events?.find(
        (event) => event.state === "current"
      ) ||
      phase.areas?.[area.key]?.events?.[0] ||
      {},
  }));

  const daysLeft = getDaysRemaining(phase.end);

  const progress = getPhaseProgress(
    phase.start,
    phase.end
  );

  const phaseTitle = getPhaseTitle(phase);

  const phaseDescription = getPhaseDescription(
    phase,
    areas
  );

  const prepareItems = buildPrepareItems(
    phase,
    areas
  );

  const leanIntoItems = buildLeanIntoItems(
    phase,
    areas
  );

  const avoidItems = buildAvoidItems(
    phase,
    areas
  );

  return (
    <View style={styles.futurePage}>
      {/* Heading */}
      <Text style={styles.timelineTitle}>
        What’s ahead
      </Text>

      <Text style={styles.timelineSubtitle}>
        The next phases of your chart, translated into practical guidance.
      </Text>

      {/* Progress */}
      <FutureProgress
        phase={phase}
        timeline={timeline}
        daysLeft={daysLeft}
      />

      {/* Main phase card */}
      <ImageBackground
  source={futureHeroImage}
  style={styles.futurePhaseHero}
  imageStyle={styles.futurePhaseHeroImage}
  resizeMode="cover"
>
        <View style={styles.futurePhaseContent}>
          <View style={styles.futurePhaseMetaRow}>
            <Text style={styles.futurePhaseKicker}>
              {phase.major || "Current"} phase
            </Text>

            <Text style={styles.futurePhaseDot}>
              •
            </Text>

            <Text style={styles.futurePhaseDays}>
              {daysLeft !== null
                ? `${daysLeft} days`
                : ""}
            </Text>
          </View>

          <Text style={styles.futurePhaseDate}>
            {formatDate(phase.start)}
            {phase.start && phase.end ? " – " : ""}
            {formatDate(phase.end)}
          </Text>

          <Text style={styles.futurePhaseTitle}>
            {phaseTitle}
          </Text>

          <Text style={styles.futurePhaseDescription}>
            {phaseDescription}
          </Text>

          <View style={styles.futurePhaseBottom}>
            <View style={styles.futurePhaseProgressTrack}>
              <View
                style={[
                  styles.futurePhaseProgressFill,
                  {
                    width: `${Math.max(
                      5,
                      Math.min(100, progress)
                    )}%`,
                  },
                ]}
              />
            </View>

            <Text style={styles.futurePhaseRemaining}>
              {daysLeft !== null
                ? `${daysLeft} days left`
                : "Current phase"}
            </Text>
          </View>
        </View>
      </ImageBackground>

      {/* Where this phase may show up */}
      <Text style={styles.futureSectionTitle}>
        Where this phase may show up
      </Text>

      <View style={styles.futureAreasCard}>
        {areas.map((area, index) => (
          <View
            key={area.key}
            style={[
              styles.futureAreaRow,
              index === areas.length - 1 && {
                borderBottomWidth: 0,
              },
            ]}
          >
            <View style={styles.futureAreaCircle}>
              <Text style={styles.futureAreaEmoji}>
                {area.icon}
              </Text>
            </View>

            <View style={styles.futureAreaNameWrap}>
              <Text style={styles.futureAreaName}>
                {area.label}
              </Text>
            </View>

            <View style={styles.futureAreaDescriptionWrap}>
              <Text
                numberOfLines={2}
                style={styles.futureAreaText}
              >
                {toText(
                  area.event?.description ||
                    area.event?.title ||
                    area.data?.description
                ) ||
                  "This phase may bring important developments in this area."}
              </Text>
            </View>

            <Text style={styles.futureAreaChevron}>
              ›
            </Text>
          </View>
        ))}
      </View>

      {/* Prepare for it */}
      <Text style={styles.futureSectionTitle}>
        Prepare for it
      </Text>

      <View style={styles.prepareCard}>
        {prepareItems.map((item, index) => (
          <View
            key={`${item}-${index}`}
            style={[
              styles.prepareRow,
              index === prepareItems.length - 1 && {
                borderBottomWidth: 0,
              },
            ]}
          >
            <View style={styles.prepareCheck}>
              <Text style={styles.prepareCheckText}>
                ✓
              </Text>
            </View>

            <Text style={styles.prepareText}>
              {item}
            </Text>
          </View>
        ))}
      </View>

      {/* Lean into / avoid */}
      <View style={styles.leanAvoidRow}>
        <View
          style={[
            styles.leanAvoidCard,
            styles.leanCard,
          ]}
        >
          <View style={styles.leanAvoidHeader}>
            <Text style={styles.leanAvoidIcon}>
              ☀️
            </Text>

            <Text style={styles.leanAvoidTitle}>
              What to lean into
            </Text>
          </View>

          {leanIntoItems.map((item, index) => (
            <View
              key={`${item}-${index}`}
              style={styles.bulletRow}
            >
              <View
                style={[
                  styles.bullet,
                  styles.leanBullet,
                ]}
              />

              <Text style={styles.bulletText}>
                {item}
              </Text>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.leanAvoidCard,
            styles.avoidCard,
          ]}
        >
          <View style={styles.leanAvoidHeader}>
            <Text style={styles.leanAvoidIcon}>
              🌙
            </Text>

            <Text style={styles.leanAvoidTitle}>
              What to avoid
            </Text>
          </View>

          {avoidItems.map((item, index) => (
            <View
              key={`${item}-${index}`}
              style={styles.bulletRow}
            >
              <View
                style={[
                  styles.bullet,
                  styles.avoidBullet,
                ]}
              />

              <Text style={styles.bulletText}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}




const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 28 },
  loadingText: { marginTop: 12, color: MUTED, fontSize: 14 },
  errorTitle: { color: TEXT, fontSize: 21, fontWeight: "800", marginBottom: 8 },
  errorText: { color: MUTED, fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 20 },
  retryButton: { backgroundColor: ORANGE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  retryText: { color: "#fff", fontWeight: "800" },
  header: { height: 68, backgroundColor: "#FBFAFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  backIcon: { color: TEXT, fontSize: 34, fontWeight: "300", lineHeight: 38 },
  shareIcon: { color: TEXT, fontSize: 25 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: TEXT, fontSize: 17, fontWeight: "800" },
  headerSubtitle: { color: MUTED, fontSize: 10.5, marginTop: 2 },
  tabs: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: "#FBFAFF" },
  tab: { flex: 1, height: 39, borderRadius: 12, backgroundColor: "#F1EDF7", alignItems: "center", justifyContent: "center", flexDirection: "row" },
  tabIcon: { fontSize: 16 },
  tabText: { color: TEXT, fontSize: 12.5, fontWeight: "700", marginLeft: 5 },
  tabTextActive: { color: "#fff" },

  todayPage: { backgroundColor: "#F5F2FF" },
  todayTop: { paddingHorizontal: 16, paddingTop: 7, paddingBottom: 15 },
  dateLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 9 },
  dateText: { color: TEXT, fontSize: 19, fontWeight: "800" },
  moonPill: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9F6FF", borderWidth: 1, borderColor: "#E7E0EF", borderRadius: 15, paddingHorizontal: 9, paddingVertical: 6 },
  moonGlyph: { color: "#79527D", fontSize: 14, marginRight: 5 },
  moonText: { color: "#665E6D", fontSize: 10.5, fontWeight: "700" },
hero: {
  minHeight: 220,
  borderRadius: 20,
  overflow: "hidden",
  paddingHorizontal: 20,
  paddingVertical: 24,
  justifyContent: "center",
},
  heroImage: { borderRadius: 17 },
  heroKicker: { color: "#B54429", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.5 },
  heroTitle: {
  color: "#272046",
  fontSize: 21,
  lineHeight: 24,
  fontWeight: "800",
  width: "67%",
  marginTop: 6,
},

heroText: {
  color: TEXT,
  fontSize: 12,
  lineHeight: 17,
  width: "100%",
  marginTop: 8,
  fontWeight:"500"
},
  todayBody: { backgroundColor: "#FBFAFF", borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -1, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 30 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: TEXT, fontSize: 17, fontWeight: "800" },
  linkText: { color: ORANGE, fontSize: 10.5, fontWeight: "800" },
  areaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  areaCard: { width: "48.7%", minHeight: 67, borderRadius: 14, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, padding: 9, flexDirection: "row", alignItems: "center" },
  areaCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFF0E8", alignItems: "center", justifyContent: "center" },
  areaEmoji: { fontSize: 18 },
  areaInfo: { flex: 1, marginLeft: 8 },
  areaName: { color: "#3A3340", fontSize: 12.5, fontWeight: "800" },
  areaStatus: { alignSelf: "flex-start", fontSize: 8.5, fontWeight: "800", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginTop: 4, overflow: "hidden" },
  rowChevron: { color: TEXT, fontSize: 20, marginLeft: 4 },
  guidanceCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 15, padding: 13, marginTop: 20 },
  guidanceHeading: { flexDirection: "row", alignItems: "center" },
  spark: { color: "#E58B2E", fontSize: 19, marginRight: 7 },
  guidanceRow: { flexDirection: "row", alignItems: "center", marginTop: 11 },
  guidanceCheck: { width: 19, height: 19, borderRadius: 10, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" },
  guidanceCheckText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  guidanceEmpty: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: "#BFC1CA" },
  guidanceText: { flex: 1, color: TEXT, fontSize: 12, marginLeft: 10, lineHeight: 17 },
  windowBlock: { marginTop: 20 },
  windowTitle: { color: TEXT, fontSize: 15, fontWeight: "800", marginBottom: 9 },
  windowTrack: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  windowItem: { width: "19%", alignItems: "center", position: "relative" },
  windowBar: { width: "100%", height: 7, borderRadius: 5 },
  windowSun: { position: "absolute", top: -10, width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  windowTime: { color: TEXT, fontSize: 8.5, marginTop: 7, textAlign: "center" },
  windowTimeBest: { color: "#B94A2F", fontWeight: "800" },
  windowStatus: { color: TEXT, fontSize: 8, marginTop: 2, textAlign: "center" },
  windowStatusBest: { color: "#B94A2F", fontWeight: "800" },
  windowStatusAvoid: { color: TEXT },
  futureLink: { marginTop: 20, borderRadius: 15, backgroundColor: "#F7EFEA", borderWidth: 1, borderColor: "#EAD8CE", padding: 12, flexDirection: "row", alignItems: "center" },
  futureLinkIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F6DCCF", alignItems: "center", justifyContent: "center", marginRight: 10 },
  futureLinkSmall: { color: "#9A6655", fontSize: 8.5, fontWeight: "800", letterSpacing: 0.6 },
  futureLinkText: { color: TEXT, fontSize: 12.5, fontWeight: "800", marginTop: 2 },

  timelinePage: { backgroundColor: BG, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 35 },
  timelineTitle: { color: TEXT, fontSize: 23, fontWeight: "800", lineHeight: 28 },
  timelineSubtitle: { color: MUTED, fontSize: 12, lineHeight: 17, marginTop: 3 },
  timelineWrap: { marginTop: 17 },
  timelineRow: { flexDirection: "row" },
  rail: { width: 32, alignItems: "center" },
  railDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", zIndex: 2 },
  railPast: { backgroundColor: "#E9F3E9" },
  railFuture: { backgroundColor: "#F0E6FA" },
  railEmoji: { fontSize: 13 },
  railLine: { flex: 1, width: 1.5, marginTop: -1 },
  railPastLine: { backgroundColor: "#C35A36" },
  railFutureLine: { backgroundColor: "#BBA3CB" },
  timelineMain: { flex: 1, paddingLeft: 8, paddingBottom: 12 },
  ageText: { color: "#6E6675", fontSize: 10, marginBottom: 5 },
  storyCard: { backgroundColor: CARD, borderRadius: 15, borderWidth: 1, borderColor: BORDER, padding: 10, flexDirection: "row", minHeight: 110 },
  storyImagePlaceholder: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#F4E9DE", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  storyCopy: { flex: 1, marginLeft: 10, paddingRight: 5 },
  storyTitle: { color: TEXT, fontSize: 14, fontWeight: "800", lineHeight: 18 },
  storyDescription: { color: MUTED, fontSize: 10.5, lineHeight: 14, marginTop: 4 },
  storyArrow: { color: TEXT, fontSize: 19, alignSelf: "center" },

  futurePage: {
  backgroundColor: BG,
  paddingHorizontal: 18,
  paddingTop: 16,
  paddingBottom: 35,
},

futureProgress: {
  height: 67,
  marginTop: 15,
  flexDirection: "row",
  justifyContent: "space-between",
  position: "relative",
},

futureProgressLine: {
  position: "absolute",
  left: 7,
  right: 7,
  top: 7,
  height: 1,
  backgroundColor: "#B9A2C3",
},

futurePoint: {
  width: "24%",
  alignItems: "center",
},

futureDot: {
  width: 10,
  height: 10,
  borderRadius: 5,
  backgroundColor: "#B5B0BC",
  borderWidth: 2,
  borderColor: BG,
},

futureDotActive: {
  backgroundColor: "#7B225D",
},

futurePointLabel: {
  color: TEXT,
  fontSize: 9,
  fontWeight: "700",
  marginTop: 5,
},

futurePointActive: {
  color: "#7B225D",
},

futurePointValue: {
  color: "#8C8590",
  fontSize: 8.5,
  marginTop: 2,
},

futurePhaseHero: {
  minHeight: 185,
  borderRadius: 16,
  overflow: "hidden",
},

futurePhaseHeroImage: {
  borderRadius: 16,
},

futurePhaseContent: {
  flex: 1,
  paddingHorizontal: 14,
  paddingTop: 14,
  paddingBottom: 12,
  justifyContent: "flex-start",
},

futurePhaseMetaRow: {
  flexDirection: "row",
  alignItems: "center",
},

futurePhaseKicker: {
  color: "#F1C7AD",
  fontSize: 10,
  fontWeight: "800",
},

futurePhaseDot: {
  color: "#EAD5C8",
  fontSize: 11,
  marginHorizontal: 6,
},

futurePhaseDays: {
  color: "#F4DED3",
  fontSize: 10,
  fontWeight: "700",
},

futurePhaseDate: {
  color: "#E1D4E4",
  fontSize: 9,
  marginTop: 3,
},

futurePhaseTitle: {
  color: "#FFFFFF",
  fontSize: 20,
  lineHeight: 23,
  fontWeight: "800",
  width: "72%",
  marginTop: 13,
},

futurePhaseDescription: {
  color: "#E9DFEC",
  fontSize: 10.5,
  lineHeight: 15,
  width: "78%",
  marginTop: 7,
  fontWeight:"500"
},

futurePhaseBottom: {
  flexDirection: "row",
  alignItems: "center",
  marginTop: 13,
},

futurePhaseProgressTrack: {
  flex: 1,
  height: 6,
  borderRadius: 4,
  backgroundColor: "rgba(255,255,255,0.25)",
  overflow: "hidden",
},

futurePhaseProgressFill: {
  height: 6,
  borderRadius: 4,
  backgroundColor: "#FFFFFF",
},

futurePhaseRemaining: {
  color: "#FFFFFF",
  fontSize: 9,
  fontWeight: "700",
  marginLeft: 10,
},

futureSectionTitle: {
  color: TEXT,
  fontSize: 16,
  fontWeight: "800",
  marginTop: 18,
  marginBottom: 8,
},

futureAreasCard: {
  backgroundColor: CARD,
  borderWidth: 1,
  borderColor: BORDER,
  borderRadius: 15,
  overflow: "hidden",
},

futureAreaRow: {
  minHeight: 61,
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 10,
  borderBottomWidth: 1,
  borderBottomColor: "#EEE9F0",
},

futureAreaCircle: {
  width: 35,
  height: 35,
  borderRadius: 18,
  backgroundColor: "#FFF0E8",
  alignItems: "center",
  justifyContent: "center",
  marginRight: 9,
},

futureAreaEmoji: {
  fontSize: 17,
},

futureAreaNameWrap: {
  width: 74,
},

futureAreaName: {
  color: TEXT,
  fontSize: 12,
  fontWeight: "800",
},

futureAreaDescriptionWrap: {
  flex: 1,
},

futureAreaText: {
  color: MUTED,
  fontSize: 9.5,
  fontWeight:"600",
  lineHeight: 13,
},

futureAreaChevron: {
  color: TEXT,
  fontSize: 21,
  marginLeft: 5,
},

prepareCard: {
  backgroundColor: CARD,
  borderWidth: 1,
  borderColor: BORDER,
  borderRadius: 15,
  paddingHorizontal: 11,
},

prepareRow: {
  flexDirection: "row",
  alignItems: "center",
  minHeight: 34,
  borderBottomWidth: 1,
  borderBottomColor: "#F0ECF2",
},

prepareCheck: {
  width: 18,
  height: 18,
  borderRadius: 9,
  backgroundColor: ORANGE,
  alignItems: "center",
  justifyContent: "center",
  marginRight: 8,
},

prepareCheckText: {
  color: "#FFFFFF",
  fontSize: 10,
  fontWeight: "900",
},

prepareText: {
  flex: 1,
  color: TEXT,
  fontSize: 10,
  lineHeight: 14,
  paddingVertical: 8,
  fontWeight:"600"
},

leanAvoidRow: {
  flexDirection: "row",
  gap: 7,
  marginTop: 8,
},

leanAvoidCard: {
  flex: 1,
  borderRadius: 15,
  paddingHorizontal: 11,
  paddingVertical: 11,
  minHeight: 112,
},

leanCard: {
  backgroundColor: "#FFF4E7",
},

avoidCard: {
  backgroundColor: "#FDE8ED",
},

leanAvoidHeader: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 6,
},

leanAvoidIcon: {
  fontSize: 17,
  marginRight: 6,
},

leanAvoidTitle: {
  flex: 1,
  color: TEXT,
  fontSize: 11.5,
  fontWeight: "800",
},

bulletRow: {
  flexDirection: "row",
  alignItems: "center",
  marginTop: 4,
},

bullet: {
  width: 5,
  height: 5,
  borderRadius: 3,
  marginRight: 7,
},

leanBullet: {
  backgroundColor: "#E85F2D",
},

avoidBullet: {
  backgroundColor: "#D83D55",
},

bulletText: {
  flex: 1,
  color: TEXT,
  fontSize: 9.5,
  lineHeight: 13,
  fontWeight:"500"
},


  pastTimelineWrap: {
  marginTop: 18,
  paddingBottom: 2,
},

pastTimelineRow: {
  flexDirection: "row",
  minHeight: 145,
},

pastRail: {
  width: 28,
  alignItems: "center",
  position: "relative",
},

pastRailDot: {
  width: 13,
  height: 13,
  borderRadius: 7,
  backgroundColor: ORANGE,
  marginTop: 20,
  zIndex: 2,
},

pastRailLine: {
  position: "absolute",
  top: 32,
  bottom: -1,
  width: 1.5,
  backgroundColor: "#C95A38",
},

pastCardWrap: {
  flex: 1,
  paddingLeft: 5,
  paddingBottom: 12,
},

pastStoryCard: {
  minHeight: 140,
  borderRadius: 18,
  backgroundColor: "#FBFAFF",
  borderWidth: 1,
  borderColor: "#E8E3EE",
  padding: 12,
  flexDirection: "row",
  alignItems: "center",
},

pastStoryImageColumn: {
  width: 84,
  alignItems: "center",
  alignSelf: "stretch",
  justifyContent: "center",
},

pastCategoryIcon: {
  position: "absolute",
  top: -3,
  left: 1,
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: "#E9F5EA",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 3,
},

pastCategoryEmoji: {
  fontSize: 15,
},

pastStoryImage: {
  width: 76,
  height: 76,
  borderRadius: 38,
  marginTop: 10,
},

pastStoryCopy: {
  flex: 1,
  marginLeft: 10,
  paddingRight: 3,
  alignSelf: "stretch",
  justifyContent: "center",
},

pastAgeRow: {
  flexDirection: "row",
  alignItems: "baseline",
  flexWrap: "wrap",
  marginBottom: 5,
},

pastAge: {
  color: TEXT,
  fontSize: 14,
  fontWeight: "800",
},

pastYears: {
  color: TEXT,
  fontSize: 11,
  marginLeft: 8,
},

pastStoryTitle: {
  color: TEXT,
  fontSize: 14,
  lineHeight: 18,
  fontWeight: "800",
},

pastStoryDescription: {
  color: MUTED,
  fontSize: 10.5,
  lineHeight: 14.5,
  marginTop: 4,
  fontWeight:"500"
},

pastStoryArrow: {
  color: "#5D5664",
  fontSize: 25,
  lineHeight: 28,
  marginLeft: 3,
  alignSelf: "center",
},

shapedSection: {
  marginTop: 2,
  paddingBottom: 8,
},

shapedTitle: {
  color: TEXT,
  fontSize: 21,
  lineHeight: 26,
  fontWeight: "800",
},

shapedSubtitle: {
  color: MUTED,
  fontSize: 11.5,
  lineHeight: 16,
  marginTop: 3,
  marginBottom: 10,
  fontWeight:"500"
},

shapedGrid: {
  flexDirection: "row",
  gap: 7,
},

shapedCard: {
  flex: 1,
  minHeight: 128,
  backgroundColor: CARD,
  borderWidth: 1,
  borderColor: BORDER,
  borderRadius: 15,
  padding: 10,
},

shapedIcon: {
  width: 35,
  height: 35,
  borderRadius: 18,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 7,
},

shapedEmoji: {
  fontSize: 17,
},

shapedCardTitle: {
  color: TEXT,
  fontSize: 10.5,
  lineHeight: 13,
  fontWeight: "800",
},

shapedCardText: {
  color: MUTED,
  fontSize: 8.8,
  lineHeight: 12,
  fontWeight:"500",
  marginTop: 4,
},
});
