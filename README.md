# EchoQuota

**A synthetic-data lineage and contamination compiler for AI corpora.**

EchoQuota turns corpus provenance into a deterministic admission decision before data reaches training. It builds a lineage DAG, follows every generated asset back to human roots, detects evaluation contamination, limits recursive synthetic depth, and enforces corpus-wide generator quotas.

> Synthetic data is useful. Untracked synthetic ancestry is a compounding dependency.

## Why this exists

Training manifests usually describe *what* a file is, but not the full ancestry that produced it. A row marked `synthetic` can hide a chain of generated parents, a copied evaluation item, or a corpus dominated by one model family. Those are graph and portfolio properties; a flat schema validator cannot see them.

Research has demonstrated model collapse under recursively generated training data. Evaluation contamination is also an active measurement risk. EchoQuota is a small, auditable control layer for teams that need to reason about both before ingestion.

```text
human roots ──► generated asset ──► generated asset
     │                  │                  │
     └── license        ├── model family  ├── recursion depth
         split          └── content hash  └── admission policy

catalog + proposed batch + policy ──► compiler ──► decision + DAG + receipt
```

## What it catches

- Recursive synthetic depth beyond a configured limit
- Train assets descended from protected `test` or `eval` material
- Identical content hashes appearing across dataset splits
- Missing parents, lineage cycles, and generated assets without sources
- Synthetic-weight quota violations across the resulting corpus
- Excessive concentration from one model family
- Too few independent human roots
- Inconsistent origin claims and unapproved licenses
- Duplicate same-split content that requires review

## Quick start

Requires Node.js 20+ and pnpm.

```bash
pnpm install
pnpm echo demo safe
pnpm echo demo risky
```

The risky demo exits with code `2`, which makes the compiler useful as a CI or ingestion gate.

Create editable starter manifests:

```bash
pnpm echo init my-corpus
pnpm echo compile my-corpus/batch.json \
  --catalog my-corpus/catalog.json \
  --policy my-corpus/policy.json
```

## Commands

```bash
# Summarize the current catalog
pnpm echo inspect examples/catalog.json

# Compile an admission batch
pnpm echo compile examples/safe-batch.json \
  --catalog examples/catalog.json \
  --policy examples/policy.json

# Explain one asset and its immediate graph neighborhood
pnpm echo lineage examples/safe-batch.json \
  --catalog examples/catalog.json \
  --policy examples/policy.json \
  --asset synthetic-docs-clean

# Export the complete DAG as Graphviz DOT
pnpm echo graph examples/safe-batch.json \
  --catalog examples/catalog.json \
  --policy examples/policy.json \
  --output lineage.dot

# Issue and independently verify a tamper-evident receipt
pnpm echo receipt examples/safe-batch.json \
  --catalog examples/catalog.json \
  --policy examples/policy.json \
  --output receipt.json

pnpm echo verify receipt.json \
  --catalog examples/catalog.json \
  --policy examples/policy.json \
  --batch examples/safe-batch.json
```

Exit codes are `0` for clean, `2` for blocked, `3` for review, `4` for an invalid receipt, and `5` for invalid input.

## Studio

The local Studio visualizes the provenance DAG, synthetic share, dominant generator, recursive depth, independent human roots, and every policy finding.

```bash
pnpm dev
```

Open the Vite URL and switch between the clean and contaminated examples. The Studio is a local inspection interface; no corpus content is uploaded anywhere.

## Data model

Each asset declares:

- `contentHash`: a stable digest or content-addressed identifier
- `origin`: `human`, `synthetic`, or `hybrid`
- `sourceIds`: immediate provenance parents
- `split`: `train`, `validation`, `test`, `eval`, or `rag`
- `modelFamily`: the generator family, when applicable
- `humanFraction`: `1` for human, `0` for synthetic, or a hybrid fraction
- `weight`: the policy-relevant contribution, such as records or tokens
- `license`, `createdAt`, and `domain`

See [Manifest format](docs/MANIFEST.md) and [Policy reference](docs/POLICY.md).

## Design boundary

EchoQuota compiles declared provenance. It does not infer whether text is AI-generated, prove that a source declaration is honest, scan raw corpus contents, or guarantee legal license compatibility. Supply content hashes and lineage from a trusted ingestion system, then bind the resulting receipt to the exact artifacts you train on.

## Research context

- Shumailov et al., [*AI models collapse when trained on recursively generated data*](https://www.nature.com/articles/s41586-024-07566-y), Nature (2024)
- NIST, [AI Technology and Evaluation: Test Contamination](https://pages.nist.gov/ai-technology-evaluation/)
- NIST, [Reducing Risks Posed by Synthetic Content](https://www.nist.gov/publications/reducing-risks-posed-synthetic-content-overview-technical-approaches-digital-content)

These references motivate the problem. EchoQuota is an independent open-source implementation and is not affiliated with the cited organizations.

## Development

```bash
pnpm check
```

That runs linting, strict TypeScript checks, unit tests, and production builds for the compiler, CLI, and Studio.

## License

[MIT](LICENSE)
