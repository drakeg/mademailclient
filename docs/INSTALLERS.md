# Installing Made Mail previews

Made Mail is an Electron desktop application with bundled assets. It does not need a web server. These are development previews: accounts are read-only, sending is unfinished, and OAuth requires publisher registration. Back up important mail and use disposable accounts for provider acceptance.

## macOS: local build and install today

Until the project has a Developer ID signing identity and notarization, the reliable testing path is to build from the reviewed source on your own Mac. Requires Node.js 22+ and pnpm 11.25.0. Quit Made Mail, then in your existing repository checkout:

```sh
git pull
pnpm desktop:install:mac
```

The script installs locked dependencies, runs syntax checks/tests, packages for the architecture of your Node installation, and launches a synthetic packaged-app smoke test. It then copies Made Mail.app into **/Applications**, alongside your other Mac apps. If the folder is not writable, macOS administrator authorization is requested only for copying/backing up the app. Any existing copy there is retained as a timestamped backup. It does not change Gatekeeper or remove quarantine metadata. Use a native Apple Silicon Node installation on Apple Silicon Macs.

Open Finder → Applications → Made Mail. An older copy in ~/Applications is separate; move that copy to Trash after confirming the new app launches. The script does not erase accounts, credentials or preferences. To remove this build, quit and move /Applications/Made Mail.app to Trash. Account data is retained; remove accounts through the GUI first if desired.

For manual copy/paste instead:

```sh
bash scripts/install-macos.sh --build-only
```

Copy `dist/mac-arm64/Made Mail.app` (Apple Silicon) or `dist/mac/Made Mail.app` (Intel) to Applications with Finder. The local build is not a signed public download. No automatic updates are configured; pull and rerun to update.

## Windows: setup EXE

From the **Desktop installers** Actions run for the desired commit, download `installer-win-x64`, unzip it and run `Made-Mail-<version>-win-x64.exe`. This is an NSIS installer with directory selection and shortcuts, not a portable web page. Remove it through Windows Settings → Apps. Windows ARM is not covered. The preview is unsigned; publisher trust and clean-machine installation acceptance remain pending. Do not disable OS protections to run a blocked artifact.

## Linux: Debian package or AppImage (x64)

The workflow produces `installer-linux-x64`. On Debian/Ubuntu, unzip the artifact and install the local package:

```sh
sudo apt install ./Made-Mail-<version>-linux-x64.deb
```

Launch Made Mail from the application menu. Remove with `sudo apt remove mademailclient`. Your account data is retained. Other distributions can try the AppImage:

```sh
chmod +x Made-Mail-<version>-linux-x64.AppImage
./Made-Mail-<version>-linux-x64.AppImage
```

AppImages may require distribution-specific FUSE support. Keep Electron's sandbox enabled; do not add --no-sandbox. AppImage desktop integration and Linux ARM are not provided. Secure account storage depends on a supported OS secret service; systems without it may reject credential persistence. CI launches the unpacked app under Xvfb; that does not establish package-manager installation or AppImage acceptance on every distribution.

## Downloads, checksums and release gates

Actions: https://github.com/drakeg/mademailclient/actions/workflows/desktop.yml . Select a successful run for the latest topic-branch commit, then its installer artifacts (GitHub sign-in may be required). Artifacts expire; they are not permanent Releases downloads. A failed job is not an accepted installer. Source ZIP/TAR downloads from GitHub are not built apps.

Matching alpha tags collect all five installers into a draft prerelease with SHA256SUMS.txt only after packaged smoke and Mac trust gates pass. No new public release is promised until those gates and native install acceptance pass. Mac downloadable DMG distribution remains blocked on signing/notarization; switching to PKG would not solve that trust requirement. See MAC_SIGNING.md and TESTING.md.

Build target references: https://www.electron.build/v26/docs/targets/ and https://www.electron.build/v26/docs/linux/ .

## Recorded build validation (2026-10-27)

Commit a4f32dd: all 57 tests passed locally; syntax and shell syntax checks passed. GitHub run https://github.com/drakeg/mademailclient/actions/runs/40449245649 built all four platforms and passed each packaged synthetic launch smoke test. Windows EXE, Linux DEB/AppImage and both Mac DMGs were uploaded. The local Mac bundle built, but its direct sandboxed-tool smoke launch aborted; GitHub Mac launches succeeded. Neither result establishes downloaded Mac trust or native installer/upgrade/uninstall acceptance. The install script's copy/backup phase has not been executed on the Applications folder by this agent.
