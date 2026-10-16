import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from "react-native";

import { Text } from "../../../components/ui/BrandText";

import Reanimated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    API_URL,
    authHeaders,
} from "../../../lib/auth";

import useProfilesStore from "../../../components/stores/profilesStore";
import { useUserStore } from "../../../components/stores/userStore";
import { useAvatarUpload } from "../../../components/utils/useAvatarUpload";

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  TERRACOTTA: "#A94C36",
  GOLD: "#C49A4A",
  LAVENDER: "#F4F0F8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  BORDER: "#D9CEC1",
  LINE: "rgba(217,206,193,0.7)",
  SOFT: "#EFE8F7",
  SUCCESS: "#2E7D4F",
};

// Same choices as Add profile (the backend accepts only these).
const RELATIONS = ["Parent", "Child", "Spouse", "Partner", "Sibling", "In-Law", "Grandparent", "Grandchild", "Relative", "Friend", "Other"];

type PlaceResult = {
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  admin1?: string;
};

const formatDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

const parseDate = (value: string) => {
  const [day, month, year] = value.split("/").map(Number);

  if (!day || !month || !year) {
    return new Date();
  }

  return new Date(year, month - 1, day);
};

const formatTime = (time: string) => {
  if (!time) return "";

  const [hourString, minuteString] = time.split(":");

  const hour = Number(hourString);
  const minute = Number(minuteString);

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return time;
  }

  const meridiem = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;

  return `${hour12}:${String(minute).padStart(
    2,
    "0"
  )} ${meridiem}`;
};

export default function EditProfile() {
  const insets = useSafeAreaInsets();

  const user = useUserStore(
    (state) => state.user
  );

  const profiles = useProfilesStore(
    (state) => state.profiles
  );

  const updateProfileLocal =
    useProfilesStore(
      (state) => state.updateProfileLocal
    );

  // Manage Profiles opens a specific profile; otherwise edit the active one.
  const { profileId } = useLocalSearchParams<{
    profileId?: string;
  }>();

  const activeProfileId =
    profileId || user?.active_profile_id;

  const activeProfile = profiles.find(
    (profile) =>
      profile.profile_id === activeProfileId
  );

  const [saving, setSaving] = useState(false);

  const {
    uploading: uploadingPhoto,
    pickAndUpload,
  } = useAvatarUpload(activeProfileId);

  // The account's own profile is the first one; others are loved ones.
  const isOwnProfile = profiles[0]?.profile_id === activeProfileId;

  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [relationOpen, setRelationOpen] = useState(false);
  const [gender, setGender] = useState("");
  const [maritalStatus, setMaritalStatus] =
    useState("Single");
  const [dateOfBirth, setDateOfBirth] =
    useState("");
  const [timeOfBirth, setTimeOfBirth] =
    useState("");
  const [placeOfBirth, setPlaceOfBirth] =
    useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [tzone, setTzone] = useState("");

  const [showDatePicker, setShowDatePicker] =
    useState(false);

  const [showTimePicker, setShowTimePicker] =
    useState(false);

  const [
    placeSuggestions,
    setPlaceSuggestions,
  ] = useState<PlaceResult[]>([]);

  const [
    searchingPlaces,
    setSearchingPlaces,
  ] = useState(false);

  // Fill the form once per profile, so a photo upload (which updates the
  // stored profile) doesn't wipe edits that aren't saved yet.
  const loadedProfileId = useRef<string | null>(null);

  useEffect(() => {
    if (
      !activeProfile ||
      loadedProfileId.current === activeProfile.profile_id
    ) {
      return;
    }

    loadedProfileId.current = activeProfile.profile_id;

    setName(activeProfile.name || "");
    setRelation(activeProfile.relation || "");
    setGender(activeProfile.gender || "");

    setDateOfBirth(
      activeProfile.dateOfBirth || ""
    );

    setTimeOfBirth(
      activeProfile.timeOfBirth || ""
    );

    setPlaceOfBirth(
      activeProfile.placeOfBirth || ""
    );

    setLat(activeProfile.lat || "");
    setLon(activeProfile.lon || "");
    setTzone(activeProfile.tzone || "");
    setMaritalStatus(
      activeProfile.maritalStatus || "Single"
    );
  }, [activeProfile]);

  useEffect(() => {
    // The search matches city names only, so drop ", State".
    const query = placeOfBirth.split(",")[0].trim();

    // A place with coordinates was loaded or picked; only search
    // after the user types (typing clears lat/lon).
    if (query.length < 2 || lat) {
      setPlaceSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
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

        const data = await response.json();

        if (!data?.results) {
          setPlaceSuggestions([]);
          return;
        }

        setPlaceSuggestions(data.results);
      } catch (error) {
        console.error(
          "Place search failed:",
          error
        );
      } finally {
        setSearchingPlaces(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [placeOfBirth, lat]);

  const selectPlace = (
    place: PlaceResult
  ) => {
    setPlaceOfBirth(
      [place.name, place.admin1].filter(Boolean).join(", ")
    );
    setLat(String(place.latitude));
    setLon(String(place.longitude));
    setTzone(place.timezone || "");
    setPlaceSuggestions([]);
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

  const handleTimeChange = (
    event: any,
    selectedDate?: Date
  ) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }

    if (!selectedDate) {
      return;
    }

    const hours = selectedDate
      .getHours()
      .toString()
      .padStart(2, "0");

    const minutes = selectedDate
      .getMinutes()
      .toString()
      .padStart(2, "0");

    setTimeOfBirth(`${hours}:${minutes}`);
  };

  const selectedDate = useMemo(
    () => parseDate(dateOfBirth),
    [dateOfBirth]
  );

  const selectedTime = useMemo(() => {
    const [hour, minute] = timeOfBirth
      .split(":")
      .map(Number);

    const date = new Date();

    date.setHours(
      Number.isFinite(hour) ? hour : 12
    );

    date.setMinutes(
      Number.isFinite(minute) ? minute : 0
    );

    date.setSeconds(0);
    date.setMilliseconds(0);

    return date;
  }, [timeOfBirth]);

  const handleUpdate = async () => {
    if (!activeProfileId) {
      Alert.alert(
        "No profile selected",
        "Please select a profile and try again."
      );
      return;
    }

    if (
      !name.trim() ||
      !gender ||
      !dateOfBirth ||
      !timeOfBirth ||
      !placeOfBirth.trim()
    ) {
      Alert.alert(
        "Missing information",
        "Please fill in name, gender, birth date, birth time and birth place."
      );
      return;
    }

    // Coordinates come only from a picked suggestion.
    if (!lat || !lon) {
      Alert.alert(
        "Missing information",
        "Please search and select the birth place from the list."
      );
      return;
    }

    try {
      setSaving(true);

      const profileData = {
        name: name.trim(),
        gender,
        maritalStatus,
        // Loved ones only; left out when not chosen.
        ...(!isOwnProfile && relation ? { relation } : {}),
        dateOfBirth,
        timeOfBirth,
        placeOfBirth: placeOfBirth.trim(),
        lat,
        lon,
        tzone,
      };

      const response = await fetch(
        `${API_URL}/api/user/profiles/${activeProfileId}`,
        {
          method: "PUT",
          headers: await authHeaders(),
          body: JSON.stringify(profileData),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Failed to update profile"
        );
      }

      updateProfileLocal(
        activeProfileId,
        profileData
      );

      router.back();
    } catch (error) {
      console.error(
        "Failed to update profile:",
        error
      );

      Alert.alert(
        "Unable to update profile",
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!activeProfileId) {
    return (
      <View style={[styles.screen, styles.emptyScreen, { paddingTop: insets.top }]}>
        <View style={styles.emptyIcon}>
          <Icon name="account-question-outline" size={28} color={C.PLUM} />
        </View>
        <Text style={styles.emptyTitle}>No profile selected</Text>
        <Pressable onPress={() => router.back()} style={styles.emptyButton}>
          <Text style={styles.emptyButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const genders = [
    { value: "male", label: "Male", icon: "gender-male" },
    { value: "female", label: "Female", icon: "gender-female" },
    { value: "other", label: "Other", icon: "gender-non-binary" },
  ] as const;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton} accessibilityLabel="Go back">
          <Icon name="chevron-left" size={24} color={C.INK} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Edit profile</Text>
          <Text style={styles.subtitle}>
            {isOwnProfile ? "Update your details" : "Update their details"}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
      >
        {/* Photo, outside the cards */}
        <Reanimated.View entering={FadeInDown.duration(420)} style={styles.photoSection}>
          <View style={styles.photoWrap}>
            <Text style={[styles.photoStar, { top: 6, left: -18 }]}>✦</Text>
            <Text style={[styles.photoStar, { bottom: 14, right: -20, fontSize: 9 }]}>✦</Text>

            <Pressable
              onPress={pickAndUpload}
              disabled={uploadingPhoto}
              style={styles.avatarRing}
              accessibilityLabel="Change photo"
            >
              <View style={styles.avatar}>
                {activeProfile?.avatar_url ? (
                  <Image source={{ uri: activeProfile.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitial}>{name.trim()[0]?.toUpperCase() || "?"}</Text>
                )}
                {uploadingPhoto && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color={C.CARD} />
                  </View>
                )}
              </View>
              <View style={styles.cameraBadge}>
                <Icon name={activeProfile?.avatar_url ? "pencil" : "camera"} size={14} color={C.CARD} />
              </View>
            </Pressable>
          </View>

          <Text style={styles.photoName} numberOfLines={1}>
            {name.trim() || "Profile"}
          </Text>
          <Text style={styles.photoSub} numberOfLines={1}>
            {!isOwnProfile && relation ? `${relation} · ` : ""}
            {uploadingPhoto ? "Uploading photo…" : "Tap the photo to change it"}
          </Text>
        </Reanimated.View>

        {/* About */}
        <Reanimated.View entering={FadeInDown.delay(80).duration(420)} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardIcon}>
              <Icon name={isOwnProfile ? "account-outline" : "account-heart-outline"} size={18} color={C.PLUM} />
            </View>
            <Text style={styles.cardTitle}>{isOwnProfile ? "About you" : "About them"}</Text>
          </View>

          <Text style={styles.label}>Full name</Text>
          <View style={styles.inputRow}>
            <Icon name="account-outline" size={19} color={C.MUTED} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter full name"
              placeholderTextColor={C.MUTED}
              style={styles.inputText}
            />
          </View>

          {/* Relation: only for loved ones' profiles */}
          {!isOwnProfile && (
            <>
              <Text style={styles.label}>Relation</Text>
              <Pressable
                onPress={() => setRelationOpen((open) => !open)}
                style={[styles.inputRow, relationOpen && styles.inputRowActive]}
                accessibilityRole="button"
                accessibilityState={{ expanded: relationOpen }}
              >
                <Icon name="family-tree" size={19} color={C.MUTED} />
                <Text style={[styles.inputText, !relation && { color: C.MUTED }]}>{relation || "Select"}</Text>
                <Icon name={relationOpen ? "chevron-up" : "chevron-down"} size={20} color={C.MUTED} />
              </Pressable>

              {relationOpen && (
                <View style={styles.relationGrid}>
                  {RELATIONS.map((option) => {
                    const selected = relation === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => {
                          setRelation(option);
                          setRelationOpen(false);
                        }}
                        style={[styles.relationChip, selected && styles.chipSelected]}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}

          <Text style={styles.label}>Gender</Text>
          <View style={styles.segment}>
            {genders.map((option) => {
              const selected = gender === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setGender(option.value)}
                  style={[styles.segmentItem, selected && styles.segmentItemActive]}
                >
                  <Icon name={option.icon} size={15} color={selected ? C.CARD : C.MUTED} />
                  <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Marital status</Text>
          <View style={styles.segment}>
            {["Single", "Married", "Other"].map((option) => {
              const selected = maritalStatus === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setMaritalStatus(option)}
                  style={[styles.segmentItem, selected && styles.segmentItemActive]}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </Reanimated.View>

        {/* Birth details */}
        <Reanimated.View entering={FadeInDown.delay(160).duration(420)} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardIcon}>
              <Icon name="star-four-points-outline" size={17} color={C.PLUM} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Birth details</Text>
              <Text style={styles.cardSub}>Changing these updates the Kundli and horoscope</Text>
            </View>
          </View>

          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Date</Text>
              <Pressable
                onPress={() => {
                  setShowTimePicker(false);
                  setShowDatePicker(true);
                }}
                style={[styles.inputRow, showDatePicker && styles.inputRowActive]}
              >
                <Icon name="calendar-month-outline" size={18} color={C.MUTED} />
                <Text style={[styles.inputText, !dateOfBirth && { color: C.MUTED }]} numberOfLines={1}>
                  {dateOfBirth || "Select"}
                </Text>
              </Pressable>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Time</Text>
              <Pressable
                onPress={() => {
                  setShowDatePicker(false);
                  setShowTimePicker(true);
                }}
                style={[styles.inputRow, showTimePicker && styles.inputRowActive]}
              >
                <Icon name="clock-outline" size={18} color={C.MUTED} />
                <Text style={[styles.inputText, !timeOfBirth && { color: C.MUTED }]} numberOfLines={1}>
                  {formatTime(timeOfBirth) || "Select"}
                </Text>
              </Pressable>
            </View>
          </View>

          {showDatePicker && (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                themeVariant="light"
                textColor={C.INK}
                maximumDate={new Date()}
                onChange={handleDateChange}
              />
              <Pressable onPress={() => setShowDatePicker(false)} style={styles.pickerDone}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            </View>
          )}

          {showTimePicker && (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="spinner"
                themeVariant="light"
                textColor={C.INK}
                onChange={handleTimeChange}
              />
              <Pressable onPress={() => setShowTimePicker(false)} style={styles.pickerDone}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.label}>Place</Text>
          <View style={styles.inputRow}>
            <Icon name="map-marker-outline" size={19} color={C.MUTED} />
            <TextInput
              value={placeOfBirth}
              onChangeText={(value) => {
                setPlaceOfBirth(value);
                setLat("");
                setLon("");
                setTzone("");
              }}
              placeholder="Search city"
              placeholderTextColor={C.MUTED}
              style={styles.inputText}
            />
            {searchingPlaces ? (
              <ActivityIndicator size="small" color={C.PLUM} />
            ) : lat ? (
              <Icon name="check-circle" size={18} color={C.SUCCESS} />
            ) : null}
          </View>

          {placeSuggestions.length > 0 && (
            <View style={styles.suggestions}>
              {placeSuggestions.map((place, index) => (
                <Pressable
                  key={`${place.latitude}-${place.longitude}-${index}`}
                  onPress={() => selectPlace(place)}
                  style={[styles.suggestion, index < placeSuggestions.length - 1 && styles.suggestionBorder]}
                >
                  <Icon name="map-marker" size={16} color={C.GOLD} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionTitle}>{place.name}</Text>
                    <Text style={styles.suggestionSub}>
                      {[place.admin1, place.country].filter(Boolean).join(", ")}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={C.MUTED} />
                </Pressable>
              ))}
            </View>
          )}
        </Reanimated.View>

        {/* Save */}
        <Reanimated.View entering={FadeInDown.delay(240).duration(420)}>
          <Pressable
            onPress={handleUpdate}
            disabled={saving}
            style={[styles.updateButton, saving && styles.updateButtonDisabled]}
          >
            {saving ? (
              <ActivityIndicator color={C.CARD} />
            ) : (
              <>
                <Icon name="check" size={19} color={C.CARD} />
                <Text style={styles.updateButtonText}>Save changes</Text>
              </>
            )}
          </Pressable>
          <View style={styles.footRow}>
            <Icon name="shield-check-outline" size={14} color={C.MUTED} />
            <Text style={styles.footText}>Birth details stay private to your account</Text>
          </View>
        </Reanimated.View>
      </ScrollView>
    </View>
  );
}

const shadow = {
  shadowColor: "#2B1A3D",
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.LAVENDER },

  /* No profile */
  emptyScreen: { alignItems: "center", justifyContent: "center", gap: 12 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.SOFT,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.INK },
  emptyButton: { height: 44, paddingHorizontal: 22, borderRadius: 999, justifyContent: "center", backgroundColor: C.PLUM },
  emptyButtonText: { fontSize: 14, fontWeight: "700", color: C.CARD },

  /* Header */
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.LINE,
  },
  title: { fontSize: 21, fontWeight: "700", color: C.INK, letterSpacing: -0.3 },
  subtitle: { marginTop: 1, fontSize: 12.5, color: C.MUTED },

  content: { paddingHorizontal: 16, gap: 14 },

  /* Photo */
  photoSection: { alignItems: "center", paddingTop: 4, paddingBottom: 2 },
  photoWrap: { alignItems: "center", justifyContent: "center" },
  photoStar: { position: "absolute", color: C.GOLD, fontSize: 13 },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    padding: 4,
    borderWidth: 1.5,
    borderColor: "rgba(196,154,74,0.75)",
    backgroundColor: C.CARD,
    ...shadow,
  },
  avatar: {
    flex: 1,
    borderRadius: 48,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.SOFT,
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: { fontSize: 36, fontWeight: "700", color: C.PLUM },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(43,26,61,0.45)",
  },
  cameraBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.PLUM,
    borderWidth: 3,
    borderColor: C.LAVENDER,
  },
  photoName: { marginTop: 12, fontSize: 18, fontWeight: "700", color: C.INK },
  photoSub: { marginTop: 2, fontSize: 12.5, color: C.MUTED },

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

  /* Relation chips */
  relationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  relationChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FBF9FC",
    borderWidth: 1,
    borderColor: C.LINE,
  },
  chipSelected: { backgroundColor: C.PLUM, borderColor: C.PLUM },
  chipText: { fontSize: 13, fontWeight: "600", color: C.INK },
  chipTextSelected: { color: C.CARD },

  /* Gender / marital segments */
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
    height: 38,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  segmentItemActive: { backgroundColor: C.PLUM },
  segmentText: { fontSize: 13, fontWeight: "600", color: C.MUTED },
  segmentTextActive: { color: C.CARD },

  /* Date / time pickers */
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

  /* City suggestions */
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

  /* Save */
  updateButton: {
    height: 52,
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: C.PLUM,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shadow,
    shadowOpacity: 0.2,
  },
  updateButtonDisabled: { opacity: 0.6 },
  updateButtonText: { color: C.CARD, fontSize: 15, fontWeight: "700" },

  footRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 },
  footText: { fontSize: 12, color: C.MUTED },
});
