# v0.1.0-alpha.1 acceptance record

Status: experimental prerelease publication authorized by repository owner for sample-mail testing. Not approved for normal use. Pending checks remain pending.

| Target | Build | Packaged smoke | Native menus | Install/uninstall | OS trust/signing | Upgrade |
|---|---|---|---|---|---|---|
| Mac Apple Silicon | Passed CI | Passed CI | Pending manual | Pending manual | Unsigned / blocked release gate | Pending second version |
| Mac Intel | Passed CI | Passed CI | Pending manual | Pending manual | Unsigned / blocked release gate | Pending second version |
| Windows x64 | Passed CI | Passed CI | Pending manual | Pending manual | Unsigned / blocked release gate | Pending second version |

Evidence: fill in workflow URL, commit, installer checksum, OS version, tester/date and result per target. Domain/unit checks passing locally do not establish installation success.

Known issues: account connections/sending/persistence/updates are unavailable; attachments are sample labels; prior local DMG creation failed at hdiutil and native launch inspection timed out. A clean GitHub runner is used for independent packaging validation.

Automated evidence: https://github.com/drakeg/mademailclient/actions/runs/39837289663 at source commit c869e19. All three platform jobs passed packaging, 16 unit/domain/release-gate tests and packaged-app launch checks. The alpha tag workflow independently rebuilds the tagged commit before creating a draft. Interactive menus, installation/uninstallation, signing and upgrades remain pending.
