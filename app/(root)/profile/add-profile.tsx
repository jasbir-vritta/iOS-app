import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import {
    pickAvatarImage,
    uploadAvatar,
    type PickedPhoto,
} from "../../../components/utils/useAvatarUpload";

const MANAGE_PROFILE_BG = require(
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
  const day = String(date.getDate()).padStart(
    2,
    "0"
  );

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

const formatTime = (date: Date) => {
  const hours = String(
    date.getHours()
  ).padStart(2, "0");

  const minutes = String(
    date.getMinutes()
  ).padStart(2, "0");

  return `${hours}:${minutes}`;
};

// "DD/MM/YYYY" -> Date (today if empty), to open the picker on the chosen day.
const parseDate = (value: string) => {
  const [day, month, year] = value.split("/").map(Number);

  if (!day || !month || !year) {
    return new Date();
  }

  return new Date(year, month - 1, day);
};

const formatDisplayTime = (
  value: string
) => {
  if (!value) {
    return "";
  }

  const [hourString, minuteString] =
    value.split(":");

  const hour = Number(hourString);
  const minute = Number(minuteString);

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return value;
  }

  const meridiem =
    hour >= 12 ? "PM" : "AM";

  const hour12 = hour % 12 || 12;

  return `${hour12}:${String(minute).padStart(
    2,
    "0"
  )} ${meridiem}`;
};

export default function AddProfile() {
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");

  const [gender, setGender] =
    useState("male");

  const [maritalStatus, setMaritalStatus] =
    useState("Single");

  const [dateOfBirth, setDateOfBirth] =
    useState("");

  const [timeOfBirth, setTimeOfBirth] =
    useState("");

  const [showDatePicker, setShowDatePicker] =
    useState(false);

  const [showTimePicker, setShowTimePicker] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  // Uploaded right after the profile is created.
  const [photo, setPhoto] =
    useState<PickedPhoto | null>(null);

  const [placeOfBirth, setPlaceOfBirth] =
    useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [tzone, setTzone] = useState("");

  const [placeSuggestions, setPlaceSuggestions] =
    useState<PlaceResult[]>([]);

  const [searchingPlaces, setSearchingPlaces] =
    useState(false);

  useEffect(() => {
    // The search matches city names only, so drop ", State".
    const query = placeOfBirth.split(",")[0].trim();

    // Once a place is picked it has coordinates; only search
    // after the user types again (typing clears lat/lon).
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

        setPlaceSuggestions(data?.results || []);
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

    if (selectedDate) {
      setTimeOfBirth(
        formatTime(selectedDate)
      );
    }
  };

  // Pickers open on the value already chosen (like Edit Profile).
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

  const handleCreateProfile =
    async () => {
      if (!name.trim()) {
        Alert.alert(
          "Missing information",
          "Please enter the full name."
        );
        return;
      }

      if (!gender) {
        Alert.alert(
          "Missing information",
          "Please select gender."
        );
        return;
      }

      if (!dateOfBirth) {
        Alert.alert(
          "Missing information",
          "Please select the birth date."
        );
        return;
      }

      if (!timeOfBirth) {
        Alert.alert(
          "Missing information",
          "Please select the birth time."
        );
        return;
      }

      // Coordinates come only from a picked suggestion, so cities
      // with the same name can't be mixed up.
      if (!placeOfBirth.trim() || !lat || !lon) {
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
          language: "en",
          lat,
          lon,
          tzone,
        };

        console.log(
          "Creating profile:",
          profileData
        );

        const response = await fetch(
          `${API_URL}/api/user/profiles`,
          {
            method: "POST",
            headers: await authHeaders(),
            body: JSON.stringify(
              profileData
            ),
          }
        );

        const data =
          await response.json();

        // Extra profiles cost credits (the first ones are free).
        if (response.status === 402) {
          Alert.alert(
            "Add funds",
            typeof data?.detail === "string"
              ? data.detail
              : "Please add funds to your wallet to create another profile.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Add Funds",
                onPress: () => router.push("/wallet"),
              },
            ]
          );
          return;
        }

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              data?.message ||
              "Failed to create profile"
          );
        }

        console.log(
          "Profile created:",
          data
        );

        const newProfileId =
          data?.profile?.profile_id;

        if (typeof data?.credits === "number") {
          useUserStore
            .getState()
            .updateUser({ credits: data.credits });
        }

        if (photo && newProfileId) {
          try {
            await uploadAvatar(
              newProfileId,
              photo
            );
          } catch (photoError) {
            console.error(
              "Failed to upload photo:",
              photoError
            );

            Alert.alert(
              "Profile created",
              "We couldn't upload the photo. You can add it later from Edit Profile."
            );
          }
        }

        try {
          await useProfilesStore
            .getState()
            .fetchProfiles();
        } catch (refreshError) {
          console.error(
            "Failed to refresh profiles:",
            refreshError
          );
        }

        router.back();
      } catch (error) {
        console.error(
          "Failed to create profile:",
          error
        );

        Alert.alert(
          "Unable to create profile",
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again."
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <ImageBackground
      source={MANAGE_PROFILE_BG}
      resizeMode="cover"
      style={styles.screenBackground}
      imageStyle={
        styles.screenBackgroundImage
      }
    >
      <View
        style={[
          styles.container,
          {
            paddingTop:
              insets.top + 4,
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
              style={styles.backButton}
            >
              <Icon
                name="chevron-left"
                size={30}
                color={C.INK}
              />
            </Pressable>

            <View
              style={styles.headerText}
            >
              <Text style={styles.title}>
                Add New Profile
              </Text>

              <Text
                style={styles.subtitle}
              >
                Create a new profile for family
                or loved ones.
              </Text>
            </View>

            <View
              style={styles.headerSpacer}
            />
          </View>

          {/* Profile Avatar */}
          <View
            style={styles.avatarSection}
          >
            <Pressable
              onPress={async () => {
                const picked =
                  await pickAvatarImage();

                if (picked) {
                  setPhoto(picked);
                }
              }}
              disabled={saving}
              style={styles.avatar}
            >
              {photo ? (
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.avatarImage}
                />
              ) : (
                <Icon
                  name="camera"
                  size={28}
                  color={C.PLUM}
                />
              )}
            </Pressable>

            <View
              style={styles.avatarSparkleLeft}
            >
              <Text
                style={
                  styles.sparkleText
                }
              >
                ✦
              </Text>
            </View>

            <View
              style={styles.avatarSparkleRight}
            >
              <Text
                style={
                  styles.sparkleText
                }
              >
                ✦
              </Text>
            </View>
          </View>

          {/* Full Name */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Full Name
            </Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter name"
              placeholderTextColor={C.MUTED}
              style={styles.input}
              returnKeyType="next"
            />
          </View>

          {/* Gender */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Gender
            </Text>

            <View
              style={styles.optionRow}
            >
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
                  gender ===
                  option.value;

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

            <View
              style={styles.optionRow}
            >
              {[
                "Married",
                "Single",
                "Other",
              ].map((option) => {
                const selected =
                  maritalStatus ===
                  option;

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
              style={
                styles.inputButton
              }
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
                    setShowDatePicker(
                      false
                    )
                  }
                  style={
                    styles.pickerDone
                  }
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
              style={
                styles.inputButton
              }
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
                {formatDisplayTime(
                  timeOfBirth
                ) || "Select birth time"}
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
                    setShowTimePicker(
                      false
                    )
                  }
                  style={
                    styles.pickerDone
                  }
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
              style={styles.placeInputWrapper}
            >
              <Icon
                name="map-marker-outline"
                size={21}
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
                placeholder="Search city"
                placeholderTextColor={C.MUTED}
                style={styles.placeInput}
              />

              {searchingPlaces && (
                <ActivityIndicator
                  size="small"
                  color={C.PLUM}
                />
              )}
            </View>

            {placeSuggestions.length > 0 && (
              <View style={styles.suggestions}>
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
                          placeSuggestions.length - 1 &&
                          styles.suggestionBorder,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
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
                        size={21}
                        color={C.MUTED}
                      />
                    </Pressable>
                  )
                )}
              </View>
            )}
          </View>

          {/* Create */}
          <Pressable
            onPress={
              handleCreateProfile
            }
            disabled={saving}
            style={[
              styles.createButton,
              saving &&
                styles.createButtonDisabled,
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
                    styles.createButtonText
                  }
                >
                  Create Profile
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
    paddingBottom: 34,
  },

  /*
   * Header
   */
  header: {
    height: 70,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  backButton: {
    width: 34,
    height: 42,
    alignItems: "flex-start",
    justifyContent: "center",
  },

  headerText: {
    flex: 1,
    alignItems: "center",
    paddingRight: 2,
  },

  headerSpacer: {
    width: 34,
  },

  title: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "700",
    color: C.INK,
  },

  subtitle: {
    marginTop: 2,
    fontSize: 11,
    color: "#837987",
    textAlign: "center",
  },

  /*
   * Avatar
   */
  avatarSection: {
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 10,
  },

  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#E9DDF2",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarImage: {
    width: 68,
    height: 68,
  },

  avatarSparkleLeft: {
    position: "absolute",
    marginLeft: -96,
    marginTop: -25,
  },

  avatarSparkleRight: {
    position: "absolute",
    marginLeft: 96,
    marginTop: -25,
  },

  sparkleText: {
    fontSize: 15,
    color: "#E9A46D",
  },

  /*
   * Fields
   */
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

  /*
   * Gender / Marital Status
   */
  optionRow: {
    flexDirection: "row",
    gap: 8,
  },

  option: {
    flex: 1,
    height: 37,
    borderRadius: 9,
    backgroundColor:
      "rgba(239,235,241,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },

  optionSelected: {
    backgroundColor: C.PLUM,
  },

  optionText: {
    fontSize: 11,
    color: C.INK,
  },

  optionTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  /*
   * Date / Time
   */
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

  /*
   * Birth place
   */
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
    borderRadius: 9,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.BORDER,
    backgroundColor: C.CARD,
  },

  suggestion: {
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.BORDER,
  },

  suggestionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: C.INK,
  },

  suggestionSub: {
    marginTop: 2,
    fontSize: 10.5,
    color: C.MUTED,
  },

  /*
   * Create button
   */
  createButton: {
    height: 43,
    marginTop: 12,
    borderRadius: 11,
    backgroundColor: C.PLUM,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  createButtonDisabled: {
    opacity: 0.55,
  },

  createButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});