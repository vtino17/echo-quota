import { hashValue } from "./canonical.js";
import { compileCorpus } from "./compile.js";
import type {
  AdmissionBatch,
  CorpusCatalog,
  CorpusPolicy,
  CorpusReceipt,
  ReceiptVerification,
} from "./types.js";

type ReceiptInputs = {
  catalog: CorpusCatalog;
  batch: AdmissionBatch;
  policy: CorpusPolicy;
};

export async function issueReceipt(
  input: ReceiptInputs & { issuedAt?: Date },
): Promise<CorpusReceipt> {
  const compilation = await compileCorpus(input);
  if (compilation.status === "blocked") {
    throw new Error("Cannot issue a receipt for a blocked corpus compilation.");
  }
  const body = {
    receiptVersion: "1.0" as const,
    datasetId: input.catalog.datasetId,
    catalogHash: await hashValue(input.catalog),
    batchHash: await hashValue(input.batch),
    policyHash: await hashValue(input.policy),
    compilationHash: compilation.compilationHash,
    compiledAt: compilation.compiledAt,
    issuedAt: (input.issuedAt ?? new Date()).toISOString(),
    admittedIds: compilation.admittedAssets.map((asset) => asset.id).sort(),
  };
  return { ...body, receiptHash: await hashValue(body) };
}

export async function verifyReceipt(
  receipt: CorpusReceipt,
  input: ReceiptInputs,
): Promise<ReceiptVerification> {
  const { receiptHash, ...body } = receipt;
  const compilation = await compileCorpus({
    ...input,
    compiledAt: new Date(receipt.compiledAt),
  });
  const checks = {
    receiptHash: receiptHash === await hashValue(body),
    catalogHash: receipt.catalogHash === await hashValue(input.catalog),
    batchHash: receipt.batchHash === await hashValue(input.batch),
    policyHash: receipt.policyHash === await hashValue(input.policy),
    compilationHash: receipt.compilationHash === compilation.compilationHash,
  };
  const errors = Object.entries(checks)
    .filter(([, valid]) => !valid)
    .map(([name]) => `${name} does not match.`);
  return { valid: errors.length === 0, checks, errors };
}
