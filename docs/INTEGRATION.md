# Integration guide

## In an ingestion pipeline

1. Produce a catalog manifest from the currently accepted corpus.
2. Generate a batch manifest during collection or synthesis.
3. Compile both against the version-controlled policy.
4. Stop ingestion on exit code `2` or `3`, depending on review policy.
5. Issue a receipt only after the compilation is acceptable.
6. Store the receipt beside the immutable corpus snapshot or training run.

```bash
pnpm echo compile candidate.json \
  --catalog accepted.json \
  --policy policy.json \
  --json > compilation.json
```

## In CI

```yaml
- run: corepack enable
- run: pnpm install --frozen-lockfile
- run: pnpm echo compile data/candidate.json --catalog data/catalog.json --policy data/policy.json
```

## Graph inspection

Export Graphviz DOT when a blocked ancestry chain needs review:

```bash
pnpm echo graph candidate.json \
  --catalog accepted.json \
  --policy policy.json \
  --output lineage.dot

dot -Tsvg lineage.dot > lineage.svg
```

## Receipt binding

A receipt binds hashes of the catalog, batch, policy, and deterministic compilation. Verification recompiles with the receipt timestamp, so an altered manifest or result fails validation. A receipt does not sign itself; add a trusted signing system when publisher identity must be authenticated.
