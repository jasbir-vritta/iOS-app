import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_URL ="https://feature-backend-570395865015.asia-south1.run.app";

const ACCESS_TOKEN_KEY = "access_token";
const PHONE_KEY = "user_phone";

type AuthHeaders = {
  "Content-Type": string;
  Authorization?: string;
};

/**
 * Save the backend authentication session.
 */
export async function saveSession(
  accessToken: string,
  phone?: string
) {
  if (accessToken) {
    await AsyncStorage.setItem(
      ACCESS_TOKEN_KEY,
      accessToken
    );
  }

  if (phone) {
    await AsyncStorage.setItem(
      PHONE_KEY,
      phone
    );
  }
}

/**
 * Get the stored backend access token.
 */
export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(
    ACCESS_TOKEN_KEY
  );
}

/**
 * Get the stored phone number.
 */
export async function getPhone(): Promise<string | null> {
  return AsyncStorage.getItem(PHONE_KEY);
}

/**
 * Get the complete stored session.
 */
export async function getSession() {
  const [accessToken, phone] =
    await Promise.all([
      AsyncStorage.getItem(
        ACCESS_TOKEN_KEY
      ),
      AsyncStorage.getItem(PHONE_KEY),
    ]);

  return {
    accessToken,
    phone,
  };
}

/**
 * Check whether a user currently has
 * a stored authentication session.
 */
export async function isAuthenticated(): Promise<boolean> {
  const accessToken =
    await getAccessToken();

  return !!accessToken;
}

/**
 * Clear the local authentication session.
 */
export async function clearSession() {
  await AsyncStorage.multiRemove([
    ACCESS_TOKEN_KEY,
    PHONE_KEY,
  ]);
}

/**
 * Create headers for authenticated API requests.
 *
 * IMPORTANT:
 * This function is async.
 *
 * Always use:
 *
 * const headers = await authHeaders();
 *
 * Then:
 *
 * headers
 */
export async function authHeaders(): Promise<AuthHeaders> {
  const token =
    await getAccessToken();

  if (!token) {
    console.warn(
      "authHeaders: No access token found"
    );

    return {
      "Content-Type":
        "application/json",
    };
  }

  return {
    "Content-Type":
      "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Login or signup using phone number.
 *
 * Backend:
 * POST /api/auth/auth
 *
 * Body:
 * {
 *   phoneNumber: "+919876543210"
 * }
 */
export async function loginOrSignup(
  phoneNumber: string
) {
  const response = await fetch(
    `${API_URL}/api/auth/auth`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        phoneNumber,
      }),
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        "Authentication failed"
    );
  }

  if (!data?.access_token) {
    throw new Error(
      "Authentication succeeded but no access token was returned."
    );
  }

  await saveSession(
    data.access_token,
    phoneNumber
  );

  return data;
}