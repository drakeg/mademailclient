# Rust built-in provider settings

In Add Account, enter an email address and choose **Fill known provider settings** before entering server/username settings. This is an offline lookup for exact `gmail.com`, `yahoo.com` and `icloud.com` domains; it performs no DNS request, sign-in, credential submission or automatic verification.

| Domain | IMAP | SMTP | Username |
|---|---|---|---|
| gmail.com | imap.gmail.com:993, TLS | smtp.gmail.com:465, TLS | Full email for both |
| yahoo.com | imap.mail.yahoo.com:993, TLS | smtp.mail.yahoo.com:465, TLS | Full email for both |
| icloud.com | imap.mail.me.com:993, TLS | smtp.mail.me.com:587, STARTTLS | Incoming local part; outgoing full email |

Apple documents trying the full email as the incoming username if the local part fails. Made Mail shows that guidance but never automatically retries credentials. App-password/provider-policy requirements still apply. Browser sign-in remains unavailable in this Rust slice. Microsoft consumer domains show a modern-authentication limitation without filling misleading password settings; Microsoft 365/custom domains and other providers remain manual until the appropriate setup/authentication work is implemented.

Existing hostnames, usernames, modified ports or TLS choices cause a visible refusal with no fields changed. Passwords are never read, copied or overwritten by the preset function. Unknown/lookalike domains are not guessed from suffixes or email contents. These are server defaults, not proof that an account can authenticate. Explicit saved-server verification remains separate.

Evidence: tests cover supported defaults, case-insensitive exact matching, iCloud's username/STARTTLS difference, password preservation, custom settings and ports, malformed/lookalike domains, and Microsoft limitations. Manual Mac fixture-mode acceptance verified filling iCloud fields and preserving an edited custom SMTP hostname. No account was saved to OS credentials and no provider was contacted during that UI test.

Official settings reviewed for this implementation:
- Gmail: https://developers.google.com/workspace/gmail/imap/imap-smtp
- Yahoo: https://help.yahoo.com/kb/imap-settings-sln4075.html
- iCloud: https://support.apple.com/en-us/102525
- Microsoft modern-authentication requirement: https://support.microsoft.com/en-us/outlook/pop-imap-and-smtp-settings-for-outlook-com

No dependencies, provider SDKs, Mailcraft code or assets are added.
