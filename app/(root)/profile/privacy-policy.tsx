import { PRIVACY_POLICY } from "../../../components/constants/legal";
import { LegalDocumentScreen } from "../../../components/legal/LegalDocumentScreen";
import { useT } from "../../../lib/i18n";

export default function PrivacyPolicy() {
  const t = useT();
  return (
    <LegalDocumentScreen
      document={PRIVACY_POLICY}
      title={t("legal.privacy")}
      icon="shield-check-outline"
      accent={{ tint: "#E6DDF4", color: "#2B1A3D" }}
    />
  );
}
