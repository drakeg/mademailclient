# v0.1.0-alpha.1 acceptance record

Status: NOT APPROVED FOR PUBLICATION. Do not convert pending checks into passes.

| Target | Build | Packaged smoke | Native menus | Install/uninstall | OS trust/signing | Upgrade |
|---|---|---|---|---|---|---|
| Mac Apple Silicon | Pending CI | Pending CI | Pending manual | Pending manual | Unsigned / blocked release gate | Pending second version |
| Mac Intel | Pending CI | Pending CI | Pending manual | Pending manual | Unsigned / blocked release gate | Pending second version |
| Windows x64 | Pending CI | Pending CI | Pending manual | Pending manual | Unsigned / blocked release gate | Pending second version |

Evidence: fill in workflow URL, commit, installer checksum, OS version, tester/date and result per target. Domain/unit checks passing locally do not establish installation success.

Known issues: account connections/sending/persistence/updates are unavailable; attachments are sample labels; prior local DMG creation failed at hdiutil and native launch inspection timed out. A clean GitHub runner is used for independent packaging validation.
