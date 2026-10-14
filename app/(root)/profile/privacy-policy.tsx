import { PRIVACY_POLICY } from "../../../components/constants/legal";
import { LegalDocumentScreen } from "../../../components/legal/LegalDocumentScreen";

export default function PrivacyPolicy() {
  return (
    <LegalDocumentScreen
      document={PRIVACY_POLICY}
      icon="shield-check-outline"
      accent={{ tint: "#E6DDF4", color: "#2B1A3D" }}
    />
  );
}
