#!/usr/bin/env node
import {
  compileCorpus,
  issueReceipt,
  riskyBatch,
  safeBatch,
  sampleCatalog,
  samplePolicy,
  verifyReceipt,
  type AdmissionBatch,
  type CorpusCatalog,
  type CorpusPolicy,
  type CorpusReceipt,
} from "@echoquota/core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { formatCompilation, formatDot } from "./format.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const has = (name: string) => args.includes(name);
const readJson = async <T>(file: string): Promise<T> => JSON.parse(await readFile(resolve(file), "utf8")) as T;
const saveJson = async (file: string, value: unknown) => {
  const target = resolve(file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const inputs = async () => {
  const catalogFile = flag("--catalog");
  const policyFile = flag("--policy");
  const batchFile = args[1];
  if (!catalogFile || !policyFile || !batchFile) throw new Error("Provide a batch file plus --catalog and --policy.");
  return {
    catalog: await readJson<CorpusCatalog>(catalogFile),
    batch: await readJson<AdmissionBatch>(batchFile),
    policy: await readJson<CorpusPolicy>(policyFile),
  };
};
const statusExit = (status: "clean" | "review" | "blocked") => {
  process.exitCode = status === "blocked" ? 2 : status === "review" ? 3 : 0;
};

const help = `EchoQuota — synthetic-data lineage and contamination compiler

Usage:
  echo-quota inspect <catalog.json>
  echo-quota compile <batch.json> --catalog <catalog.json> --policy <policy.json> [--json]
  echo-quota lineage <batch.json> --catalog <catalog.json> --policy <policy.json> --asset <id>
  echo-quota graph <batch.json> --catalog <catalog.json> --policy <policy.json> [--output graph.dot]
  echo-quota explain <batch.json> --catalog <catalog.json> --policy <policy.json> --asset <id>
  echo-quota receipt <batch.json> --catalog <catalog.json> --policy <policy.json> --output <receipt.json>
  echo-quota verify <receipt.json> --catalog <catalog.json> --policy <policy.json> --batch <batch.json>
  echo-quota demo [safe|risky] [--json]
  echo-quota init [directory]`;

async function main() {
  if (command === "help" || has("--help") || has("-h")) return console.log(help);
  if (command === "inspect") {
    const catalog = await readJson<CorpusCatalog>(args[1] ?? "");
    const origins = new Map<string, number>();
    for (const asset of catalog.assets) origins.set(asset.origin, (origins.get(asset.origin) ?? 0) + 1);
    console.log(JSON.stringify({
      datasetId: catalog.datasetId,
      assets: catalog.assets.length,
      weight: catalog.assets.reduce((sum, asset) => sum + asset.weight, 0),
      byOrigin: Object.fromEntries(origins),
      splits: [...new Set(catalog.assets.map((asset) => asset.split))].sort(),
    }, null, 2));
    return;
  }
  if (command === "demo") {
    const result = await compileCorpus({
      catalog: sampleCatalog,
      batch: args[1] === "risky" ? riskyBatch : safeBatch,
      policy: samplePolicy,
    });
    console.log(has("--json") ? JSON.stringify(result, null, 2) : formatCompilation(result));
    statusExit(result.status);
    return;
  }
  if (command === "init") {
    const directory = resolve(args[1] ?? "echo-quota-example");
    await Promise.all([
      saveJson(`${directory}/catalog.json`, sampleCatalog),
      saveJson(`${directory}/batch.json`, safeBatch),
      saveJson(`${directory}/policy.json`, samplePolicy),
    ]);
    console.log(`Created starter manifests in ${directory}`);
    return;
  }
  if (command === "verify") {
    const receipt = await readJson<CorpusReceipt>(args[1] ?? "");
    const catalogFile = flag("--catalog");
    const policyFile = flag("--policy");
    const batchFile = flag("--batch");
    if (!catalogFile || !policyFile || !batchFile) throw new Error("Provide --catalog, --policy, and --batch.");
    const result = await verifyReceipt(receipt, {
      catalog: await readJson<CorpusCatalog>(catalogFile),
      policy: await readJson<CorpusPolicy>(policyFile),
      batch: await readJson<AdmissionBatch>(batchFile),
    });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.valid ? 0 : 4;
    return;
  }
  const source = await inputs();
  const result = await compileCorpus(source);
  if (command === "compile") {
    console.log(has("--json") ? JSON.stringify(result, null, 2) : formatCompilation(result));
    statusExit(result.status);
    return;
  }
  if (command === "graph") {
    const dot = formatDot(result);
    const output = flag("--output");
    if (output) {
      await saveText(output, dot);
      console.log(`Wrote Graphviz lineage to ${resolve(output)}`);
    } else console.log(dot);
    statusExit(result.status);
    return;
  }
  if (command === "lineage" || command === "explain") {
    const assetId = flag("--asset");
    if (!assetId) throw new Error("Provide --asset <id>.");
    const node = result.graph.nodes.find((item) => item.id === assetId);
    if (!node) throw new Error(`Unknown asset: ${assetId}`);
    const parents = result.graph.edges.filter((edge) => edge.to === assetId).map((edge) => edge.from);
    const children = result.graph.edges.filter((edge) => edge.from === assetId).map((edge) => edge.to);
    const decision = result.decisions.find((item) => item.assetId === assetId);
    console.log(JSON.stringify({ node, parents, children, decision }, null, 2));
    statusExit(result.status);
    return;
  }
  if (command === "receipt") {
    const output = flag("--output");
    if (!output) throw new Error("Provide --output <receipt.json>.");
    const receipt = await issueReceipt(source);
    await saveJson(output, receipt);
    console.log(`Issued ${receipt.receiptHash} to ${resolve(output)}`);
    return;
  }
  throw new Error(`Unknown command: ${command}\n\n${help}`);
}

async function saveText(file: string, value: string) {
  const target = resolve(file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${value}\n`, "utf8");
}

main().catch((error: unknown) => {
  console.error(`EchoQuota error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 5;
});
