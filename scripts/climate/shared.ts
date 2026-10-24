import type { ClimateEvidenceResult } from "@/lib/climate";
import { baselineMeanDmmRounded, formatBpsAsPercent, formatDmmAsMm, zScore } from "@/lib/climate/srpn";
import { ALL_SCENARIOS, type AnyScenarioId } from "@/lib/climate/scenarios";

export const EVIDENCE_FILE_SCHEMA = "rilva.evidence-file.v1" as const;

/** On-disk evidence file. Only `artifact.core` is hashed; everything else is context. */
export function toEvidenceFile(id: AnyScenarioId, r: ClimateEvidenceResult) {
  const res = r.artifact.core.result;
  return {
    schema: EVIDENCE_FILE_SCHEMA,
    scenario: id,
    title: ALL_SCENARIOS[id].title,
    notice:
      "Retrospective replay of a past season, not a live drought alert. ERA5 reanalysis estimate for one ~28 km grid cell; it does not measure drought impact or financial loss. The 60 % threshold is an illustrative hackathon rule.",
    artifact: r.artifact,
    provenance: r.provenance,
    presentation: {
      observedTotalMm: formatDmmAsMm(res.observedTotalDmm),
      baselineMeanMm: formatDmmAsMm(baselineMeanDmmRounded(res.baselineSumDmm, res.baselineYears)),
      percentOfNormal: formatBpsAsPercent(res.indexBps),
      thresholdPercent: formatBpsAsPercent(res.thresholdBps),
      zScoreInformational: (() => {
        const z = zScore(res.observedTotalDmm, r.artifact.core.data.baselineSeasonTotalsDmm);
        return z === null ? null : Math.round(z * 100) / 100;
      })(),
    },
  };
}
