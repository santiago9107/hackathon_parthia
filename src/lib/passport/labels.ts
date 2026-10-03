import type { DocumentType } from "../types";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  prescription: "Prescription",
  "lab-report": "Lab report",
  "visit-summary": "Visit summary",
  "dietitian-note": "Dietitian note",
  "behavioral-health-note": "Behavioral health note",
  "discharge-summary": "Discharge summary",
  other: "Other",
};
