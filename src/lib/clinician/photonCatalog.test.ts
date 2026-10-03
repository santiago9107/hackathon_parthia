import { describe, expect, it } from "vitest";
import {
  PHOTON_CATALOG_LOOKED_UP_ON,
  PHOTON_DEMO_DRAFTS,
  photonAllowedTreatmentIds,
  photonDemoPatient,
  photonEntityLabel,
  photonTreatment,
  photonTreatmentId,
} from "./photonCatalog";
describe("Photon sandbox catalog", () => {
  it("records when the ids were looked up", () => {
    expect(PHOTON_CATALOG_LOOKED_UP_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("holds the demo drugs with sandbox treatment ids", () => {
    for (const key of ["warfarin-5-mg", "ibuprofen-200-mg", "aspirin-81-mg", "ciprofloxacin-500-mg", "amoxicillin-500-mg", "atorvastatin-40-mg", "metoprolol-50-mg"]) {
      expect(photonTreatmentId(key)).toMatch(/^med_[A-Z0-9]+$/);
      expect(photonTreatment(key)?.label).toBeTruthy();
    }
  });
  it("fails closed on an unknown treatment key", () => {
    expect(() => photonTreatmentId("fentanyl-100-mcg")).toThrow("Unknown Photon treatment key");
  });
  it("allow-lists exactly the catalog treatments", () => {
    const allowed = photonAllowedTreatmentIds();
    expect(allowed).toHaveLength(7);
    expect(allowed).toContain(photonTreatmentId("warfarin-5-mg"));
    expect(new Set(allowed).size).toBe(allowed.length);
  });
  it("resolves the synthetic demo patient to sandbox allergen and medication ids", () => {
    const demo = photonDemoPatient();
    expect(demo.externalId).toBe("parthia-harold-okafor");
    expect(demo.sex).toBe("MALE");
    expect(demo.phone).toMatch(/^\+1\d{10}$/);
    expect(demo.allergenIds.every((id) => id.startsWith("alg_"))).toBe(true);
    expect(demo.allergenIds).toHaveLength(2);
    expect(demo.medicationIds).toContain(photonTreatmentId("warfarin-5-mg"));
  });
  it("lists the three demo drafts in demo order", () => {
    expect(PHOTON_DEMO_DRAFTS.map((draft) => draft.treatmentKey)).toEqual([
      "ciprofloxacin-500-mg",
      "amoxicillin-500-mg",
      "ibuprofen-200-mg",
    ]);
    expect(PHOTON_DEMO_DRAFTS.every((draft) => draft.expects.length > 0)).toBe(true);
  });
  it("labels a sandbox id for display", () => {
    expect(photonEntityLabel(photonTreatmentId("warfarin-5-mg"))).toBe("Warfarin 5 mg");
    expect(photonEntityLabel("med_not_in_catalog")).toBeUndefined();
  });
});
