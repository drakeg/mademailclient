# Mac release signatures

## Default direct downloads (0.4.0)

The owner explicitly authorized downloadable Mac previews without Developer ID membership on 2026-11-11. GitHub Releases now includes Apple Silicon and Intel DMGs by default. This supersedes earlier documentation that excluded all Mac binaries pending notarization.

The preview config in scripts/electron-builder-mac-preview.cjs forces an ad-hoc identity, disables hardened runtime for compatibility with ad-hoc Electron helpers, and disables notarization. No certificates or signing secrets are used. Electron renderer sandboxing, context isolation, network TLS and OS settings remain enabled/unchanged. CI verifies strict bundle signatures, verifies/mounts the DMG, verifies its contained app and runs packaged synthetic checks. Ad-hoc signatures verify integrity but do not establish a trusted publisher identity. Normal downloaded-install/upgrade acceptance is still pending.

Release notes must say **not Developer ID signed and not notarized by Apple**. macOS may require its normal per-app approval or block the app according to local policy; see [Apple's guidance](https://support.apple.com/en-us/102445). No installer removes quarantine or changes Gatekeeper. Do not patch or re-sign a downloaded app to make it appear verified.

## Optional trusted distribution

When the owning team obtains Developer ID and notarization credentials, enable the protected workflow below. A failed enabled signing job blocks publication instead of falling back to the ad-hoc DMGs. Membership is not required for the default preview download path.

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
