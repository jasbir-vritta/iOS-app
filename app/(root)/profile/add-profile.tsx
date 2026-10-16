import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import {
    pickAvatarImage,
    uploadAvatar,
    type PickedPhoto,
} from "../../../components/utils/useAvatarUpload";

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

// "Relation" choices (the backend accepts only these).
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

  const [relation, setRelation] = useState("");
  const [relationOpen, setRelationOpen] = useState(false);

  // Price of a new profile, from the backend (shown on the button).
  const [pricing, setPricing] = useState<{ price: number; oldPrice: number; charged: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_URL}/api/user/profiles`, { headers: await authHeaders() });
        const data = await response.json();
        if (!response.ok || cancelled) return;
        const count = Array.isArray(data?.profiles) ? data.profiles.length : 0;
        const free = Number(data?.free_profiles ?? 2);
        const max = Number(data?.max_profiles) || 0;
        // Already has the one extra profile: say so before the form is filled in.
        if (max && count >= max) {
          Alert.alert(
            "Profile limit reached",
            "You can add only one profile besides your own. Delete it in Manage profiles to add someone else.",
            [{ text: "OK", onPress: () => router.back() }]
          );
          return;
        }
        setPricing({
          price: Number(data?.profile_price) || 0,
          oldPrice: Number(data?.profile_old_price) || 0,
          charged: count >= free,
        });
      } catch {
        // Price stays hidden; the backend still decides when saving.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

      if (!relation) {
        Alert.alert(
          "Missing information",
          "Please select the relation."
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
          relation,
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

        // Only one profile besides the user's own.
        if (response.status === 403) {
          Alert.alert(
            "Profile limit reached",
            typeof data?.detail === "string"
              ? data.detail
              : "You can add only one profile besides your own.",
            [{ text: "OK", onPress: () => router.back() }]
          );
          return;
        }

        // A new profile costs credits.
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

  const genders = [
    { value: "male", label: "Male", icon: "gender-male" },
    { value: "female", label: "Female", icon: "gender-female" },
    { value: "other", label: "Other", icon: "gender-non-binary" },
  ] as const;

  const charged = Boolean(pricing?.charged && pricing.price > 0);

  // "81% OFF" from the crossed-out price.
  const offPercent =
    pricing && pricing.oldPrice > pricing.price
      ? Math.round((1 - pricing.price / pricing.oldPrice) * 100)
      : 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton} accessibilityLabel="Go back">
          <Icon name="chevron-left" size={24} color={C.INK} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Add a loved one</Text>
          <Text style={styles.subtitle}>Their Kundli, horoscope and reports in one place</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
      >
        {/* Photo (outside the cards), name and price */}
        <Reanimated.View entering={FadeInDown.duration(420)} style={styles.photoSection}>
          <View style={styles.photoWrap}>
            <Text style={[styles.photoStar, { top: 6, left: -18 }]}>✦</Text>
            <Text style={[styles.photoStar, { bottom: 14, right: -20, fontSize: 9 }]}>✦</Text>

            <Pressable
              onPress={async () => {
                const picked = await pickAvatarImage();
                if (picked) setPhoto(picked);
              }}
              disabled={saving}
              style={styles.avatarRing}
              accessibilityLabel="Add a photo"
            >
              <View style={styles.avatar}>
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={styles.avatarImage} />
                ) : name.trim() ? (
                  <Text style={styles.avatarInitial}>{name.trim()[0].toUpperCase()}</Text>
                ) : (
                  <Icon name="camera-plus-outline" size={30} color={C.PLUM} />
                )}
              </View>
              <View style={styles.cameraBadge}>
                <Icon name={photo ? "pencil" : "plus"} size={14} color={C.CARD} />
              </View>
            </Pressable>
          </View>

          <Text style={styles.photoName} numberOfLines={1}>
            {name.trim() || "New profile"}
          </Text>
          <Text style={styles.photoSub} numberOfLines={1}>
            {relation ? `${relation} · ` : ""}
            {photo ? "Tap the photo to change it" : "Add a photo (optional)"}
          </Text>

          {pricing && (
            <View style={styles.pricePill}>
              {charged ? (
                <>
                  {pricing.oldPrice > pricing.price && <Text style={styles.pillOld}>₹{pricing.oldPrice}</Text>}
                  <Text style={styles.pillText}>₹{pricing.price} one-time</Text>
                  {offPercent > 0 && (
                    <View style={styles.offBadge}>
                      <Text style={styles.offText}>{offPercent}% OFF</Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.pillText}>Free profile</Text>
              )}
            </View>
          )}
        </Reanimated.View>

        {/* About them */}
        <Reanimated.View entering={FadeInDown.delay(80).duration(420)} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardIcon}>
              <Icon name="account-heart-outline" size={18} color={C.PLUM} />
            </View>
            <Text style={styles.cardTitle}>About them</Text>
          </View>

          {/* Full Name */}
          <Text style={styles.label}>Full name</Text>
          <View style={styles.inputRow}>
            <Icon name="account-outline" size={19} color={C.MUTED} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter full name"
              placeholderTextColor={C.MUTED}
              style={styles.inputText}
              returnKeyType="next"
            />
          </View>

          {/* Relation */}
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

          {/* Gender */}
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

          {/* Marital Status */}
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
              <Text style={styles.cardSub}>The exact time and place make the Kundli accurate</Text>
            </View>
          </View>

          {/* Birth Date + Time */}
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
                  {formatDisplayTime(timeOfBirth) || "Select"}
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

          {/* Birth Place */}
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

        {/* Create */}
        <Reanimated.View entering={FadeInDown.delay(240).duration(420)}>
          <Pressable
            onPress={handleCreateProfile}
            disabled={saving}
            style={[styles.createButton, saving && styles.createButtonDisabled]}
          >
            {saving ? (
              <ActivityIndicator color={C.CARD} />
            ) : (
              <>
                <Text style={styles.createButtonText}>
                  {charged ? `Create profile · ₹${pricing!.price}` : "Create profile"}
                </Text>
                <Icon name="arrow-right" size={19} color={C.CARD} />
              </>
            )}
          </Pressable>

          <View style={styles.priceRow}>
            <Icon name="shield-check-outline" size={14} color={C.MUTED} />
            {charged ? (
              <Text style={styles.priceNote}>
                {pricing!.oldPrice > pricing!.price && <Text style={styles.priceOld}>₹{pricing!.oldPrice}</Text>}
                {pricing!.oldPrice > pricing!.price ? " " : ""}
                <Text style={styles.priceNow}>₹{pricing!.price}</Text>
                {offPercent > 0 ? <Text style={styles.priceOff}>{` (${offPercent}% off)`}</Text> : ""} one-time, from
                your wallet
              </Text>
            ) : (
              <Text style={styles.priceNote}>Birth details stay private to your account</Text>
            )}
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

  /* Photo + price */
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
  pricePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F6EEDD",
    borderWidth: 1,
    borderColor: "rgba(196,154,74,0.45)",
  },
  offBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#E6F2EA",
  },
  offText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3, color: "#2E7D4F" },
  pillOld: { fontSize: 11.5, color: C.MUTED, textDecorationLine: "line-through" },
  pillText: { fontSize: 12, fontWeight: "700", color: "#7A5A1E" },

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

  /* Create */
  createButton: {
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
  createButtonDisabled: { opacity: 0.6 },
  createButtonText: { color: C.CARD, fontSize: 15, fontWeight: "700" },

  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 },
  priceNote: { fontSize: 12, color: C.MUTED },
  priceOld: { color: C.MUTED, textDecorationLine: "line-through" },
  priceNow: { color: C.PLUM, fontWeight: "700" },
  priceOff: { color: "#2E7D4F", fontWeight: "700" },
});
