import { hashValue } from "./canonical.js";
import type {
  AdmissionDecision,
  CorpusFinding,
  CorpusCompilation,
  LineageNode,
} from "./types.js";
import { assertBatch, assertCatalog, assertPolicy } from "./validation.js";

const finding = (
  code: string,
  severity: CorpusFinding["severity"],
  message: string,
  assetId?: string,
  relatedIds: string[] = [],
): CorpusFinding => ({ code, severity, message, ...(assetId ? { assetId } : {}), relatedIds });

export async function compileCorpus(input: {
  catalog: unknown;
  batch: unknown;
  policy: unknown;
  compiledAt?: Date;
}): Promise<CorpusCompilation> {
  assertCatalog(input.catalog);
  assertBatch(input.batch);
  assertPolicy(input.policy);
  const { catalog, batch, policy } = input;
  if (catalog.datasetId !== batch.datasetId || catalog.datasetId !== policy.datasetId) throw new Error("Catalog, batch, and policy target different datasets.");
  const catalogIds = new Set(catalog.assets.map((asset) => asset.id));
  for (const asset of batch.assets) if (catalogIds.has(asset.id)) throw new Error(`Asset id already exists: ${asset.id}`);
  const allAssets = [...catalog.assets, ...batch.assets];
  const byId = new Map(allAssets.map((asset) => [asset.id, asset]));
  const depthMemo = new Map<string, number | null>();
  const rootsMemo = new Map<string, string[]>();

  const depth = (id: string, stack: string[] = []): number | null => {
    if (depthMemo.has(id)) return depthMemo.get(id) ?? null;
    if (stack.includes(id)) return null;
    const asset = byId.get(id);
    if (!asset) return null;
    if (asset.origin === "human") {
      depthMemo.set(id, 0);
      return 0;
    }
    if (asset.sourceIds.length === 0) return null;
    const parents = asset.sourceIds.map((source) => depth(source, [...stack, id]));
    if (parents.some((value) => value === null)) return null;
    const result = 1 + Math.max(...parents.map((value) => value ?? 0));
    depthMemo.set(id, result);
    return result;
  };
  const roots = (id: string, stack: string[] = []): string[] => {
    if (rootsMemo.has(id)) return rootsMemo.get(id) ?? [];
    if (stack.includes(id)) return [];
    const asset = byId.get(id);
    if (!asset) return [];
    if (asset.origin === "human") return [id];
    const result = [...new Set(asset.sourceIds.flatMap((source) => roots(source, [...stack, id])))].sort();
    rootsMemo.set(id, result);
    return result;
  };
  const ancestors = (id: string, stack: string[] = []): string[] => {
    if (stack.includes(id)) return [];
    const asset = byId.get(id);
    if (!asset) return [];
    return [...new Set(asset.sourceIds.flatMap((source) => [source, ...ancestors(source, [...stack, id])]))];
  };
  const hasCycle = (id: string, stack: string[] = [], done = new Set<string>()): boolean => {
    if (stack.includes(id)) return true;
    if (done.has(id)) return false;
    const asset = byId.get(id);
    if (!asset) return false;
    const found = asset.sourceIds.some((source) => hasCycle(source, [...stack, id], done));
    done.add(id);
    return found;
  };

  const decisions: AdmissionDecision[] = [];
  for (const asset of batch.assets) {
    const findings: CorpusFinding[] = [];
    const missing = asset.sourceIds.filter((id) => !byId.has(id));
    if (missing.length > 0) findings.push(finding("orphan-lineage", "blocked", "One or more declared sources do not exist.", asset.id, missing));
    if (hasCycle(asset.id)) findings.push(finding("lineage-cycle", "blocked", "Asset participates in a provenance cycle.", asset.id, asset.sourceIds));
    if (!policy.allowedLicenses.includes(asset.license)) findings.push(finding("license-not-approved", "blocked", `License "${asset.license}" is not approved.`, asset.id));
    if (asset.origin !== "human" && policy.requireSourcesForGeneratedAssets && asset.sourceIds.length === 0) findings.push(finding("generated-source-missing", "blocked", "Generated assets require at least one source.", asset.id));
    if (asset.origin === "human" && (asset.humanFraction !== 1 || asset.modelFamily !== undefined || asset.sourceIds.length > 0)) findings.push(finding("human-origin-inconsistent", "blocked", "Human assets must have full human fraction, no model family, and no parents.", asset.id));
    if (asset.origin === "synthetic" && (asset.humanFraction !== 0 || !asset.modelFamily)) findings.push(finding("synthetic-origin-inconsistent", "blocked", "Synthetic assets require zero human fraction and a model family.", asset.id));
    if (asset.origin === "hybrid" && (asset.humanFraction <= 0 || asset.humanFraction >= 1 || !asset.modelFamily)) findings.push(finding("hybrid-origin-inconsistent", "blocked", "Hybrid assets require a fractional human share and model family.", asset.id));
    const matchingHash = allAssets.filter((candidate) => candidate.id !== asset.id && candidate.contentHash === asset.contentHash);
    if (matchingHash.length > 0) {
      const crossSplit = matchingHash.some((candidate) => candidate.split !== asset.split);
      findings.push(finding(
        crossSplit && policy.forbidCrossSplitHashDuplicates ? "cross-split-content-leakage" : "duplicate-content",
        crossSplit && policy.forbidCrossSplitHashDuplicates ? "blocked" : "warning",
        crossSplit ? "Identical content appears in another dataset split." : "Identical content already exists in this split.",
        asset.id,
        matchingHash.map((item) => item.id),
      ));
    }
    const lineage = ancestors(asset.id);
    const protectedAncestors = lineage.filter((id) => {
      const parent = byId.get(id);
      return parent ? policy.protectedSplits.includes(parent.split) : false;
    });
    if (asset.split === "train" && policy.forbidProtectedAncestorsInTrain && protectedAncestors.length > 0) {
      findings.push(finding("protected-split-ancestor", "blocked", "Training asset descends from a protected evaluation split.", asset.id, protectedAncestors));
    }
    const assetDepth = depth(asset.id);
    if (assetDepth !== null && assetDepth > policy.maxSyntheticDepth) findings.push(finding("synthetic-depth-exceeded", "blocked", `Synthetic depth ${assetDepth} exceeds limit ${policy.maxSyntheticDepth}.`, asset.id));
    const humanRoots = roots(asset.id);
    if (humanRoots.length < policy.minIndependentHumanRoots) findings.push(finding("insufficient-human-roots", "blocked", `Lineage has ${humanRoots.length} independent human roots; ${policy.minIndependentHumanRoots} required.`, asset.id, humanRoots));
    decisions.push({
      assetId: asset.id,
      action: findings.some((item) => item.severity === "blocked") ? "reject" : "admit",
      depth: assetDepth,
      humanRoots,
      findings,
    });
  }
  const structurallyAdmitted = batch.assets.filter((asset) => decisions.find((item) => item.assetId === asset.id)?.action === "admit");
  const effective = [...catalog.assets, ...structurallyAdmitted];
  const totalWeight = effective.reduce((sum, asset) => sum + asset.weight, 0);
  const syntheticWeight = effective.reduce((sum, asset) => sum + asset.weight * (1 - asset.humanFraction), 0);
  const syntheticWeightRatio = totalWeight === 0 ? 0 : syntheticWeight / totalWeight;
  const familyWeights = new Map<string, number>();
  for (const asset of effective) {
    if (asset.modelFamily) familyWeights.set(asset.modelFamily, (familyWeights.get(asset.modelFamily) ?? 0) + asset.weight * (1 - asset.humanFraction));
  }
  const dominant = [...familyWeights.entries()].sort((a, b) => b[1] - a[1])[0];
  const dominantModelFamilyRatio = totalWeight === 0 ? 0 : (dominant?.[1] ?? 0) / totalWeight;
  const globalFindings: CorpusFinding[] = [];
  if (syntheticWeightRatio > policy.maxSyntheticWeightRatio) globalFindings.push(finding("synthetic-quota-exceeded", "blocked", `Synthetic weight ratio ${syntheticWeightRatio.toFixed(3)} exceeds ${policy.maxSyntheticWeightRatio}.`, undefined, structurallyAdmitted.map((item) => item.id)));
  if (dominantModelFamilyRatio > policy.maxModelFamilyWeightRatio) globalFindings.push(finding("model-family-concentration", "blocked", `Model family "${dominant?.[0] ?? "unknown"}" contributes ${(dominantModelFamilyRatio * 100).toFixed(1)}% of corpus weight.`, undefined, effective.filter((item) => item.modelFamily === dominant?.[0]).map((item) => item.id)));
  const allFindings = [...decisions.flatMap((item) => item.findings), ...globalFindings];
  const blocked = allFindings.some((item) => item.severity === "blocked");
  const warnings = allFindings.filter((item) => item.severity === "warning").length;
  const nodes: LineageNode[] = allAssets.map((asset) => ({ ...asset, depth: depth(asset.id), humanRoots: roots(asset.id) })).sort((a, b) => a.id.localeCompare(b.id));
  const base = {
    datasetId: catalog.datasetId,
    status: blocked ? "blocked" as const : warnings > 0 ? "review" as const : "clean" as const,
    score: Math.max(0, 100 - allFindings.filter((item) => item.severity === "blocked").length * 18 - warnings * 5),
    compiledAt: (input.compiledAt ?? new Date()).toISOString(),
    summary: { proposed: batch.assets.length, admitted: structurallyAdmitted.length, rejected: batch.assets.length - structurallyAdmitted.length },
    metrics: {
      totalWeight,
      syntheticWeightRatio,
      maxSyntheticDepth: Math.max(0, ...nodes.map((node) => node.depth ?? 0)),
      ...(dominant ? { dominantModelFamily: dominant[0] } : {}),
      dominantModelFamilyRatio,
      independentHumanRoots: new Set(effective.flatMap((asset) => roots(asset.id))).size,
    },
    graph: {
      nodes,
      edges: allAssets.flatMap((asset) => asset.sourceIds.map((source) => ({ from: source, to: asset.id }))).sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`)),
    },
    decisions,
    findings: globalFindings,
    admittedAssets: structurallyAdmitted,
  };
  return { ...base, compilationHash: await hashValue(base) };
}
