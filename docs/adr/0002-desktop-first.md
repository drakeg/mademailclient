# ADR 0002: desktop-first delivery using Electron

Status: accepted for prototype packaging.

User clarification: installable Mac and Windows applications take priority over hosted web access. The existing shared interface is retained as the renderer.

Electron is chosen for a consistent bundled browser runtime and JavaScript reuse with no platform webview differences. Tauri could reduce distribution size but adds a Rust/native toolchain and platform webview variation at this stage. Electron has greater memory/download costs and needs frequent security updates; revisit with measured budgets before beta.

Add exact-pinned Electron (MIT) and electron-builder (MIT) as development dependencies. Their need is desktop runtime and DMG/NSIS packaging. Review the lockfile/transitive licenses and production dependency advisories before releases. Both tools remain out of the mail domain module; renderer Node integration is disabled. Version updates require security review and desktop smoke tests.

References: https://www.electronjs.org/docs/latest/tutorial/sandbox ; https://www.electron.build/configuration/ ; https://www.electron.build/nsis/ .

Dependency audit at implementation: pnpm audit reported one moderate advisory, GHSA-hp3w-g68c-fv3c, in transitive build-tool dependency sprintf-js (through app-builder-lib/@electron/get logging). No patched version was reported. It is not exposed to renderer/mail input and build dependencies are excluded from the packaged app. Track upstream remediation before public release; high/critical audit threshold passed. Do not interpret this as a full security review.
