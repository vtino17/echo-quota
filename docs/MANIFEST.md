# Manifest format

EchoQuota consumes a catalog of accepted assets and a proposed admission batch. Both contain the same asset shape.

```json
{
  "id": "synthetic-docs-clean",
  "contentHash": "sha256:synthetic-clean",
  "origin": "synthetic",
  "modelFamily": "atlas-1",
  "sourceIds": ["human-docs-a"],
  "split": "train",
  "license": "CC-BY-4.0",
  "createdAt": "2026-02-01T00:00:00.000Z",
  "weight": 10,
  "humanFraction": 0,
  "domain": "technical-docs"
}
```

## Catalog

```json
{
  "catalogVersion": "1.0",
  "datasetId": "assistant-corpus",
  "assets": []
}
```

The catalog represents already accepted corpus state. Batch IDs cannot collide with catalog IDs.

## Batch

```json
{
  "batchVersion": "1.0",
  "datasetId": "assistant-corpus",
  "assets": []
}
```

Batch assets may cite catalog assets or other assets in the same batch. The compiler evaluates the combined graph.

## Origin invariants

| Origin | Human fraction | Model family | Sources |
| --- | ---: | --- | --- |
| `human` | exactly `1` | absent | none |
| `synthetic` | exactly `0` | required | required by default |
| `hybrid` | greater than `0`, less than `1` | required | required by default |

`weight` must be positive. Teams should choose one consistent weighting unit—records, tokens, seconds, or another ingestion unit—for the entire dataset.

`contentHash` is treated as an opaque stable identifier. EchoQuota compares it for equality but does not hash raw corpus files.
