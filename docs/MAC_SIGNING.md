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
