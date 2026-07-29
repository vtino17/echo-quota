import type { AdmissionBatch, CorpusCatalog, CorpusPolicy } from "./types.js";

export const sampleCatalog: CorpusCatalog = {
  catalogVersion: "1.0",
  datasetId: "assistant-corpus",
  assets: [
    {
      id: "human-docs-a",
      contentHash: "sha256:human-a",
      origin: "human",
      sourceIds: [],
      split: "train",
      license: "CC-BY-4.0",
      createdAt: "2026-01-10T00:00:00.000Z",
      weight: 60,
      humanFraction: 1,
      domain: "technical-docs",
    },
    {
      id: "human-docs-b",
      contentHash: "sha256:human-b",
      origin: "human",
      sourceIds: [],
      split: "train",
      license: "MIT",
      createdAt: "2026-01-11T00:00:00.000Z",
      weight: 30,
      humanFraction: 1,
      domain: "technical-docs",
    },
    {
      id: "sealed-eval",
      contentHash: "sha256:eval-secret",
      origin: "human",
      sourceIds: [],
      split: "eval",
      license: "CC-BY-4.0",
      createdAt: "2026-01-12T00:00:00.000Z",
      weight: 10,
      humanFraction: 1,
      domain: "evaluation",
    },
  ],
};

export const samplePolicy: CorpusPolicy = {
  policyVersion: "1.0",
  datasetId: "assistant-corpus",
  maxSyntheticWeightRatio: 0.25,
  maxSyntheticDepth: 2,
  maxModelFamilyWeightRatio: 0.2,
  minIndependentHumanRoots: 1,
  allowedLicenses: ["CC-BY-4.0", "MIT", "Apache-2.0"],
  protectedSplits: ["test", "eval"],
  forbidProtectedAncestorsInTrain: true,
  forbidCrossSplitHashDuplicates: true,
  requireSourcesForGeneratedAssets: true,
};

export const safeBatch: AdmissionBatch = {
  batchVersion: "1.0",
  datasetId: "assistant-corpus",
  assets: [{
    id: "synthetic-docs-clean",
    contentHash: "sha256:synthetic-clean",
    origin: "synthetic",
    modelFamily: "atlas-1",
    sourceIds: ["human-docs-a"],
    split: "train",
    license: "CC-BY-4.0",
    createdAt: "2026-02-01T00:00:00.000Z",
    weight: 10,
    humanFraction: 0,
    domain: "technical-docs",
  }],
};

export const riskyBatch: AdmissionBatch = {
  batchVersion: "1.0",
  datasetId: "assistant-corpus",
  assets: [
    {
      id: "recursive-1", contentHash: "sha256:r1", origin: "synthetic", modelFamily: "echo-one",
      sourceIds: ["human-docs-a"], split: "train", license: "MIT", createdAt: "2026-02-02T00:00:00.000Z",
      weight: 30, humanFraction: 0, domain: "assistant",
    },
    {
      id: "recursive-2", contentHash: "sha256:r2", origin: "synthetic", modelFamily: "echo-one",
      sourceIds: ["recursive-1"], split: "train", license: "MIT", createdAt: "2026-02-03T00:00:00.000Z",
      weight: 30, humanFraction: 0, domain: "assistant",
    },
    {
      id: "recursive-3", contentHash: "sha256:r3", origin: "synthetic", modelFamily: "echo-one",
      sourceIds: ["recursive-2"], split: "train", license: "MIT", createdAt: "2026-02-04T00:00:00.000Z",
      weight: 30, humanFraction: 0, domain: "assistant",
    },
    {
      id: "eval-descendant", contentHash: "sha256:eval-derived", origin: "synthetic", modelFamily: "echo-one",
      sourceIds: ["sealed-eval"], split: "train", license: "MIT", createdAt: "2026-02-05T00:00:00.000Z",
      weight: 20, humanFraction: 0, domain: "evaluation",
    },
    {
      id: "eval-copy", contentHash: "sha256:eval-secret", origin: "synthetic", modelFamily: "echo-one",
      sourceIds: ["human-docs-b"], split: "train", license: "MIT", createdAt: "2026-02-06T00:00:00.000Z",
      weight: 10, humanFraction: 0, domain: "evaluation",
    },
    {
      id: "orphan", contentHash: "sha256:orphan", origin: "synthetic", modelFamily: "echo-two",
      sourceIds: ["missing-source"], split: "train", license: "MIT", createdAt: "2026-02-07T00:00:00.000Z",
      weight: 5, humanFraction: 0, domain: "unknown",
    },
    {
      id: "cycle-a", contentHash: "sha256:cycle-a", origin: "synthetic", modelFamily: "echo-two",
      sourceIds: ["cycle-b"], split: "train", license: "MIT", createdAt: "2026-02-08T00:00:00.000Z",
      weight: 5, humanFraction: 0, domain: "unknown",
    },
    {
      id: "cycle-b", contentHash: "sha256:cycle-b", origin: "synthetic", modelFamily: "echo-two",
      sourceIds: ["cycle-a"], split: "train", license: "Proprietary", createdAt: "2026-02-09T00:00:00.000Z",
      weight: 5, humanFraction: 0, domain: "unknown",
    },
  ],
};
