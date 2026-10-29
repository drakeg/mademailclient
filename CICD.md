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

## Desktop prototype builds (implemented)
See `.github/workflows/desktop.yml` and docs/DESKTOP.md. Mac, Windows and Linux runners install exact locked dependencies, run checks/tests and upload unsigned DMG/EXE/DEB/AppImage artifacts. These jobs do not publish releases. Signing, notarization and native install/upgrade smoke tests remain release gates.

## Alpha draft release pipeline
The desktop workflow now builds and smoke-tests Mac arm64, Mac x64, Windows x64 and Linux x64 separately. Feature branch pushes and PRs produce Actions artifacts only. A `v*-alpha.*` tag builds those same targets; after all pass, a separate job with contents:write downloads only this run's installers, verifies the tag matches package.json, requires all five expected installer filenames, writes SHA256SUMS.txt, and creates a draft prerelease via the runner's built-in gh CLI. It never publishes automatically and does not receive signing secrets. Existing drafts are not overwritten on reruns; inspect the existing release before deciding how to retry.

Review docs/TESTING.md and docs/releases/alpha-acceptance.md before publishing. Draft releases are visible only to authorized repository users. Creating a tag does not merge its branch. Signing/notarization and manual installer acceptance remain required for normal distribution.

## Mac trust regression gate
After the installed alpha was reported as damaged, Mac tag jobs now require strict signature verification, stapled notarization and Gatekeeper acceptance. Current unsigned tag builds will fail by design; development branch builds remain unsigned and must not be described as normal-installation-ready. See docs/MAC_SIGNING.md for the missing credentials and signed-build plan.

The account adapter adds locked runtime IMAP/MIME dependencies. CI installs these into packaged apps; run production dependency auditing on updates. Account unit tests use synthetic clients and an injected encryption adapter; live credentials must never be added to CI. Packaged smoke tests assert empty startup and explicitly enter sample mode. Signing gates remain unchanged.

OAuth packaging accepts public client IDs through repository Actions variables GOOGLE_DESKTOP_CLIENT_ID and YAHOO_PUBLIC_CLIENT_ID. Empty values keep browser sign-in unavailable. Do not put confidential client secrets or user tokens in the bundle. Packaged smoke checks provider selection and app-password fallback without opening real provider sign-in or requiring account credentials. Yahoo callback protocol installation and actual consent require separate acceptance.

## Linux installer increment

The desktop matrix also builds Linux x64 AppImage and DEB on Ubuntu 22.04, then launches the unpacked app under Xvfb with the sandbox enabled. Artifacts are uploaded only after the smoke test passes. Alpha draft collection now requires five exact installer filenames (two DMGs, Windows EXE, Linux AppImage and DEB). Package-manager installation, upgrade and clean-machine trust remain manual acceptance gates. See docs/INSTALLERS.md. No signing gate has been relaxed.

## Requested milestone publication

After the exact source commit passes Desktop installers, pushing that commit to a new release/milestone-* branch runs Publish tested desktop preview downloads. It selects a successful push-triggered installer run for the exact SHA, downloads only Windows/Linux artifacts, validates the version/three declared filenames and checksums, creates a non-overwriting matching source tag, and publishes a prerelease (never latest). No signing secrets are exposed. This replaces the alpha.1-specific publisher. Mac binaries are excluded, not exempted from trust checks; the existing all-platform tag/draft path retains its Mac trust gate. Reusing an existing published version fails rather than overwriting its assets. Bump the alpha version and rewrite release notes for each milestone.
