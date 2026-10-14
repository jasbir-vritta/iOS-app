import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useUserStore } from "../../components/stores/userStore";
import { API_URL, authHeaders } from "../../lib/auth";

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
        console.log(
          "Please fill all fields"
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

      let location =
        selectedLocation;

      /**
       * If the user typed a place but
       * didn't select a suggestion,
       * perform one final search.
       */
      if (
        !location ||
        formatPlaceLabel(location).toLowerCase() !==
          placeOfBirth
            .trim()
            .toLowerCase()
      ) {
        console.log(
          "Finding birth place:",
          placeOfBirth
        );

        const response =
          await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
              // The search matches city names only, so drop ", State".
              placeOfBirth.split(",")[0].trim()
            )}&count=1&language=en&format=json`
          );

        if (!response.ok) {
          throw new Error(
            "Failed to find birth place"
          );
        }

        const data =
          await response.json();

        if (
          !data.results ||
          data.results.length === 0
        ) {
          throw new Error(
            "Birth place not found"
          );
        }

        location =
          data.results[0];
      }

      console.log(
        "Location found:",
        location
      );

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
    } finally {
      setSaving(false);
    }
  };

  if (loadingUser) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F4F0F8]">
        <ActivityIndicator
          size="large"
          color="#2B1A3D"
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F4F0F8]"
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 55,
          paddingBottom: 120,
        }}
      >
        {/* Header */}
        <Text className="text-[36px] font-bold text-[#1C1820]">
          Welcome
        </Text>

        <Text className="mt-2 text-[16px] text-[#68616A]">
          Enter your birth details to get started.
        </Text>

        {/* Name */}
        <View className="mt-8">
          <Text className="mb-2 text-[15px] font-semibold text-[#1C1820]">
            Name
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor="#68616A"
            className="h-[56px] rounded-2xl border border-[#D9CEC1] bg-[#FFFDFC] px-4 text-[16px] text-[#1C1820]"
          />
        </View>

        {/* Gender */}
        <View className="mt-5">
          <Text className="mb-2 text-[15px] font-semibold text-[#1C1820]">
            Gender
          </Text>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() =>
                setGender("male")
              }
              className={`h-[56px] flex-1 items-center justify-center rounded-2xl border ${
                gender === "male"
                  ? "border-[#2B1A3D] bg-[#2B1A3D]"
                  : "border-[#D9CEC1] bg-[#FFFDFC]"
              }`}
            >
              <Text
                className={`text-[16px] font-semibold ${
                  gender === "male"
                    ? "text-white"
                    : "text-[#1C1820]"
                }`}
              >
                Male
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                setGender("female")
              }
              className={`h-[56px] flex-1 items-center justify-center rounded-2xl border ${
                gender === "female"
                  ? "border-[#2B1A3D] bg-[#2B1A3D]"
                  : "border-[#D9CEC1] bg-[#FFFDFC]"
              }`}
            >
              <Text
                className={`text-[16px] font-semibold ${
                  gender === "female"
                    ? "text-white"
                    : "text-[#1C1820]"
                }`}
              >
                Female
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Language */}
        <View className="mt-5">
          <Text className="mb-2 text-[15px] font-semibold text-[#1C1820]">
            Language
          </Text>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() =>
                setLanguage("en")
              }
              className={`h-[56px] flex-1 items-center justify-center rounded-2xl border ${
                language === "en"
                  ? "border-[#2B1A3D] bg-[#2B1A3D]"
                  : "border-[#D9CEC1] bg-[#FFFDFC]"
              }`}
            >
              <Text
                className={`text-[16px] font-semibold ${
                  language === "en"
                    ? "text-white"
                    : "text-[#1C1820]"
                }`}
              >
                English
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                setLanguage("hi")
              }
              className={`h-[56px] flex-1 items-center justify-center rounded-2xl border ${
                language === "hi"
                  ? "border-[#2B1A3D] bg-[#2B1A3D]"
                  : "border-[#D9CEC1] bg-[#FFFDFC]"
              }`}
            >
              <Text
                className={`text-[16px] font-semibold ${
                  language === "hi"
                    ? "text-white"
                    : "text-[#1C1820]"
                }`}
              >
                Hindi
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Place of Birth */}
        <View className="mt-5">
          <Text className="mb-2 text-[15px] font-semibold text-[#1C1820]">
            Place of Birth
          </Text>

          <TextInput
            value={placeOfBirth}
            onChangeText={(value) => {
              setPlaceOfBirth(value);

              if (
                selectedLocation &&
                value !==
                  formatPlaceLabel(selectedLocation)
              ) {
                setSelectedLocation(
                  null
                );
              }
            }}
            placeholder="Enter your place of birth"
            placeholderTextColor="#68616A"
            autoCorrect={false}
            autoCapitalize="words"
            className="h-[56px] rounded-2xl border border-[#D9CEC1] bg-[#FFFDFC] px-4 text-[16px] text-[#1C1820]"
          />

          {/* Place loading */}
          {searchingPlaces && (
            <View className="mt-2 rounded-2xl border border-[#D9CEC1] bg-[#FFFDFC] px-4 py-4">
              <View className="flex-row items-center">
                <ActivityIndicator
                  size="small"
                  color="#2B1A3D"
                />

                <Text className="ml-3 text-[15px] text-[#68616A]">
                  Finding places...
                </Text>
              </View>
            </View>
          )}

          {/* Place suggestions */}
          {!searchingPlaces &&
            placeSuggestions.length >
              0 && (
              <View className="mt-2 overflow-hidden rounded-2xl border border-[#D9CEC1] bg-[#FFFDFC]">
                {placeSuggestions.map(
                  (
                    place,
                    index
                  ) => (
                    <Pressable
                      key={`${place.latitude}-${place.longitude}-${index}`}
                      onPress={() =>
                        handleSelectPlace(
                          place
                        )
                      }
                      className={`px-4 py-4 ${
                        index !==
                        placeSuggestions.length -
                          1
                          ? "border-b border-[#D9CEC1]"
                          : ""
                      }`}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 pr-3">
                          <Text className="text-[17px] font-medium text-[#1C1820]">
                            {
                              place.name
                            }
                          </Text>

                          <Text className="mt-1 text-[14px] text-[#68616A]">
                            {formatPlaceSubtitle(
                              place
                            )}
                          </Text>
                        </View>

                        <Text className="text-[24px] text-[#68616A]">
                          ↗
                        </Text>
                      </View>
                    </Pressable>
                  )
                )}
              </View>
            )}
        </View>

        {/* Date of Birth */}
        <View className="mt-5">
          <Text className="mb-2 text-[15px] font-semibold text-[#1C1820]">
            Date of Birth
          </Text>

          <Pressable
            onPress={() =>
              setShowDatePicker(true)
            }
            className="h-[56px] justify-center rounded-2xl border border-[#D9CEC1] bg-[#FFFDFC] px-4"
          >
            <Text
              className={`text-[16px] ${
                dateOfBirth
                  ? "text-[#1C1820]"
                  : "text-[#68616A]"
              }`}
            >
              {dateOfBirth ||
                "Select date of birth"}
            </Text>
          </Pressable>

          {showDatePicker && (
            <View className="mt-3 overflow-hidden rounded-2xl border border-[#D9CEC1] bg-[#FFFDFC]">
              <DateTimePicker
                value={getDateValue()}
                mode="date"
                display="spinner"
                themeVariant="light"
                maximumDate={
                  new Date()
                }
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
                className="border-t border-[#D9CEC1] py-4"
              >
                <Text className="text-center text-[17px] font-semibold text-[#2B1A3D]">
                  Done
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Time of Birth */}
        <View className="mt-5">
          <Text className="mb-2 text-[15px] font-semibold text-[#1C1820]">
            Time of Birth
          </Text>

          <Pressable
            onPress={() =>
              setShowTimePicker(true)
            }
            className="h-[56px] justify-center rounded-2xl border border-[#D9CEC1] bg-[#FFFDFC] px-4"
          >
            <Text
              className={`text-[16px] ${
                displayTime
                  ? "text-[#1C1820]"
                  : "text-[#68616A]"
              }`}
            >
              {displayTime ||
                "Select time of birth"}
            </Text>
          </Pressable>

          {showTimePicker && (
            <View className="mt-3 overflow-hidden rounded-2xl border border-[#D9CEC1] bg-[#FFFDFC]">
              <DateTimePicker
                value={getTimeValue()}
                mode="time"
                display="spinner"
                themeVariant="light"
                textColor="#1C1820"
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
                className="border-t border-[#D9CEC1] py-4"
              >
                <Text className="text-center text-[17px] font-semibold text-[#2B1A3D]">
                  Done
                </Text>
              </Pressable>
            </View>
          )}

          <Text className="mt-2 text-[13px] text-[#68616A]">
            Select your exact birth time.
          </Text>
        </View>

        {/* Save */}
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className={`mt-8 h-[56px] items-center justify-center rounded-2xl ${
            saving
              ? "bg-[#68616A]"
              : "bg-[#2B1A3D]"
          }`}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-[17px] font-bold text-white">
              Save Details
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}