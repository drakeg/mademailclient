# Made Mail desktop preview

Draft prerelease for installation testing. Not approved for general distribution.

## Downloads
Choose the Mac arm64 DMG for Apple Silicon, Mac x64 DMG for Intel, or Windows x64 EXE. SHA256SUMS.txt records download checksums; it does not replace publisher code signing.

## What works
Bundled three-pane mail interface, unified and per-account synthetic inboxes, search, native OS menus, sample folder/read/flag actions, and rules previews. No website or localhost server is required.

## Limits and trust
Unsigned prototype; Mac notarization and Windows signing are not configured. Do not disable Gatekeeper, SmartScreen or endpoint protection to test this release. Use the development/test path until trusted installation is available. No real account connections, message sending, persistent rules, actual attachment downloads, or automatic updates. All mail is fictional and changes reset on reload.

## Validation
The release workflow requires tests and a packaged-app launch smoke test on each target architecture before creating this draft. It does not prove interactive installation, upgrade, uninstall, accessibility, signing, or clean-machine behavior. See docs/TESTING.md and docs/releases/alpha-acceptance.md; complete those gates before publishing the draft. Record the workflow URL and exact asset checksums in the acceptance report.
