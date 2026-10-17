import { TERMS_AND_CONDITIONS } from "../../../components/constants/legal";
import { LegalDocumentScreen } from "../../../components/legal/LegalDocumentScreen";
import { useT } from "../../../lib/i18n";

export default function Terms() {
  const t = useT();
  return (
    <LegalDocumentScreen
      document={TERMS_AND_CONDITIONS}
      title={t("legal.terms")}
      icon="file-document-outline"
      accent={{ tint: "#FBE4DA", color: "#A94C36" }}
    />
  );
}
