# Installing Made Mail

Download installers from [GitHub Releases](https://github.com/drakeg/mademailclient/releases). Starting with 0.4.0, each milestone includes Mac Apple Silicon/Intel DMGs, Windows x64 EXE, and Linux x64 DEB/RPM/AppImage, plus SHA256SUMS.txt. Source ZIP/TAR archives are not installers. Installer builds and synthetic packaged checks must pass for the exact release commit.

## macOS: download and drag to Applications

1. Download `Made-Mail-<version>-mac-arm64.dmg` for Apple Silicon (M-series), or `Made-Mail-<version>-mac-x64.dmg` for Intel. About This Mac identifies the processor.
2. Quit Made Mail. Open the DMG and drag **Made Mail.app** onto **Applications**. Choose Replace when updating, then eject the disk image.
3. Launch Made Mail from Finder → Applications. No Git, Node, pnpm or web server is required. Updates use the same download-and-replace steps. Account/rule/draft data remains in the existing application profile; the app does not create previous-version application backups.

**Signing notice:** default Mac downloads have an **ad-hoc integrity signature**, not a Developer ID signature, and are **not notarized by Apple**. The signature lets CI verify bundle integrity; it does not identify a publisher trusted by Apple. macOS may block first launch. For a build you choose to trust, use Apple's normal per-app approval procedure in [Safely open apps on your Mac](https://support.apple.com/en-us/102445); managed Macs may prohibit it. No installer changes Gatekeeper, removes quarantine or disables OS protections. If macOS reports damage or malware, stop and check the exact version/checksum rather than running security-disabling commands. Downloaded-install acceptance on clean Macs remains pending.

A separate protected Developer ID/notarization workflow remains available; see [MAC_SIGNING.md](MAC_SIGNING.md). It supersedes the ad-hoc artifacts when configured and successful. Users do not need that membership to download the ad-hoc build. To uninstall, quit and move /Applications/Made Mail.app to Trash; account data is retained. An older copy in ~/Applications is separate.

## Windows

Download `Made-Mail-<version>-win-x64.exe` and run the setup wizard. This is an NSIS installer with directory selection and shortcuts. Preview builds do not have a trusted publisher signature; Windows may warn or block installation according to local policy. Remove through Settings → Apps. Windows ARM and automatic updates are not provided.

## Linux

Debian/Ubuntu:

```sh
sudo apt install ./Made-Mail-<version>-linux-amd64.deb
```

Fedora/RPM distributions:

```sh
sudo dnf install ./Made-Mail-<version>-linux-x86_64.rpm
```

On openSUSE use `sudo zypper install ./Made-Mail-<version>-linux-x86_64.rpm`. Package name for removal is `mademailclient` (apt/dnf/zypper remove). Files in your user profile are retained. Native installation/upgrade acceptance across distributions remains pending.

AppImage:

```sh
chmod +x Made-Mail-<version>-linux-x86_64.AppImage
./Made-Mail-<version>-linux-x86_64.AppImage
```

AppImages may need distribution-specific FUSE support. Keep Electron's sandbox enabled. Linux ARM and AppImage desktop integration are not provided. Account encryption requires a supported OS secret service.

## Developers and validation

Source installation remains optional: with Node 22+ and pnpm 11.25.0, `pnpm desktop:install:mac` builds/tests and replaces /Applications/Made Mail.app. `bash scripts/install-macos.sh --build-only` builds without installing. This is no longer the normal user download path.

GitHub Actions also retains temporary installer artifacts under the Desktop installers workflow. Artifacts can expire; Releases are the permanent download location. CI tests synthetic mail and native packaged launch; this does not establish real-provider or clean-machine installation acceptance. See TESTING.md and ATTACHMENTS.md for feature limits.
