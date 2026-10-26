# SMTP and automatic account setup

Requested outcome: enter an existing email address, receive suggested incoming/outgoing settings, review/edit them, and save a verified account. Existing accounts must be editable without removal. No accounts are included by default.

## Implementation slices and acceptance

1. Secure transport contract: IMAP 993/TLS or 143/required STARTTLS; SMTP 465/TLS or 587/required STARTTLS. Separate SMTP username/password or explicit reuse of incoming credentials. Reject plaintext, private destinations, unverified certificates, and unsupported port/security combinations. Preserve legacy accounts with no SMTP configuration. Test boundaries before GUI integration.
2. SMTP configuration and verification: expose SMTP host, port, security and credentials in account setup; authenticate with both servers on save, without sending a message. Persist only after both checks succeed, encrypt both secrets, return only public configuration. Permit edits with blank passwords retaining saved secrets only for unchanged authentication destinations. Failure preserves the existing record.
3. Automatic discovery: on leaving a valid new email address field, try built-in provider settings, then domain DNS SRV (_imaps/_imap and _submissions/_submission). Use only the domain for network discovery, never passwords or the full address. Show source, require review, keep manual controls available, and do not overwrite fields the user edits while a lookup is pending. Unsupported domains fall back to manual entry. Discovery is a suggestion, not proof of server ownership or successful login. No guessed-host credential probing or MX-as-submission-server fallback.
4. GUI/runtime validation and documentation: tests for secure SMTP, partial/missing/invalid discovery, stale lookup protection, legacy records and secret-safe edits; packaged smoke verifies setup controls and a built-in discovery result without personal credentials. Existing account/demo behavior must remain working.

Sending/composing mail, OAuth registration, Exchange Autodiscover, Thunderbird HTTP autoconfig, custom ports and hosted account setup remain separate work. SMTP verification checks connection/TLS/authentication, not actual delivery permission.

## Dependency and source review

SMTP verification uses nodemailer 10.2.1 (MIT-0), promoted from an already locked transitive dependency to an exact direct runtime dependency; no additional transitive versions or lifecycle scripts are introduced. The first install ran with scripts disabled. CI's pinned pnpm 11.25.0 and v9 lockfile remain authoritative; the locally updated pnpm 12 binary's lockfile change is verified using pnpm 11 before committing.

Authoritative references reviewed 2026-10-26:
- [Nodemailer SMTP and verify](https://nodemailer.com/smtp): verification connects, negotiates TLS and authenticates without sending; it does not prove sender acceptance.
- [RFC 6186](https://www.rfc-editor.org/rfc/rfc6186.html) and [RFC 8314](https://www.rfc-editor.org/rfc/rfc8314.html): email SRV discovery and secure submission/access. This increment selects a suggested endpoint; it does not implement SRV weighted connection failover.
- [Apple server settings](https://support.apple.com/en-us/102525), [Google IMAP/SMTP](https://developers.google.com/workspace/gmail/imap/imap-smtp), [Outlook.com settings](https://support.microsoft.com/en-us/outlook/pop-imap-and-smtp-settings-for-outlook-com), [Fastmail settings](https://www.fastmail.help/hc/en-us/articles/1500000278342-Server-names-and-ports), [Yahoo settings](https://help.yahoo.com/kb/sln4075.html). Presets describe server addresses, not accounts supplied by default, and do not bypass app-password or OAuth policies.
