import {
  compileCorpus,
  riskyBatch,
  safeBatch,
  sampleCatalog,
  samplePolicy,
  type AdmissionBatch,
  type CorpusCompilation,
} from "@echoquota/core";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

let selected: "safe" | "risky" = "safe";

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

function lineage(result: CorpusCompilation): string {
  const batchIds = new Set(result.decisions.map((item) => item.assetId));
  const decisions = new Map(result.decisions.map((item) => [item.assetId, item]));
  const groups = new Map<string, typeof result.graph.nodes>();
  for (const node of result.graph.nodes) {
    const key = node.depth === null ? "Unresolved" : `Depth ${node.depth}`;
    groups.set(key, [...(groups.get(key) ?? []), node]);
  }
  return [...groups.entries()].map(([depth, nodes]) => `
    <section class="depth-column">
      <p class="depth-label">${depth}</p>
      ${nodes.map((node) => {
        const decision = decisions.get(node.id);
        const state = decision?.action === "reject" ? "rejected" : batchIds.has(node.id) ? "proposed" : "existing";
        const parents = result.graph.edges.filter((edge) => edge.to === node.id).map((edge) => edge.from);
        return `<article class="node ${node.origin} ${state}">
          <div class="node-top"><span>${escapeHtml(node.origin)}</span><span>${escapeHtml(node.split)}</span></div>
          <strong>${escapeHtml(node.id)}</strong>
          <small>${parents.length ? `← ${parents.map(escapeHtml).join(", ")}` : "Human root"}</small>
          <div class="node-bottom"><span>${node.weight} weight</span><span>${decision?.action ?? "catalog"}</span></div>
        </article>`;
      }).join("")}
    </section>`).join("");
}

function findings(result: CorpusCompilation): string {
  const items = [
    ...result.decisions.flatMap((decision) => decision.findings),
    ...result.findings,
  ];
  if (items.length === 0) {
    return `<div class="empty"><span>✓</span><strong>No policy violations</strong><p>This batch preserves the configured lineage and contamination boundaries.</p></div>`;
  }
  return items.map((item) => `
    <article class="finding ${item.severity}">
      <div><span class="severity">${item.severity}</span><code>${escapeHtml(item.code)}</code></div>
      <strong>${escapeHtml(item.assetId ?? "Corpus-level policy")}</strong>
      <p>${escapeHtml(item.message)}</p>
      ${item.relatedIds.length ? `<small>Related: ${item.relatedIds.map(escapeHtml).join(", ")}</small>` : ""}
    </article>`).join("");
}

async function render(batch: AdmissionBatch) {
  const result = await compileCorpus({ catalog: sampleCatalog, batch, policy: samplePolicy });
  const statusText = result.status === "clean" ? "Admission ready" : result.status === "review" ? "Human review needed" : "Training gate closed";
  app.innerHTML = `
    <header>
      <a class="brand" href="#" aria-label="EchoQuota home"><span class="mark">EQ</span><span>EchoQuota<small>Lineage compiler</small></span></a>
      <nav><a href="#lineage">Lineage</a><a href="#findings">Findings</a><a href="https://github.com/vtino17/echo-quota">GitHub ↗</a></nav>
      <span class="system-status"><i></i> Policy engine online</span>
    </header>
    <main>
      <section class="hero">
        <div>
          <p class="eyebrow">SYNTHETIC DATA CONTROL PLANE</p>
          <h1>Know what your model<br><em>is learning from.</em></h1>
          <p class="lede">Compile provenance into enforceable admission decisions. Catch recursive synthetic ancestry, evaluation leakage, and generator concentration before they enter training.</p>
        </div>
        <div class="decision ${result.status}">
          <div class="decision-ring"><span>${result.score}</span><small>/ 100</small></div>
          <div><p>CORPUS DECISION</p><h2>${statusText}</h2><span>${result.summary.admitted} admitted · ${result.summary.rejected} rejected</span></div>
        </div>
      </section>
      <section class="controls">
        <div>
          <button data-demo="safe" class="${selected === "safe" ? "active" : ""}">Clean batch</button>
          <button data-demo="risky" class="${selected === "risky" ? "active" : ""}">Contaminated batch</button>
        </div>
        <span>Dataset <strong>${escapeHtml(result.datasetId)}</strong></span>
      </section>
      <section class="metrics">
        <article><p>Synthetic weight</p><strong>${percent(result.metrics.syntheticWeightRatio)}</strong><div class="bar"><i style="width:${Math.min(100, result.metrics.syntheticWeightRatio * 100)}%"></i><b style="left:${samplePolicy.maxSyntheticWeightRatio * 100}%"></b></div><small>Quota ${percent(samplePolicy.maxSyntheticWeightRatio)}</small></article>
        <article><p>Recursive depth</p><strong>${result.metrics.maxSyntheticDepth}</strong><div class="ticks">${Array.from({ length: 5 }, (_, i) => `<i class="${i <= result.metrics.maxSyntheticDepth ? "filled" : ""}"></i>`).join("")}</div><small>Maximum ${samplePolicy.maxSyntheticDepth}</small></article>
        <article><p>Dominant generator</p><strong class="family">${escapeHtml(result.metrics.dominantModelFamily ?? "None")}</strong><div class="bar"><i style="width:${Math.min(100, result.metrics.dominantModelFamilyRatio * 100)}%"></i><b style="left:${samplePolicy.maxModelFamilyWeightRatio * 100}%"></b></div><small>${percent(result.metrics.dominantModelFamilyRatio)} of total weight</small></article>
        <article><p>Independent roots</p><strong>${result.metrics.independentHumanRoots}</strong><div class="root-icons">${Array.from({ length: Math.min(8, result.metrics.independentHumanRoots) }, () => "<i></i>").join("")}</div><small>Human-origin anchors</small></article>
      </section>
      <section class="panel" id="lineage">
        <div class="panel-head"><div><p class="eyebrow">PROVENANCE DAG</p><h2>Lineage topology</h2></div><div class="legend"><span><i class="human"></i>Human</span><span><i class="synthetic"></i>Synthetic</span><span><i class="rejected"></i>Rejected</span></div></div>
        <div class="lineage">${lineage(result)}</div>
      </section>
      <section class="panel" id="findings">
        <div class="panel-head"><div><p class="eyebrow">POLICY OUTPUT</p><h2>Compiler findings</h2></div><span class="count">${result.decisions.flatMap((item) => item.findings).length + result.findings.length} findings</span></div>
        <div class="findings">${findings(result)}</div>
      </section>
      <footer><span>EchoQuota · deterministic corpus admission</span><span>Compilation ${result.compilationHash.slice(0, 12)}…</span></footer>
    </main>`;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-demo]")) {
    button.addEventListener("click", () => {
      selected = button.dataset.demo === "risky" ? "risky" : "safe";
      void render(selected === "risky" ? riskyBatch : safeBatch);
    });
  }
}

void render(safeBatch);
