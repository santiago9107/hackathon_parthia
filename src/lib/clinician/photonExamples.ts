import type { PhotonScreenAlert } from "./photonScreen";
/**
 * Synthetic example alerts for the three demo drafts.
 *
 * These are NOT sandbox output. They are written by hand and the UI labels them
 * as synthetic examples. Never label these live or recorded. They are the last
 * resort only: the fallback prefers a real capture from
 * `photonRecorded.ts` whenever one exists for the draft, and all three demo
 * drafts have one.
 *
 * Rules decide, models explain: these examples stand in for a rules engine's
 * output, and no model produced or ranked them.
 */
export const PHOTON_EXAMPLE_SCREENS: Record<string, PhotonScreenAlert[]> = {
  "ciprofloxacin-500-mg": [
    {
      type: "DRUG",
      severity: "MAJOR",
      description: "Ciprofloxacin may increase the anticoagulant effect of warfarin, so INR can rise.",
      involvedEntities: [
        { id: "med_ciprofloxacin", name: "Ciprofloxacin HCl Oral Tablet 500 MG", kind: "drafted" },
        { id: "med_warfarin", name: "Warfarin Sodium Oral Tablet 5 MG", kind: "existing" },
      ],
    },
  ],
  "amoxicillin-500-mg": [
    {
      type: "ALLERGEN",
      severity: "MAJOR",
      description: "Amoxicillin may cause a reaction given a recorded penicillin allergy, since both share the penicillin class.",
      involvedEntities: [
        { id: "alg_penicillin", name: "penicillin G", kind: "allergen" },
        { id: "med_amoxicillin", name: "Amoxicillin Oral Capsule 500 MG", kind: "drafted" },
      ],
    },
  ],
  "ibuprofen-200-mg": [
    {
      type: "DRUG",
      severity: "MAJOR",
      description: "Ibuprofen with warfarin may increase bleeding risk.",
      involvedEntities: [
        { id: "med_ibuprofen", name: "Ibuprofen Oral Tablet 200 MG", kind: "drafted" },
        { id: "med_warfarin", name: "Warfarin Sodium Oral Tablet 5 MG", kind: "existing" },
      ],
    },
    {
      type: "ALLERGEN",
      severity: "MAJOR",
      description: "Ibuprofen may cause a reaction given a recorded NSAID allergy to ibuprofen.",
      involvedEntities: [
        { id: "alg_ibuprofen", name: "ibuprofen", kind: "allergen" },
        { id: "med_ibuprofen", name: "Ibuprofen Oral Tablet 200 MG", kind: "drafted" },
      ],
    },
  ],
};
