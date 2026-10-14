
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "@report_journey_incomplete_";

function getStorageKey(profileId: string): string {
  return `${STORAGE_PREFIX}${profileId}`;
}

export async function getIncompleteReportIds(
  profileId: string
): Promise<string[]> {
  if (!profileId) return [];

  try {
    const value = await AsyncStorage.getItem(getStorageKey(profileId));
    const ids: unknown = value ? JSON.parse(value) : [];

    return Array.isArray(ids)
      ? [...new Set(ids.filter((id): id is string => typeof id === "string"))]
      : [];
  } catch (error) {
    console.error("Failed to read incomplete reports:", error);
    return [];
  }
}

export async function addIncompleteReport(
  profileId: string,
  reportId: string
): Promise<void> {
  if (!profileId || !reportId) return;

  const ids = await getIncompleteReportIds(profileId);

  if (!ids.includes(reportId)) {
    await AsyncStorage.setItem(
      getStorageKey(profileId),
      JSON.stringify([...ids, reportId])
    );
  }
}

export async function removeIncompleteReport(
  profileId: string,
  reportId: string
): Promise<void> {
  if (!profileId || !reportId) return;

  const ids = await getIncompleteReportIds(profileId);

  await AsyncStorage.setItem(
    getStorageKey(profileId),
    JSON.stringify(ids.filter((id) => id !== reportId))
  );
}
