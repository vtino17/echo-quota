# Threat model

## Protected properties

EchoQuota is designed to make declared lineage complete enough for deterministic policy evaluation and to make a successful compilation tamper-evident.

It addresses:

- accidental recursive synthetic ingestion;
- declared evaluation ancestry entering training;
- exact content identifiers reused across splits;
- missing and cyclic graph edges;
- generator-family concentration;
- manifest or receipt changes after compilation.

## Trust assumptions

The compiler trusts the system that produces asset identifiers, hashes, weights, licenses, origins, and parent edges. It also trusts the local runtime and policy file at compilation time.

## Out of scope

- Detecting undeclared AI-generated text
- Semantic or near-duplicate detection
- Verifying that a content hash corresponds to a remote object
- License interpretation or compatibility analysis
- Cryptographic publisher identity
- Data poisoning, prompt injection, or malware scanning
- Statistical proof that an accepted corpus cannot cause model collapse

## Recommended deployment

Generate manifests close to data creation, use content-addressed storage, version policy alongside training code, keep protected evaluations access-controlled, sign accepted receipts externally, and verify the receipt again immediately before training.
