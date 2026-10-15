import { SvgXml } from "react-native-svg";

// The Vritta mark from the login design (gold arc, stars, terracotta sun,
// ivory petals).
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 12 88 98" fill="none"><path d="M75.7 18.8 A46 46 0 0 0 14 62 A46 46 0 0 0 44.3 105.2" stroke="#C49A4A" stroke-width="2.6" stroke-linecap="round" fill="none"/><circle cx="25.8" cy="31.2" r="3.4" fill="#C49A4A"/><path d="M50 22 Q51.8 32.2 58 34 Q51.8 35.8 50 46 Q48.2 35.8 42 34 Q48.2 32.2 50 22Z" fill="#C49A4A"/><circle cx="86" cy="30" r="8" fill="#A94C36"/><path d="M25 45 C44 40 58 62 58 100 C50 82 42 64 31 55 Q23 50 25 45Z" fill="#FFFDFC"/><path d="M58 100 C62 74 76 52 94 44 C90 62 76 84 58 100Z" fill="#FFFDFC"/></svg>`;

export function VrittaLogo({ size = 30 }: { size?: number }) {
  return <SvgXml xml={LOGO} width={size} height={size * (98 / 88)} />;
}
