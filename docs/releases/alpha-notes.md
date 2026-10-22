# Made Mail desktop preview

Experimental prerelease made downloadable at the repository owner’s request for sample-mail testing. Not intended for real accounts or normal daily use.

## Downloads
Choose the Mac arm64 DMG for Apple Silicon, Mac x64 DMG for Intel, or Windows x64 EXE. SHA256SUMS.txt records download checksums; it does not replace publisher code signing.

## What works
Bundled three-pane mail interface, unified and per-account synthetic inboxes, search, native OS menus, sample folder/read/flag actions, and rules previews. No website or localhost server is required.

## Limits and trust
Unsigned prototype; Mac notarization and Windows signing are not configured. Do not disable Gatekeeper, SmartScreen or endpoint protection to test this release. Use the development/test path until trusted installation is available. No real account connections, message sending, persistent rules, actual attachment downloads, or automatic updates. All mail is fictional and changes reset on reload.

## Validation
All three platform jobs passed tests and packaged-app launch checks: https://github.com/drakeg/mademailclient/actions/runs/39837737427 . It does not prove interactive installation, upgrade, uninstall, accessibility, signing, or clean-machine behavior. See docs/TESTING.md and docs/releases/alpha-acceptance.md; complete those gates before recommending this app for normal use. Record the workflow URL and exact asset checksums in the acceptance report.
