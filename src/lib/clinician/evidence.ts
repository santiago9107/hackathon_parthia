import type { Citation } from "./types";

/**
 * VERIFIED LABEL EVIDENCE
 *
 * Every citation the clinician agent attaches to a finding comes from this
 * file. Both URLs were opened and read before being recorded here, and
 * `evidence.test.ts` asserts that no other FDA or DailyMed link exists
 * anywhere under `src/`, so a later edit cannot quietly reintroduce a dead
 * link into the review queue.
 */

/** FDA Advil (ibuprofen) Drug Facts label. Carries the stomach bleeding warning. */
export const FDA_ADVIL_LABEL_URL = "https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/211733Orig1s007lbl.pdf";

/** DailyMed ciprofloxacin label. Carries the prothrombin time and INR monitoring text. */
export const DAILYMED_CIPRO_LABEL_URL = "https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=b064286b-fedc-be68-e053-2995a90aae52&type=display";

/** The only label URLs this codebase is allowed to cite. */
export const VERIFIED_EVIDENCE_URLS: readonly string[] = [FDA_ADVIL_LABEL_URL, DAILYMED_CIPRO_LABEL_URL];

export const IBUPROFEN_EVIDENCE: Citation = {
  sourceName: "FDA Advil Drug Facts label",
  url: FDA_ADVIL_LABEL_URL,
  passage: "The chance is higher if you take a blood thinning (anticoagulant) or steroid drug.",
  retrievedOn: "2026-10-03",
};

export const CIPRO_EVIDENCE: Citation = {
  sourceName: "DailyMed ciprofloxacin label",
  url: DAILYMED_CIPRO_LABEL_URL,
  passage: "Monitor prothrombin time and INR frequently during and shortly after co-administration of ciprofloxacin with an oral anti-coagulant.",
  retrievedOn: "2026-10-03",
};
