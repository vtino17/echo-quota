import type { CorpusCompilation } from "@echoquota/core";

export function formatCompilation(result: CorpusCompilation): string {
  const lines = [
    `EchoQuota · ${result.datasetId}`,
    `${result.status.toUpperCase()} · score ${result.score}/100`,
    `Proposed ${result.summary.proposed} · admitted ${result.summary.admitted} · rejected ${result.summary.rejected}`,
    `Synthetic ${(result.metrics.syntheticWeightRatio * 100).toFixed(1)}% · max depth ${result.metrics.maxSyntheticDepth} · roots ${result.metrics.independentHumanRoots}`,
    `Dominant model ${result.metrics.dominantModelFamily ?? "none"} (${(result.metrics.dominantModelFamilyRatio * 100).toFixed(1)}%)`,
  ];
  const findings = [
    ...result.decisions.flatMap((decision) => decision.findings),
    ...result.findings,
  ];
  if (findings.length === 0) lines.push("", "No policy findings.");
  else {
    lines.push("", "Findings");
    for (const item of findings) {
      lines.push(`- [${item.severity.toUpperCase()}] ${item.code}${item.assetId ? ` · ${item.assetId}` : ""}: ${item.message}`);
    }
  }
  return lines.join("\n");
}

export function formatDot(result: CorpusCompilation): string {
  const status = new Map(result.decisions.map((decision) => [decision.assetId, decision.action]));
  const nodes = result.graph.nodes.map((node) => {
    const color = status.get(node.id) === "reject" ? "#ff5d5d" : node.origin === "human" ? "#54d6a1" : "#f5c45e";
    return `  "${node.id}" [label="${node.id}\\n${node.origin} · depth ${node.depth ?? "?"}", color="${color}"];`;
  });
  const edges = result.graph.edges.map((edge) => `  "${edge.from}" -> "${edge.to}";`);
  return ["digraph EchoQuota {", "  rankdir=LR;", "  node [shape=box, style=rounded];", ...nodes, ...edges, "}"].join("\n");
}
