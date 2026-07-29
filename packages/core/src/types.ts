export type AssetOrigin = "human" | "synthetic" | "hybrid";
export type DatasetSplit = "train" | "validation" | "test" | "eval" | "rag";

export interface CorpusAsset {
  id: string;
  contentHash: string;
  origin: AssetOrigin;
  modelFamily?: string;
  sourceIds: string[];
  split: DatasetSplit;
  license: string;
  createdAt: string;
  weight: number;
  humanFraction: number;
  domain: string;
}

export interface CorpusCatalog {
  catalogVersion: "1.0";
  datasetId: string;
  assets: CorpusAsset[];
}

export interface AdmissionBatch {
  batchVersion: "1.0";
  datasetId: string;
  assets: CorpusAsset[];
}

export interface CorpusPolicy {
  policyVersion: "1.0";
  datasetId: string;
  maxSyntheticWeightRatio: number;
  maxSyntheticDepth: number;
  maxModelFamilyWeightRatio: number;
  minIndependentHumanRoots: number;
  allowedLicenses: string[];
  protectedSplits: DatasetSplit[];
  forbidProtectedAncestorsInTrain: boolean;
  forbidCrossSplitHashDuplicates: boolean;
  requireSourcesForGeneratedAssets: boolean;
}

export interface LineageNode extends CorpusAsset {
  depth: number | null;
  humanRoots: string[];
}

export interface LineageEdge {
  from: string;
  to: string;
}

export interface CorpusFinding {
  code: string;
  severity: "warning" | "blocked";
  message: string;
  assetId?: string;
  relatedIds: string[];
}

export interface AdmissionDecision {
  assetId: string;
  action: "admit" | "reject";
  depth: number | null;
  humanRoots: string[];
  findings: CorpusFinding[];
}

export interface CorpusCompilation {
  datasetId: string;
  status: "clean" | "review" | "blocked";
  score: number;
  compiledAt: string;
  summary: { proposed: number; admitted: number; rejected: number };
  metrics: {
    totalWeight: number;
    syntheticWeightRatio: number;
    maxSyntheticDepth: number;
    dominantModelFamily?: string;
    dominantModelFamilyRatio: number;
    independentHumanRoots: number;
  };
  graph: { nodes: LineageNode[]; edges: LineageEdge[] };
  decisions: AdmissionDecision[];
  findings: CorpusFinding[];
  admittedAssets: CorpusAsset[];
  compilationHash: string;
}

export interface CorpusReceipt {
  receiptVersion: "1.0";
  datasetId: string;
  catalogHash: string;
  batchHash: string;
  policyHash: string;
  compilationHash: string;
  compiledAt: string;
  issuedAt: string;
  admittedIds: string[];
  receiptHash: string;
}

export interface ReceiptVerification {
  valid: boolean;
  checks: Record<"receiptHash" | "catalogHash" | "batchHash" | "policyHash" | "compilationHash", boolean>;
  errors: string[];
}
