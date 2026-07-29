import { describe, expect, it } from "vitest";
import { compileCorpus, safeBatch, sampleCatalog, samplePolicy } from "@echoquota/core";
import { formatCompilation, formatDot } from "./format.js";

describe("CLI formatting", () => {
  it("renders a concise report", async () => {
    const result = await compileCorpus({ catalog: sampleCatalog, batch: safeBatch, policy: samplePolicy });
    expect(formatCompilation(result)).toContain("CLEAN · score 100/100");
  });
  it("renders valid Graphviz structure", async () => {
    const result = await compileCorpus({ catalog: sampleCatalog, batch: safeBatch, policy: samplePolicy });
    expect(formatDot(result)).toContain('"human-docs-a" -> "synthetic-docs-clean"');
  });
});
