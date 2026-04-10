# Security

## Reporting vulnerabilities

Do **not** open a public GitHub issue for undisclosed security problems.

- Email the maintainers of the main Upsked project, or use GitHub **private vulnerability reporting** if enabled on this repository.
- Include: affected paths, reproduction steps, and impact (data exposure, RCE, etc.).

## Scope

This repository contains **connector tooling** and **fixtures**. It should not contain live session tokens, passwords, or production API keys. If you find secrets committed, rotate them and notify maintainers.

## Dependencies

Run `npm audit` periodically; CI does not fail on audit by default—consider enabling `npm audit --audit-level=high` in your fork if you need stricter gates.
