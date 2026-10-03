import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runClinicianAgent } from "./agent";
import { buildClinicianCase, CLINICIAN_COHORT } from "./cases";
import { DAILYMED_CIPRO_LABEL_URL, FDA_ADVIL_LABEL_URL, VERIFIED_EVIDENCE_URLS } from "./evidence";

const SRC = fileURLToPath(new URL("../../", import.meta.url));
const LABEL_HOSTS = /accessdata\.fda\.gov|dailymed\.nlm\.nih\.gov/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function labelUrlsIn(text: string): string[] {
  return (text.match(/https?:\/\/\S+/g) ?? [])
    .map((url) => url.replace(/["'`,;)\]}]+$/, ""))
    .filter((url) => LABEL_HOSTS.test(url));
}

describe("verified evidence links", () => {
  it("holds exactly the two labels that were opened and read", () => {
    expect(FDA_ADVIL_LABEL_URL).toBe("https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/211733Orig1s007lbl.pdf");
    expect(DAILYMED_CIPRO_LABEL_URL).toBe("https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=b064286b-fedc-be68-e053-2995a90aae52&type=display");
    expect(VERIFIED_EVIDENCE_URLS).toHaveLength(2);
  });

  it("is the only place in src that links an FDA or DailyMed label", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const url of labelUrlsIn(readFileSync(file, "utf8"))) {
        if (!VERIFIED_EVIDENCE_URLS.includes(url)) offenders.push(`${file.slice(SRC.length)}: ${url}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never attaches an unverified citation to a finding", () => {
    const confirmations = { "passport:otc-ibuprofen": true, "passport:otc-diphenhydramine": true };
    for (const patient of CLINICIAN_COHORT) {
      for (const options of [{}, { confirmations }]) {
        const run = runClinicianAgent(buildClinicianCase(patient.id), options);
        for (const finding of run.findings) {
          if (finding.citation) expect(VERIFIED_EVIDENCE_URLS).toContain(finding.citation.url);
        }
      }
    }
  });
});
