import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert } from "react-native";

import { API_URL, authHeaders } from "../../lib/auth";
import useProfilesStore from "../stores/profilesStore";

// Same limit as the backend (services/storage.py).
const MAX_BYTES = 5 * 1024 * 1024;

export type PickedPhoto = ImagePicker.ImagePickerAsset;

/** Let the user pick and crop a square photo. Null if cancelled or too large. */
export async function pickAvatarImage(): Promise<PickedPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    // Edited photos are saved as JPEG; this keeps them well under the limit.
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];

  if (asset.fileSize && asset.fileSize > MAX_BYTES) {
    Alert.alert("Photo too large", "Please choose a photo under 5 MB.");
    return null;
  }

  return asset;
}

/**
 * Upload a photo for a profile. The backend stores it in the bucket and
 * saves the URL as the profile's `avatar_url` (also shown on the
 * leaderboard). Returns that URL; throws with a readable message.
 */
export async function uploadAvatar(profileId: string, photo: PickedPhoto): Promise<string> {
  const form = new FormData();
  // SDK 57's global fetch (expo/fetch) needs an expo-file-system File here;
  // the old React Native { uri, name, type } object is not supported.
  form.append("file", new File(photo.uri));

  // Let fetch set the multipart Content-Type (with its boundary).
  const { "Content-Type": _json, ...headers } = await authHeaders();

  const response = await fetch(`${API_URL}/api/user/profiles/${profileId}/avatar`, {
    method: "POST",
    headers,
    body: form,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string" ? data.detail : "Could not upload the photo. Please try again.",
    );
  }

  useProfilesStore.getState().updateProfileLocal(profileId, { avatar_url: data.avatar_url });

  return data.avatar_url;
}

/** Pick a photo and upload it straight away for an existing profile. */
export function useAvatarUpload(profileId?: string | null) {
  const [uploading, setUploading] = useState(false);

  const pickAndUpload = async () => {
    if (!profileId || uploading) return;

    const photo = await pickAvatarImage();
    if (!photo) return;

    try {
      setUploading(true);
      await uploadAvatar(profileId, photo);
    } catch (error) {
      console.error("Avatar upload failed:", error);
      Alert.alert(
        "Unable to update photo",
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  return { uploading, pickAndUpload };
}
