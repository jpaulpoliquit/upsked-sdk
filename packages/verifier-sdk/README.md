# Verifier SDK Package

Owns reusable verification and release-building helpers:

- time parsing
- cross-artifact validation
- regression diffing
- report generation
- release hashing

The verifier is the narrow acceptance contract for partner releases. A connector can generate artifacts any way it wants, but nothing reaches Upsked runtime traffic until this package accepts the bundle.
