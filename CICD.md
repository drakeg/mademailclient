# Continuous integration and delivery

## Current pipeline
`.github/workflows/ci.yml` runs on pushes and pull requests with read-only repository permissions. Node 22 and 24 each run syntax checks and the domain test suite on Ubuntu. It needs no secrets, network accounts, package installation, or provider access. Syntax checks are not a full linter, type checker, browser test, or dependency audit.

Run locally: `npm run check` then `npm test`. A failing command blocks its CI job. Maintainers should require both matrix jobs and at least one review through GitHub branch protection; these settings must be configured by the repository owner and are not applied by this scaffold.

## Review and release policy
PR -> passing CI -> maintainer review -> merge. Until provider/security milestones pass, releases must be explicitly marked prototypes. No automatic production deployment is configured.

## Planned delivery gates
Web: reproducible build, browser/accessibility tests, dependency/license checks, migration rehearsal, staging smoke test with synthetic accounts, and explicit production promotion. Store hosting credentials in environment-scoped GitHub secrets, use least privilege and short-lived identity where available; never expose secrets to fork PRs or use pull_request_target to run untrusted code.

Desktop: Mac and Windows build/test matrix, signed binaries, notarization for macOS, checksums and release artifacts, update signature verification, and install/upgrade smoke tests. Signing and notarization credentials require restricted release environments.

Backend: encrypted credentials, tenant isolation tests, idempotent job tests, backup/restore rehearsal, rate-limit recovery, and provider capability tests before production. Migrations must be backward compatible through rollout and reversible or have a tested restore plan.

## Deployment and rollback
Not available yet. Before enabling delivery, record hosting target, operator owner, artifact/version identifiers, environment variables, health checks, migration sequence, promotion approval, and rollback commands in an operator runbook. Roll back to a known artifact only after checking schema compatibility. Pause workers before investigating repeated destructive actions. Do not claim a deploy succeeded without a reachable smoke test.
