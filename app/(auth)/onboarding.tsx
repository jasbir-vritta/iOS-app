import { MaterialCommunityIcons as MIcon } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VrittaLogo } from "../../components/auth/VrittaLogo";

import { Text } from "../../components/ui/BrandText";

import { useUserStore } from "../../components/stores/userStore";
import { track } from "../../lib/analytics";
import { API_URL, authHeaders } from "../../lib/auth";
import { translate, useLanguageStore, useT } from "../../lib/i18n";

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  GOLD: "#C49A4A",
  LAVENDER: "#F4F0F8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  LINE: "rgba(217,206,193,0.7)",
  SOFT: "#EFE8F7",
  SUCCESS: "#2E7D4F",
};

type PlaceResult = {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  country_code?: string;
  admin1?: string;
};

// Saved birth place text, e.g. "Bengaluru, Karnataka".
const formatPlaceLabel = (place: PlaceResult) =>
  [place.name, place.admin1].filter(Boolean).join(", ");

export default function Home() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore(
    (state) => state.updateUser
  );

  const [name, setName] = useState(user.name);
  const [placeOfBirth, setPlaceOfBirth] = useState(
    user.placeOfBirth
  );
  const [dateOfBirth, setDateOfBirth] = useState(
    user.dateOfBirth
  );

  const [hour, setHour] = useState(
    user.timeOfBirth
      ? user.timeOfBirth.split(":")[0]
      : ""
  );

  const [minute, setMinute] = useState(
    user.timeOfBirth
      ? user.timeOfBirth.split(":")[1]
      : ""
  );

  const [gender, setGender] = useState(
    user.gender
  );

  const [language, setLanguage] = useState(
    user.language
  );

  const [showDatePicker, setShowDatePicker] =
    useState(false);

  const [showTimePicker, setShowTimePicker] =
    useState(false);

  const [saving, setSaving] = useState(false);

  const [loadingUser, setLoadingUser] =
    useState(true);

  // Place autocomplete
  const [placeSuggestions, setPlaceSuggestions] =
    useState<PlaceResult[]>([]);

  const [searchingPlaces, setSearchingPlaces] =
    useState(false);

  const [selectedLocation, setSelectedLocation] =
    useState<PlaceResult | null>(null);

  // Analytics: the onboarding screen was opened.
  useEffect(() => {
    track("visited_onboarding", { platform: Platform.OS });
  }, []);

  /**
   * Load user details from backend.
   */
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoadingUser(true);

        const response = await fetch(
          `${API_URL}/api/user/details`,
          {
            method: "GET",
            headers: await authHeaders(),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              "Failed to load user details"
          );
        }

        console.log(
          "Loaded user details:",
          data
        );

        // Update Zustand
        updateUser(data);

        // Update local form fields
        setName(data.name || "");

        setPlaceOfBirth(
          data.placeOfBirth || ""
        );

        setDateOfBirth(
          data.dateOfBirth || ""
        );

        if (data.timeOfBirth) {
          const [
            savedHour,
            savedMinute,
          ] = data.timeOfBirth.split(":");

          setHour(savedHour || "");
          setMinute(savedMinute || "");
        } else {
          setHour("");
          setMinute("");
        }

        setGender(data.gender || "");
        setLanguage(data.language || "");

        // Restore saved location
        if (
          data.placeOfBirth &&
          data.lat &&
          data.lon
        ) {
          setSelectedLocation({
            name: data.placeOfBirth,
            latitude: Number(data.lat),
            longitude: Number(data.lon),
            timezone: data.tzone || "",
          });
        }
      } catch (error) {
        console.error(
          "Failed to load user details:",
          error
        );
      } finally {
        setLoadingUser(false);
      }
    };

    loadUserData();
  }, [updateUser]);

  /**
   * Search places as the user types.
   */
  useEffect(() => {
    const query = placeOfBirth.trim();

    if (query.length < 2) {
      setPlaceSuggestions([]);
      setSearchingPlaces(false);
      return;
    }

    if (
      selectedLocation &&
      formatPlaceLabel(selectedLocation) === query
    ) {
      setPlaceSuggestions([]);
      setSearchingPlaces(false);
      return;
    }

    const timeout = setTimeout(
      async () => {
        try {
          setSearchingPlaces(true);

          const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
              query
            )}&count=5&language=en&format=json`
          );

          if (!response.ok) {
            setPlaceSuggestions([]);
            return;
          }

          const data =
            await response.json();

          if (!data.results) {
            setPlaceSuggestions([]);
            return;
          }

          setPlaceSuggestions(
            data.results
          );
        } catch (error) {
          console.error(
            "Place search failed:",
            error
          );

          setPlaceSuggestions([]);
        } finally {
          setSearchingPlaces(false);
        }
      },
      400
    );

    return () =>
      clearTimeout(timeout);
  }, [
    placeOfBirth,
    selectedLocation,
  ]);

  const formatPlaceSubtitle = (
    place: PlaceResult
  ) => {
    const parts = [
      place.name,
      place.admin1,
      place.country,
    ].filter(Boolean);

    return parts.join(", ");
  };

  /**
   * Select place from autocomplete.
   */
  const handleSelectPlace = (
    place: PlaceResult
  ) => {
    setPlaceOfBirth(formatPlaceLabel(place));
    setSelectedLocation(place);
    setPlaceSuggestions([]);
  };

  const formatDate = (date: Date) => {
    const day = String(
      date.getDate()
    ).padStart(2, "0");

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  };

  /**
   * Safely convert DD/MM/YYYY
   * into a JavaScript Date.
   */
  const getDateValue = () => {
    if (!dateOfBirth) {
      return new Date();
    }

    const [
      day,
      month,
      year,
    ] = dateOfBirth.split("/");

    const parsedDate = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return new Date();
    }

    return parsedDate;
  };

  const handleDateChange = (
    event: any,
    selectedDate?: Date
  ) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (selectedDate) {
      setDateOfBirth(
        formatDate(selectedDate)
      );
    }
  };

  /**
   * Convert the saved 24-hour HH:MM
   * into a Date for the time picker.
   */
  const getTimeValue = () => {
    const hour24 = Number(hour);
    const minuteValue = Number(minute);

    const date = new Date();

    date.setHours(
      hour && hour24 >= 0 && hour24 <= 23
        ? hour24
        : 12,
      minute && minuteValue >= 0 && minuteValue <= 59
        ? minuteValue
        : 0,
      0,
      0
    );

    return date;
  };

  /**
   * Save the picked time back into
   * the form as 24-hour HH:MM.
   */
  const handleTimeChange = (
    event: any,
    selectedTime?: Date
  ) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }

    if (!selectedTime) {
      return;
    }

    setHour(
      String(
        selectedTime.getHours()
      ).padStart(2, "0")
    );

    setMinute(
      String(
        selectedTime.getMinutes()
      ).padStart(2, "0")
    );
  };

  /**
   * Display the selected time
   * in 12-hour format.
   */
  const displayTime = useMemo(() => {
    if (!hour || !minute) {
      return "";
    }

    const hour24 = Number(hour);
    const minuteValue = Number(minute);

    if (
      Number.isNaN(hour24) ||
      Number.isNaN(minuteValue)
    ) {
      return "";
    }

    const meridiem =
      hour24 >= 12 ? "PM" : "AM";

    let hour12 = hour24 % 12;

    if (hour12 === 0) {
      hour12 = 12;
    }

    return `${String(
      hour12
    ).padStart(2, "0")}:${String(
      minuteValue
    ).padStart(2, "0")} ${meridiem}`;
  }, [hour, minute]);

  const handleSave = async () => {
    try {
      if (
        !name.trim() ||
        !placeOfBirth.trim() ||
        !dateOfBirth ||
        !hour ||
        !minute ||
        !gender ||
        !language
      ) {
        Alert.alert(
          translate("onboarding.missingTitle"),
          translate("onboarding.missingMessage")
        );
        return;
      }

      // Coordinates come only from a picked suggestion, so cities with
      // the same name (e.g. Aurangabad, Maharashtra / Bihar) can't be
      // mixed up. Typing the place clears the pick (see onChangeText).
      if (!selectedLocation) {
        Alert.alert(
          translate("onboarding.placeTitle"),
          translate("onboarding.placeMessage")
        );
        return;
      }

      const hourNumber = Number(hour);
      const minuteNumber =
        Number(minute);

      // Validate hour
      if (
        hourNumber < 0 ||
        hourNumber > 23
      ) {
        console.log(
          "Please enter a valid hour between 0 and 23"
        );
        return;
      }

      // Validate minute
      if (
        minuteNumber < 0 ||
        minuteNumber > 59
      ) {
        console.log(
          "Please enter a valid minute between 0 and 59"
        );
        return;
      }

      const timeOfBirth = `${String(
        hourNumber
      ).padStart(2, "0")}:${String(
        minuteNumber
      ).padStart(2, "0")}`;

      setSaving(true);

      const location = selectedLocation;

      const userData = {
        name: name.trim(),
        placeOfBirth:
          placeOfBirth.trim(),
        dateOfBirth,
        timeOfBirth,
        gender,
        language,
        lat: String(
          location.latitude
        ),
        lon: String(
          location.longitude
        ),
        tzone:
          location.timezone || "",
      };

      // Complete onboarding
      const onboardingResponse =
        await fetch(
          `${API_URL}/api/user/onboarding`,
          {
            method: "POST",
            headers:
              await authHeaders(),
            body: JSON.stringify(
              userData
            ),
          }
        );

      const onboardingData =
        await onboardingResponse.json();

      if (!onboardingResponse.ok) {
        throw new Error(
          onboardingData?.detail ||
            "Failed to complete onboarding"
        );
      }

      console.log(
        "Onboarding completed:",
        onboardingData
      );

      // Analytics: onboarding saved (no birth details or name sent).
      track("onboarding_completed", {
        gender,
        language,
        platform: Platform.OS,
      });

      // Update Zustand with the
      // complete onboarding data
      updateUser({
        ...onboardingData.user_details,
        active_profile_id:
          onboardingData.active_profile_id,
        onboarded: true,
      });

      // Go to Home
      router.replace(
        "/(root)/(tabs)"
      );
    } catch (error) {
      console.error(
        "Failed to save user:",
        error
      );
      Alert.alert(
        translate("onboarding.saveFailedTitle"),
        error instanceof Error ? error.message : translate("onboarding.saveFailedMessage")
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingUser) {
    return (
      <View style={[st.screen, st.loading]}>
        <ActivityIndicator size="large" color={C.PLUM} />
      </View>
    );
  }

  const genders = [
    { value: "male", label: t("common.male"), icon: "gender-male" },
    { value: "female", label: t("common.female"), icon: "gender-female" },
  ] as const;

  const languages = [
    { value: "en", label: "English", glyph: "Aa" },
    { value: "hi", label: "हिंदी", glyph: "अ" },
  ];

  // How many of the 6 details are filled (progress bar).
  const filled = [name.trim(), gender, language, selectedLocation, dateOfBirth, hour && minute].filter(Boolean).length;

  return (
    <KeyboardAvoidingView style={st.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[st.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
      >
        {/* Welcome */}
        <Reanimated.View entering={FadeInDown.duration(450)} style={st.hero}>
          <View style={st.heroRing} />
          <View style={st.heroRingInner} />
          <Text style={[st.heroStar, { top: 20, right: 34 }]}>✦</Text>
          <Text style={[st.heroStar, { bottom: 26, right: 96, fontSize: 9 }]}>✦</Text>

          <View style={st.logo}>
            <VrittaLogo size={30} />
          </View>
          <Text style={st.heroTitle}>{t("onboarding.title")}</Text>
          <Text style={st.heroText}>{t("onboarding.intro")}</Text>

          <View style={st.progressRow}>
            <View style={st.progressTrack}>
              <View style={[st.progressFill, { width: `${(filled / 6) * 100}%` }]} />
            </View>
            <Text style={st.progressText}>{filled}/6</Text>
          </View>
        </Reanimated.View>

        {/* About you */}
        <Reanimated.View entering={FadeInDown.delay(90).duration(420)} style={st.card}>
          <View style={st.cardHead}>
            <View style={st.cardIcon}>
              <MIcon name="account-outline" size={18} color={C.PLUM} />
            </View>
            <Text style={st.cardTitle}>{t("onboarding.aboutYou")}</Text>
          </View>

          <Text style={st.label}>{t("onboarding.name")}</Text>
          <View style={st.inputRow}>
            <MIcon name="account-outline" size={19} color={C.MUTED} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("onboarding.namePlaceholder")}
              placeholderTextColor={C.MUTED}
              style={st.inputText}
            />
          </View>

          <Text style={st.label}>{t("onboarding.gender")}</Text>
          <View style={st.segment}>
            {genders.map((option) => {
              const selected = gender === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setGender(option.value)}
                  style={[st.segmentItem, selected && st.segmentItemActive]}
                >
                  <MIcon name={option.icon} size={16} color={selected ? C.CARD : C.MUTED} />
                  <Text style={[st.segmentText, selected && st.segmentTextActive]} numberOfLines={1}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={st.label}>{t("onboarding.appLanguage")}</Text>
          <View style={st.langRow}>
            {languages.map((option) => {
              const selected = language === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setLanguage(option.value);
                    // Switch the app's text live (the form value above is what's saved).
                    void useLanguageStore.getState().setLanguage(option.value === "hi" ? "hi" : "en");
                  }}
                  style={[st.langCard, selected && st.langCardActive]}
                >
                  <View style={[st.glyph, selected && st.glyphActive]}>
                    <Text style={[st.glyphText, selected && { color: C.CARD }]}>{option.glyph}</Text>
                  </View>
                  <Text style={st.langText}>{option.label}</Text>
                  {selected && <MIcon name="check-circle" size={18} color={C.PLUM} />}
                </Pressable>
              );
            })}
          </View>
        </Reanimated.View>

        {/* Birth details */}
        <Reanimated.View entering={FadeInDown.delay(180).duration(420)} style={st.card}>
          <View style={st.cardHead}>
            <View style={st.cardIcon}>
              <MIcon name="star-four-points-outline" size={17} color={C.PLUM} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>{t("onboarding.birthDetails")}</Text>
              <Text style={st.cardSub}>{t("onboarding.birthDetailsSub")}</Text>
            </View>
          </View>

          {/* Place of Birth */}
          <Text style={st.label}>{t("onboarding.place")}</Text>
          <View style={st.inputRow}>
            <MIcon name="map-marker-outline" size={19} color={C.MUTED} />
            <TextInput
              value={placeOfBirth}
              onChangeText={(value) => {
                setPlaceOfBirth(value);
                if (selectedLocation && value !== formatPlaceLabel(selectedLocation)) {
                  setSelectedLocation(null);
                }
              }}
              placeholder={t("onboarding.placePlaceholder")}
              placeholderTextColor={C.MUTED}
              autoCorrect={false}
              autoCapitalize="words"
              style={st.inputText}
            />
            {searchingPlaces ? (
              <ActivityIndicator size="small" color={C.PLUM} />
            ) : selectedLocation ? (
              <MIcon name="check-circle" size={18} color={C.SUCCESS} />
            ) : null}
          </View>

          {!searchingPlaces && placeSuggestions.length > 0 && (
            <View style={st.suggestions}>
              {placeSuggestions.map((place, index) => (
                <Pressable
                  key={`${place.latitude}-${place.longitude}-${index}`}
                  onPress={() => handleSelectPlace(place)}
                  style={[st.suggestion, index < placeSuggestions.length - 1 && st.suggestionBorder]}
                >
                  <MIcon name="map-marker" size={16} color={C.GOLD} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.suggestionTitle}>{place.name}</Text>
                    <Text style={st.suggestionSub}>{formatPlaceSubtitle(place)}</Text>
                  </View>
                  <MIcon name="chevron-right" size={18} color={C.MUTED} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Date + Time */}
          <View style={st.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>{t("onboarding.date")}</Text>
              <Pressable
                onPress={() => {
                  setShowTimePicker(false);
                  setShowDatePicker(true);
                }}
                style={[st.inputRow, showDatePicker && st.inputRowActive]}
              >
                <MIcon name="calendar-month-outline" size={18} color={C.MUTED} />
                <Text style={[st.inputText, !dateOfBirth && { color: C.MUTED }]} numberOfLines={1}>
                  {dateOfBirth || t("onboarding.select")}
                </Text>
              </Pressable>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={st.label}>{t("onboarding.time")}</Text>
              <Pressable
                onPress={() => {
                  setShowDatePicker(false);
                  setShowTimePicker(true);
                }}
                style={[st.inputRow, showTimePicker && st.inputRowActive]}
              >
                <MIcon name="clock-outline" size={18} color={C.MUTED} />
                <Text style={[st.inputText, !displayTime && { color: C.MUTED }]} numberOfLines={1}>
                  {displayTime || t("onboarding.select")}
                </Text>
              </Pressable>
            </View>
          </View>

          {showDatePicker && (
            <View style={st.pickerContainer}>
              <DateTimePicker
                value={getDateValue()}
                mode="date"
                display="spinner"
                themeVariant="light"
                textColor={C.INK}
                maximumDate={new Date()}
                onChange={handleDateChange}
              />
              <Pressable onPress={() => setShowDatePicker(false)} style={st.pickerDone}>
                <Text style={st.pickerDoneText}>{t("common.done")}</Text>
              </Pressable>
            </View>
          )}

          {showTimePicker && (
            <View style={st.pickerContainer}>
              <DateTimePicker
                value={getTimeValue()}
                mode="time"
                display="spinner"
                themeVariant="light"
                textColor={C.INK}
                onChange={handleTimeChange}
              />
              <Pressable onPress={() => setShowTimePicker(false)} style={st.pickerDone}>
                <Text style={st.pickerDoneText}>{t("common.done")}</Text>
              </Pressable>
            </View>
          )}

          <View style={st.tip}>
            <MIcon name="information-outline" size={15} color={C.PLUM} />
            <Text style={st.tipText}>{t("onboarding.timeTip")}</Text>
          </View>
        </Reanimated.View>

        {/* Save */}
        <Reanimated.View entering={FadeInDown.delay(260).duration(420)}>
          <Pressable onPress={handleSave} disabled={saving} style={[st.save, saving && { opacity: 0.6 }]}>
            {saving ? (
              <ActivityIndicator color={C.CARD} />
            ) : (
              <>
                <Text style={st.saveText}>{t("common.continue")}</Text>
                <MIcon name="arrow-right" size={19} color={C.CARD} />
              </>
            )}
          </Pressable>
          <View style={st.footRow}>
            <MIcon name="shield-check-outline" size={14} color={C.MUTED} />
            <Text style={st.footText}>{t("onboarding.private")}</Text>
          </View>
        </Reanimated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const shadow = {
  shadowColor: "#2B1A3D",
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.LAVENDER },
  loading: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, gap: 14 },

  /* Welcome */
  hero: {
    padding: 20,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: C.PLUM,
    ...shadow,
    shadowOpacity: 0.22,
  },
  heroRing: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,253,252,0.12)",
  },
  heroRingInner: {
    position: "absolute",
    top: -34,
    right: -14,
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,253,252,0.16)",
  },
  heroStar: { position: "absolute", color: C.GOLD, fontSize: 13 },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,253,252,0.1)",
    borderWidth: 1,
    borderColor: "rgba(196,154,74,0.5)",
  },
  heroTitle: { marginTop: 14, fontSize: 26, fontWeight: "700", color: C.CARD, letterSpacing: -0.4 },
  heroText: { marginTop: 6, fontSize: 13.5, lineHeight: 20, color: "rgba(255,253,252,0.75)" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(255,253,252,0.15)", overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: C.GOLD },
  progressText: { fontSize: 12, fontWeight: "700", color: "#F3DFB4" },

  /* Cards */
  card: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    ...shadow,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.SOFT,
  },
  cardTitle: { fontSize: 15.5, fontWeight: "700", color: C.INK },
  cardSub: { marginTop: 1, fontSize: 11.5, color: C.MUTED },

  label: { marginTop: 14, marginBottom: 6, fontSize: 12, fontWeight: "600", color: C.INK },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#FBF9FC",
    borderWidth: 1,
    borderColor: C.LINE,
  },
  inputRowActive: { borderColor: C.PLUM, backgroundColor: C.CARD },
  inputText: { flex: 1, fontSize: 14, color: C.INK, paddingVertical: 0 },
  twoCol: { flexDirection: "row", gap: 10 },

  segment: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: 999,
    backgroundColor: "#F6F2F9",
    borderWidth: 1,
    borderColor: C.LINE,
  },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  segmentItemActive: { backgroundColor: C.PLUM },
  segmentText: { fontSize: 13.5, fontWeight: "600", color: C.MUTED },
  segmentTextActive: { color: C.CARD },

  langRow: { flexDirection: "row", gap: 10 },
  langCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 16,
    backgroundColor: "#FBF9FC",
    borderWidth: 1,
    borderColor: C.LINE,
  },
  langCardActive: { borderColor: C.PLUM, borderWidth: 1.5, backgroundColor: C.CARD },
  glyph: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F1E8",
  },
  glyphActive: { backgroundColor: C.PLUM },
  glyphText: { fontSize: 15, fontWeight: "700", color: C.PLUM },
  langText: { flex: 1, fontSize: 14, fontWeight: "700", color: C.INK },

  suggestions: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
    overflow: "hidden",
  },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: "#EFE9F2" },
  suggestionTitle: { fontSize: 13.5, fontWeight: "600", color: C.INK },
  suggestionSub: { marginTop: 1, fontSize: 11.5, color: C.MUTED },

  pickerContainer: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: "#FBF9FC",
    borderWidth: 1,
    borderColor: C.LINE,
    overflow: "hidden",
  },
  pickerDone: {
    alignSelf: "flex-end",
    margin: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.PLUM,
  },
  pickerDoneText: { fontSize: 13, fontWeight: "700", color: C.CARD },

  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: C.SOFT,
  },
  tipText: { flex: 1, fontSize: 12, color: C.INK },

  save: {
    height: 54,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.PLUM,
    ...shadow,
    shadowOpacity: 0.2,
  },
  saveText: { fontSize: 16, fontWeight: "700", color: C.CARD },
  footRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 },
  footText: { flexShrink: 1, fontSize: 12, color: C.MUTED },
});
