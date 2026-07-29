import type {
  AdmissionBatch,
  CorpusCatalog,
  CorpusPolicy,
} from "./types.js";

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const assertAssets = (assets: unknown): void => {
  if (!Array.isArray(assets)) throw new Error("Assets must be an array.");
  const ids = new Set<string>();
  for (const asset of assets) {
    if (!object(asset)) throw new Error("Asset must be an object.");
    for (const field of ["id", "contentHash", "origin", "split", "license", "createdAt", "domain"]) {
      if (typeof asset[field] !== "string") throw new Error(`Asset field "${field}" must be a string.`);
    }
    if (!Array.isArray(asset.sourceIds) || !asset.sourceIds.every((id) => typeof id === "string")) throw new Error("sourceIds must be strings.");
    if (typeof asset.weight !== "number" || asset.weight <= 0) throw new Error("Asset weight must be positive.");
    if (typeof asset.humanFraction !== "number" || asset.humanFraction < 0 || asset.humanFraction > 1) throw new Error("humanFraction must be between 0 and 1.");
    if (ids.has(String(asset.id))) throw new Error(`Duplicate asset id: ${String(asset.id)}`);
    ids.add(String(asset.id));
  }
};

export function assertCatalog(value: unknown): asserts value is CorpusCatalog {
  if (!object(value) || value.catalogVersion !== "1.0" || typeof value.datasetId !== "string") throw new Error("Invalid corpus catalog.");
  assertAssets(value.assets);
}

export function assertBatch(value: unknown): asserts value is AdmissionBatch {
  if (!object(value) || value.batchVersion !== "1.0" || typeof value.datasetId !== "string") throw new Error("Invalid admission batch.");
  assertAssets(value.assets);
}

export function assertPolicy(value: unknown): asserts value is CorpusPolicy {
  if (!object(value) || value.policyVersion !== "1.0" || typeof value.datasetId !== "string") throw new Error("Invalid corpus policy.");
  for (const field of ["maxSyntheticWeightRatio", "maxModelFamilyWeightRatio"]) {
    if (typeof value[field] !== "number" || Number(value[field]) < 0 || Number(value[field]) > 1) throw new Error(`${field} must be between 0 and 1.`);
  }
  for (const field of ["maxSyntheticDepth", "minIndependentHumanRoots"]) {
    if (!Number.isSafeInteger(value[field]) || Number(value[field]) < 0) throw new Error(`${field} must be a non-negative integer.`);
  }
  if (!Array.isArray(value.allowedLicenses) || !Array.isArray(value.protectedSplits)) throw new Error("Policy arrays are invalid.");
  for (const field of ["forbidProtectedAncestorsInTrain", "forbidCrossSplitHashDuplicates", "requireSourcesForGeneratedAssets"]) {
    if (typeof value[field] !== "boolean") throw new Error(`${field} must be boolean.`);
  }
}
