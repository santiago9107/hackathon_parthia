"use client";

import { PageHeader, Disclaimer } from "@/components/PageHeader";
import { AssistantPanel } from "@/components/AssistantPanel";
import { usePatient } from "@/lib/context/PatientContext";

export default function AssistantPage() {
  const { patientId } = usePatient();
  return (
    <div>
      <PageHeader
        eyebrow="Assistant"
        title="Ask about your own records"
        subtitle="Every answer is built only from your medication list, safety flags and daily entries — never from anyone else's data, and never as medical advice."
      />
      <AssistantPanel key={patientId} />
      <Disclaimer />
    </div>
  );
}
