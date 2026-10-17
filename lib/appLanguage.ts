/**
 * The current app language, readable anywhere without importing i18next
 * (lib/auth sends it with every API call as X-App-Language, so the backend
 * returns its content in that language).
 */
let current = "en";

export const getAppLanguage = () => current;

export const setAppLanguageCode = (code: string) => {
  current = code || "en";
};
