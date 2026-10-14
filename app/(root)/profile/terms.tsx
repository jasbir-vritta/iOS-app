import { TERMS_AND_CONDITIONS } from "../../../components/constants/legal";
import { LegalDocumentScreen } from "../../../components/legal/LegalDocumentScreen";

export default function Terms() {
  return (
    <LegalDocumentScreen
      document={TERMS_AND_CONDITIONS}
      icon="file-document-outline"
      accent={{ tint: "#FBE4DA", color: "#A94C36" }}
    />
  );
}
