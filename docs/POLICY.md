# Policy reference

```json
{
  "policyVersion": "1.0",
  "datasetId": "assistant-corpus",
  "maxSyntheticWeightRatio": 0.25,
  "maxSyntheticDepth": 2,
  "maxModelFamilyWeightRatio": 0.2,
  "minIndependentHumanRoots": 1,
  "allowedLicenses": ["CC-BY-4.0", "MIT", "Apache-2.0"],
  "protectedSplits": ["test", "eval"],
  "forbidProtectedAncestorsInTrain": true,
  "forbidCrossSplitHashDuplicates": true,
  "requireSourcesForGeneratedAssets": true
}
```

## Controls

- `maxSyntheticWeightRatio` limits non-human weighted contribution after structurally rejected assets are removed.
- `maxSyntheticDepth` limits the longest generated path from a human root. Human assets have depth zero.
- `maxModelFamilyWeightRatio` limits the weighted non-human contribution from any one generator family.
- `minIndependentHumanRoots` requires each proposed asset to resolve to enough distinct human-origin roots.
- `allowedLicenses` is an exact allowlist. It is a policy control, not legal advice.
- `protectedSplits` identifies sources that must not become training ancestors when the corresponding prohibition is enabled.
- `forbidCrossSplitHashDuplicates` blocks identical content identifiers across different splits.
- `requireSourcesForGeneratedAssets` prevents generated assets with undeclared ancestry.

## Admission order

EchoQuota first evaluates every proposed asset for structural violations. It then computes corpus-wide ratios using the current catalog plus structurally admissible assets. A global quota violation blocks the compilation, but the per-asset decisions remain visible for remediation.

Warnings produce a `review` status. Any blocked finding produces a `blocked` status.
