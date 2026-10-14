import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Image,
    ImageBackground,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    API_URL,
    authHeaders,
} from "../../../lib/auth";

import useProfilesStore from "../../../components/stores/profilesStore";
import { useUserStore } from "../../../components/stores/userStore";
import { useAvatarUpload } from "../../../components/utils/useAvatarUpload";

const EDIT_PROFILE_TOP = require(
  "../../../assets/images/profile/manage_profile.png"
);

const C = {
  INK: "#1C1820",
  PLUM: "#2B1A3D",
  TERRACOTTA: "#A94C36",
  GOLD: "#C49A4A",
  LAVENDER: "#F4F0F8",
  CARD: "#FFFDFC",
  MUTED: "#68616A",
  BORDER: "#D9CEC1",
};

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

  const [name, setName] = useState("");
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
      <ImageBackground
        source={EDIT_PROFILE_TOP}
        resizeMode="cover"
        style={styles.screenBackground}
        imageStyle={styles.screenBackgroundImage}
      >
        <View
          style={[
            styles.container,
            {
              paddingTop:
                insets.top + 50,
            },
          ]}
        >
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              No active profile found.
            </Text>

            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text
                style={styles.backButtonText}
              >
                Go Back
              </Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={EDIT_PROFILE_TOP}
      resizeMode="cover"
      style={styles.screenBackground}
      imageStyle={styles.screenBackgroundImage}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + 4,
          },
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            styles.content
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backIcon}
            >
              <Icon
                name="chevron-left"
                size={30}
                color={C.INK}
              />
            </Pressable>

            <View style={styles.headerText}>
              <Text style={styles.title}>
                Edit Profile
              </Text>

              <Text style={styles.subtitle}>
                Update your basic details
              </Text>
            </View>
          </View>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Pressable
              onPress={pickAndUpload}
              disabled={uploadingPhoto}
              style={styles.avatar}
            >
              {activeProfile?.avatar_url ? (
                <Image
                  source={{
                    uri: activeProfile.avatar_url,
                  }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {name
                    ? name
                        .charAt(0)
                        .toUpperCase()
                    : "H"}
                </Text>
              )}

              {uploadingPhoto && (
                <View
                  style={styles.avatarOverlay}
                >
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={pickAndUpload}
              disabled={uploadingPhoto}
              style={styles.cameraButton}
            >
              <Icon
                name="camera-outline"
                size={21}
                color="#FFFFFF"
              />
            </Pressable>
          </View>

          {/* Full Name */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Full Name
            </Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={C.MUTED}
              style={styles.input}
            />
          </View>

          {/* Gender */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Gender
            </Text>

            <View style={styles.optionRow}>
              {[
                {
                  value: "male",
                  label: "Male",
                },
                {
                  value: "female",
                  label: "Female",
                },
                {
                  value: "other",
                  label: "Other",
                },
              ].map((option) => {
                const selected =
                  gender === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setGender(
                        option.value
                      )
                    }
                    style={[
                      styles.option,
                      selected &&
                        styles.optionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selected &&
                          styles.optionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Marital Status */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Marital Status
            </Text>

            <View style={styles.optionRow}>
              {[
                "Married",
                "Single",
                "Other",
              ].map((option) => {
                const selected =
                  maritalStatus === option;

                return (
                  <Pressable
                    key={option}
                    onPress={() =>
                      setMaritalStatus(
                        option
                      )
                    }
                    style={[
                      styles.option,
                      selected &&
                        styles.optionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selected &&
                          styles.optionTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Birth Date */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Birth Date
            </Text>

            <Pressable
              onPress={() =>
                setShowDatePicker(true)
              }
              style={styles.inputButton}
            >
              <Icon
                name="calendar-month-outline"
                size={21}
                color={C.INK}
              />

              <Text
                style={
                  styles.inputButtonText
                }
              >
                {dateOfBirth ||
                  "Select birth date"}
              </Text>
            </Pressable>

            {showDatePicker && (
              <View
                style={
                  styles.pickerContainer
                }
              >
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="spinner"
                  themeVariant="light"
                  textColor={C.INK}
                  maximumDate={new Date()}
                  onChange={
                    handleDateChange
                  }
                />

                <Pressable
                  onPress={() =>
                    setShowDatePicker(false)
                  }
                  style={styles.pickerDone}
                >
                  <Text
                    style={
                      styles.pickerDoneText
                    }
                  >
                    Done
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Birth Time */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Birth Time
            </Text>

            <Pressable
              onPress={() =>
                setShowTimePicker(true)
              }
              style={styles.inputButton}
            >
              <Icon
                name="clock-outline"
                size={21}
                color={C.INK}
              />

              <Text
                style={
                  styles.inputButtonText
                }
              >
                {formatTime(timeOfBirth) ||
                  "Select birth time"}
              </Text>
            </Pressable>

            {showTimePicker && (
              <View
                style={
                  styles.pickerContainer
                }
              >
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  display="spinner"
                  themeVariant="light"
                  textColor={C.INK}
                  onChange={
                    handleTimeChange
                  }
                />

                <Pressable
                  onPress={() =>
                    setShowTimePicker(false)
                  }
                  style={styles.pickerDone}
                >
                  <Text
                    style={
                      styles.pickerDoneText
                    }
                  >
                    Done
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Birth Place */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Birth Place
            </Text>

            <View
              style={
                styles.placeInputWrapper
              }
            >
              <Icon
                name="map-marker-outline"
                size={22}
                color={C.INK}
              />

              <TextInput
                value={placeOfBirth}
                onChangeText={(value) => {
                  setPlaceOfBirth(value);
                  setLat("");
                  setLon("");
                  setTzone("");
                }}
                placeholder="Enter birth place"
                placeholderTextColor={
                  C.MUTED
                }
                style={styles.placeInput}
              />

              {searchingPlaces && (
                <ActivityIndicator
                  size="small"
                  color={C.PLUM}
                />
              )}
            </View>

            {placeSuggestions.length >
              0 && (
              <View
                style={styles.suggestions}
              >
                {placeSuggestions.map(
                  (place, index) => (
                    <Pressable
                      key={`${place.latitude}-${place.longitude}-${index}`}
                      onPress={() =>
                        selectPlace(place)
                      }
                      style={[
                        styles.suggestion,
                        index <
                          placeSuggestions.length -
                            1 &&
                          styles.suggestionBorder,
                      ]}
                    >
                      <View
                        style={{
                          flex: 1,
                        }}
                      >
                        <Text
                          style={
                            styles.suggestionTitle
                          }
                        >
                          {place.name}
                        </Text>

                        <Text
                          style={
                            styles.suggestionSub
                          }
                        >
                          {[
                            place.admin1,
                            place.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </Text>
                      </View>

                      <Icon
                        name="chevron-right"
                        size={23}
                        color={C.MUTED}
                      />
                    </Pressable>
                  )
                )}
              </View>
            )}
          </View>

          {/* Update */}
          <Pressable
            onPress={handleUpdate}
            disabled={saving}
            style={[
              styles.updateButton,
              saving &&
                styles.updateButtonDisabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <>
                <Text
                  style={
                    styles.updateButtonText
                  }
                >
                  Update Profile
                </Text>

                <Icon
                  name="arrow-right"
                  size={23}
                  color="#FFFFFF"
                />
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screenBackground: {
    flex: 1,
  },

  screenBackgroundImage: {
    width: "100%",
    height: "100%",
  },

  container: {
    flex: 1,
    backgroundColor: "transparent",
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  errorText: {
    color: C.INK,
    fontSize: 16,
    marginBottom: 20,
  },

  backButton: {
    backgroundColor: C.PLUM,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },

  backButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  header: {
    height: 68,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  backIcon: {
    width: 32,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },

  headerText: {
    flex: 1,
    alignItems: "center",
    paddingRight: 32,
  },

  title: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "700",
    color: C.INK,
  },

  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#938B9A",
  },

  avatarSection: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 10,
  },

  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E8DDF3",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarImage: {
    width: 80,
    height: 80,
  },

  avatarOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(43,26,61,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: 31,
    fontWeight: "600",
    color: C.PLUM,
  },

  cameraButton: {
    position: "absolute",
    bottom: -1,
    marginLeft: 55,
    width: 33,
    height: 33,
    borderRadius: 17,
    backgroundColor: C.PLUM,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  field: {
    marginTop: 9,
  },

  label: {
    marginBottom: 5,
    fontSize: 12,
    fontWeight: "500",
    color: C.INK,
  },

  input: {
    height: 40,
    borderWidth: 1,
    borderColor: "#E3DDE5",
    borderRadius: 10,
    backgroundColor:
      "rgba(255,255,255,0.72)",
    paddingHorizontal: 12,
    fontSize: 13,
    color: C.INK,
  },

  optionRow: {
    flexDirection: "row",
    gap: 8,
  },

  option: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    backgroundColor:
      "rgba(240,236,242,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },

  optionSelected: {
    backgroundColor: C.PLUM,
  },

  optionText: {
    fontSize: 12,
    color: C.INK,
  },

  optionTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  inputButton: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E3DDE5",
    borderRadius: 10,
    backgroundColor:
      "rgba(255,255,255,0.72)",
    paddingHorizontal: 11,
  },

  inputButtonText: {
    marginLeft: 10,
    fontSize: 13,
    color: C.INK,
  },

  pickerContainer: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.BORDER,
  },

  pickerDone: {
    height: 42,
    borderTopWidth: 1,
    borderTopColor: C.BORDER,
    alignItems: "center",
    justifyContent: "center",
  },

  pickerDoneText: {
    color: C.PLUM,
    fontWeight: "700",
    fontSize: 14,
  },

  placeInputWrapper: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E3DDE5",
    borderRadius: 10,
    backgroundColor:
      "rgba(255,255,255,0.72)",
    paddingHorizontal: 11,
  },

  placeInput: {
    flex: 1,
    height: 40,
    marginLeft: 9,
    fontSize: 13,
    color: C.INK,
  },

  suggestions: {
    marginTop: 5,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.BORDER,
    backgroundColor: C.CARD,
  },

  suggestion: {
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.BORDER,
  },

  suggestionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: C.INK,
  },

  suggestionSub: {
    marginTop: 2,
    fontSize: 11,
    color: C.MUTED,
  },

  updateButton: {
    height: 44,
    marginTop: 14,
    borderRadius: 11,
    backgroundColor: C.PLUM,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
  },

  updateButtonDisabled: {
    opacity: 0.65,
  },

  updateButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});