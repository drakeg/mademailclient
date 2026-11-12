# Made Mail application icon

Original Made Mail artwork generated with the built-in image-generation tool on 2026-10-27. No Apple/Microsoft artwork was used. The project distributes these assets under its MIT license.

`source.png` is the generated transparent master. `icon.png` is the 1024px application asset, `icon.icns` contains Mac resolutions, and `icon.ico` contains Windows resolutions from 16 to 256px. The master is excluded from packaged apps. Linux uses the PNG; macOS source launches set the Dock icon explicitly. Packaged Mac builds use the bundle ICNS. Windows uses the ICO for the installer/app and the PNG for the window.

Regenerate formats on macOS with `pnpm icons:build` (uses sips and Node format containers; no additional dependency). Commit the results so Windows and Linux runners do not need conversion tools. This command performs resizing and format conversion only.

Generation prompt:

> Use case: logo-brand. Asset type: final desktop application icon for Made Mail, original open source email client. Create one polished macOS-compatible app icon on a transparent 1024x1024 canvas. Center a rounded-square deep teal to ocean blue tile, with tasteful soft dimensional shading, occupying about 82 percent of canvas width, rounded corners and subtle shadow. On the tile place a large beautifully simple ivory-white envelope with crisp folded flap lines that suggest the letter M. A tiny warm amber circular seal at lower right of envelope gives a distinctive accent. Restrained premium productivity app aesthetic, front-facing orthographic, excellent legibility at 32px. No text, no wordmark, no extra objects, no Apple or Microsoft marks, no mockup, no frame, no scenery. Transparent outside the rounded tile.

After pulling, quit the installed app and rerun `pnpm desktop:install:mac` to put the new bundle in /Applications. Restart the app to refresh its Dock icon. Existing downloads do not update automatically.
