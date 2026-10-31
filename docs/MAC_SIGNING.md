# Mac distribution blocker and resolution

The alpha.1 Mac download can be rejected as damaged. Its build explicitly disabled signing; an earlier local bundle fails strict signature verification. The build-runner launch smoke test does not reproduce the security checks applied to an app downloaded from the internet.

Do not remove quarantine metadata, disable Gatekeeper, or re-sign the installed download as a substitute for a verified release. The distribution fix is a new version signed with a Developer ID Application certificate, submitted for Apple notarization and stapled, then tested through the downloaded DMG path.

## Prerequisites
An Apple Developer Program team must own the app's signing identity and notarization credentials. No valid code-signing identities were found in the agent environment. Never paste certificates, private keys, Apple passwords or notarization tokens into chat or commit them to Git.

## Implementation sequence
1. Set up the Developer ID Application certificate and private key in an authorized signing environment. For CI use restricted secrets/environments, with maintainers controlling access; do not expose credentials to PR jobs.
2. Configure a separate signed build: require code signing (`forceCodeSigning: true`), hardened runtime, version-appropriate Electron JIT entitlements and notarization. Remove the unsigned build override only for that protected job. Use the v26 electron-builder documentation, matching this repository's version.
3. Sign nested helpers/frameworks and the app, notarize and staple, then build the final DMG. Keep unsigned CI development artifacts separate from distribution artifacts.
4. Require `codesign --verify --deep --strict`, `xcrun stapler validate`, and `spctl --assess --type execute` to pass on each architecture. Verify the final DMG and its copied app, then test a normal browser download and launch on a clean Mac without changing OS security settings.
5. Publish a new version with fresh checksums. Do not silently replace alpha.1 downloads or claim the current release is fixed.

Signing is not implemented or validated yet. The tag workflow now blocks draft releases when Mac trust checks fail.

References: https://www.electron.build/v26/docs/features/code-signing/code-signing-mac/ and https://www.electronjs.org/docs/latest/tutorial/code-signing .

## Implemented protected release path (0.2.2)

The preview publisher now has a `signed-mac` matrix (arm64/x64), using `scripts/electron-builder-mac-release.cjs`. This requires Developer ID signing, hardened runtime and notarization. The explicit entitlement allows Electron JIT; no debugging or disabled library-validation entitlement is added. This configuration is checked against the pinned electron-builder 26 options. Signing has not run with real credentials yet; the earlier statement that no workflow exists is superseded by this section.

Maintainer setup in GitHub Settings (never put secrets in chat):

1. Enroll the owning team in the Apple Developer Program. Create a **Developer ID Application** certificate and export it with its private key as a password-protected `.p12`. This is direct distribution, not a Mac App Store certificate.
2. Create a team App Store Connect API key suitable for notarization. Keep its `.p8` file private.
3. Create the GitHub Actions environment **desktop-release**, require a maintainer reviewer, and limit its deployment branches to the authorized `release/milestone-*` branches. Review the source/workflow before approving a signing job.
4. Add environment secrets: `MAC_CSC_LINK` (base64 `.p12` contents), `MAC_CSC_KEY_PASSWORD` (export password), `APPLE_API_KEY_BASE64` (base64 `.p8` contents), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`. Use GitHub's secret entry UI; no credentials belong in repository files. The job writes the API key to a mode-0600 runner temporary file and removes it on step exit.
5. Set repository Actions variable **MAC_RELEASE_ENABLED** to **true**. Missing secrets or invalid signatures fail the job; publication cannot silently fall back to unsigned Mac binaries when enabled.
6. Push an authorized, versioned release branch only after the four-platform build for that exact commit succeeds. The job rebuilds both Mac architectures, notarizes/staples app and DMG, checks codesign/stapler/Gatekeeper, inspects the app inside the mounted DMG and runs the packaged synthetic smoke test. Both signed artifacts are collected from the same publishing run and checksummed alongside Windows/Linux assets.
7. Before calling this production distribution, verify browser download → mount DMG → copy to Applications → launch/upgrade/uninstall on clean Intel and Apple Silicon Macs. CI checks do not replace that acceptance.

If membership/credentials are unavailable, leave the variable unset. Windows/Linux releases continue and Mac testing uses the local source-install script. Do not publish the unsigned development DMGs as trusted installers.
