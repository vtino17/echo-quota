import { describe, expect, it } from "vitest";
import {
  compileCorpus,
  issueReceipt,
  riskyBatch,
  safeBatch,
  sampleCatalog,
  samplePolicy,
  verifyReceipt,
} from "./index.js";
import type { AdmissionBatch, CorpusPolicy } from "./types.js";

const compile = (batch: AdmissionBatch = safeBatch, policy: CorpusPolicy = samplePolicy) =>
  compileCorpus({ catalog: sampleCatalog, batch, policy, compiledAt: new Date("2026-03-01T00:00:00.000Z") });
const codes = async (batch: AdmissionBatch) => {
  const result = await compile(batch);
  return [...result.decisions.flatMap((decision) => decision.findings), ...result.findings].map((item) => item.code);
};

describe("corpus compiler", () => {
  it("admits a clean synthetic batch", async () => expect((await compile()).status).toBe("clean"));
  it("computes synthetic depth", async () => expect((await compile()).decisions[0]?.depth).toBe(1));
  it("tracks independent human roots", async () => expect((await compile()).decisions[0]?.humanRoots).toEqual(["human-docs-a"]));
  it("builds directed lineage edges", async () => expect((await compile()).graph.edges).toContainEqual({ from: "human-docs-a", to: "synthetic-docs-clean" }));
  it("computes a synthetic ratio", async () => expect((await compile()).metrics.syntheticWeightRatio).toBeCloseTo(10 / 110));
  it("identifies the dominant model family", async () => expect((await compile()).metrics.dominantModelFamily).toBe("atlas-1"));
  it("detects orphan lineage", async () => expect(await codes(riskyBatch)).toContain("orphan-lineage"));
  it("detects provenance cycles", async () => expect(await codes(riskyBatch)).toContain("lineage-cycle"));
  it("detects an unapproved license", async () => expect(await codes(riskyBatch)).toContain("license-not-approved"));
  it("detects cross-split hash leakage", async () => expect(await codes(riskyBatch)).toContain("cross-split-content-leakage"));
  it("detects protected evaluation ancestry", async () => expect(await codes(riskyBatch)).toContain("protected-split-ancestor"));
  it("detects excessive recursive depth", async () => expect(await codes(riskyBatch)).toContain("synthetic-depth-exceeded"));
  it("detects missing human roots", async () => expect(await codes(riskyBatch)).toContain("insufficient-human-roots"));
  it("rejects structurally unsafe assets", async () => expect((await compile(riskyBatch)).summary.rejected).toBeGreaterThan(0));
  it("blocks risky compilations", async () => expect((await compile(riskyBatch)).status).toBe("blocked"));
  it("enforces synthetic quota after structural admission", async () => {
    const policy = { ...samplePolicy, maxSyntheticWeightRatio: 0.01 };
    expect((await compile(safeBatch, policy)).findings.map((item) => item.code)).toContain("synthetic-quota-exceeded");
  });
  it("enforces model family concentration", async () => {
    const policy = { ...samplePolicy, maxModelFamilyWeightRatio: 0.01 };
    expect((await compile(safeBatch, policy)).findings.map((item) => item.code)).toContain("model-family-concentration");
  });
  it("warns for duplicate content in the same split", async () => {
    const batch = structuredClone(safeBatch);
    batch.assets[0]!.contentHash = "sha256:human-a";
    expect(await codes(batch)).toContain("duplicate-content");
  });
  it("rejects inconsistent human origin", async () => {
    const batch = structuredClone(safeBatch);
    Object.assign(batch.assets[0]!, { origin: "human", humanFraction: 0, modelFamily: "atlas-1" });
    expect(await codes(batch)).toContain("human-origin-inconsistent");
  });
  it("rejects generated assets without sources", async () => {
    const batch = structuredClone(safeBatch);
    batch.assets[0]!.sourceIds = [];
    expect(await codes(batch)).toContain("generated-source-missing");
  });
  it("rejects mismatched dataset ids", async () => {
    await expect(compileCorpus({ catalog: sampleCatalog, batch: { ...safeBatch, datasetId: "other" }, policy: samplePolicy })).rejects.toThrow("different datasets");
  });
  it("rejects an id already in the catalog", async () => {
    const batch = structuredClone(safeBatch);
    batch.assets[0]!.id = "human-docs-a";
    await expect(compile(batch)).rejects.toThrow("already exists");
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects non-finite asset weights (%s)",
    async (weight) => {
      const batch = structuredClone(safeBatch);
      batch.assets[0]!.weight = weight;
      await expect(compile(batch)).rejects.toThrow("weight must be finite");
    },
  );
  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects non-finite corpus ratios (%s)",
    async (maxSyntheticWeightRatio) => {
      const policy = { ...samplePolicy, maxSyntheticWeightRatio };
      await expect(compile(safeBatch, policy)).rejects.toThrow("maxSyntheticWeightRatio must be finite");
    },
  );
});

describe("receipts", () => {
  it("issues a tamper-evident clean receipt", async () => {
    const receipt = await issueReceipt({ catalog: sampleCatalog, batch: safeBatch, policy: samplePolicy, issuedAt: new Date("2026-03-01T00:00:01.000Z") });
    expect(receipt.receiptHash).toHaveLength(64);
  });
  it("verifies matching inputs", async () => {
    const receipt = await issueReceipt({ catalog: sampleCatalog, batch: safeBatch, policy: samplePolicy });
    expect((await verifyReceipt(receipt, { catalog: sampleCatalog, batch: safeBatch, policy: samplePolicy })).valid).toBe(true);
  });
  it("detects a tampered receipt", async () => {
    const receipt = await issueReceipt({ catalog: sampleCatalog, batch: safeBatch, policy: samplePolicy });
    const tampered = { ...receipt, admittedIds: ["forged"] };
    expect((await verifyReceipt(tampered, { catalog: sampleCatalog, batch: safeBatch, policy: samplePolicy })).checks.receiptHash).toBe(false);
  });
  it("detects changed source inputs", async () => {
    const receipt = await issueReceipt({ catalog: sampleCatalog, batch: safeBatch, policy: samplePolicy });
    const changed = structuredClone(safeBatch);
    changed.assets[0]!.weight = 11;
    expect((await verifyReceipt(receipt, { catalog: sampleCatalog, batch: changed, policy: samplePolicy })).valid).toBe(false);
  });
  it("refuses a blocked compilation", async () => {
    await expect(issueReceipt({ catalog: sampleCatalog, batch: riskyBatch, policy: samplePolicy })).rejects.toThrow("blocked");
  });
});
