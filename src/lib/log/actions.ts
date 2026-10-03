/** Quick actions offered by the Log hub and the dashboard. */
export const LOG_ACTIONS = [
  { href: "/log/mood/", label: "Mood check-in", hint: "How are you feeling today?", icon: "mood" },
  { href: "/log/symptom/", label: "Symptom", hint: "Something you noticed", icon: "symptom" },
  { href: "/log/meal/", label: "Meal", hint: "What you ate or drank", icon: "meal" },
  { href: "/log/vitals/", label: "Blood pressure, heart rate, weight", hint: "A reading you took", icon: "vitals" },
  { href: "/log/medication/", label: "Add or edit a medication", hint: "Including over-the-counter", icon: "medication" },
  { href: "/log/appointment/", label: "Appointment", hint: "Upcoming or past", icon: "calendar" },
  { href: "/log/allergy/", label: "Allergy", hint: "Medicine, food or other", icon: "warning" },
  { href: "/log/phq-9/", label: "PHQ-9 mood screening", hint: "9 questions · screening, not a diagnosis", icon: "document" },
  { href: "/log/gad-7/", label: "GAD-7 anxiety screening", hint: "7 questions · screening, not a diagnosis", icon: "document" },
  { href: "/log/nutrition-profile/", label: "Nutrition profile", hint: "How you eat, limits, goals", icon: "nutrition" },
  { href: "/log/emergency/", label: "Emergency info", hint: "Blood type, contacts, critical info", icon: "emergency" },
] as const;
